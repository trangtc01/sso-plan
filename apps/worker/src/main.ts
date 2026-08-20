import "dotenv/config";
import { Worker } from "bullmq";
import { Prisma, PrismaClient, PublishStatus, VideoStatus } from "@prisma/client";
import { loadConfig } from "../../../src/config.js";
import { runDraft } from "../../../src/run-draft.js";
import type { RunState } from "../../../src/types.js";
import { PUBLISH_QUEUES } from "../../../src/publish-queues.js";
import { FacebookReelsPublisher } from "../../../src/social/facebook-publisher.js";
import { YoutubePlaywrightPublisher } from "../../../src/social/youtube-playwright-publisher.js";
import { loadFacebookConfig, loadYoutubePlaywrightConfig } from "../../../src/social/config.js";

const prisma = new PrismaClient();
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
const tiktokConfig = loadConfig();

const tiktokWorker = new Worker<{ jobId: string }>(PUBLISH_QUEUES.tiktok, async queueJob => {
  const job = await prisma.uploadJob.findUnique({
    where: { id: queueJob.data.jobId },
    include: { video: true, attempts: true },
  });
  if (!job) return;

  const attempt = await prisma.uploadAttempt.create({
    data: {
      jobId: job.id,
      number: job.attempts.length + 1,
      status: VideoStatus.UPLOADING,
      logPath: tiktokConfig.artifactDir,
    },
  });
  await updateTikTokStatus(job.id, job.videoId, attempt.id, "UPLOADING");
  const caption = [job.video.description, ...job.video.hashtags.map(tag => `#${tag}`)]
    .filter(Boolean)
    .join(" ");

  const code = await runDraft({
    filePath: job.video.outputPath ?? job.video.sourcePath,
    caption,
    onState: async (state, error) => updateTikTokStatus(
      job.id,
      job.videoId,
      attempt.id,
      toDatabaseStatus(state),
      error,
    ),
  }, tiktokConfig);

  if (code !== 0) return;
}, { connection, concurrency: 1 });

const facebookWorker = new Worker<{ publishJobId: string }>(PUBLISH_QUEUES.facebook, async queueJob => {
  const job = await loadPublishJob(queueJob.data.publishJobId);
  if (!job) return;
  await markPublishing(job.id);
  try {
    const hashtags = job.video.hashtags.map(tag => `#${tag}`).join(" ");
    const description = [job.video.description, hashtags].filter(Boolean).join("\n\n");
    const result = await new FacebookReelsPublisher(loadFacebookConfig()).publish({
      filePath: job.video.outputPath ?? job.video.sourcePath,
      title: job.video.title,
      description,
      tags: job.video.hashtags,
    }, "PUBLISHED");
    await markPublished(job.id, result.externalId, result.raw);
  } catch (error) {
    await markPublishFailed(job.id, error);
    throw error;
  }
}, { connection, concurrency: 1 });

const youtubeWorker = new Worker<{ publishJobId: string }>(PUBLISH_QUEUES.youtube, async queueJob => {
  const job = await loadPublishJob(queueJob.data.publishJobId);
  if (!job) return;
  await markPublishing(job.id);
  try {
    const result = await new YoutubePlaywrightPublisher(loadYoutubePlaywrightConfig()).publish({
      filePath: job.video.outputPath ?? job.video.sourcePath,
      title: job.video.title,
      description: job.video.description,
      tags: job.video.hashtags,
    }, {
      privacy: "public",
      madeForKids: (process.env.YOUTUBE_DEFAULT_MADE_FOR_KIDS ?? "false").toLowerCase() === "true",
    });
    await markPublished(job.id, result.externalId, result.raw);
  } catch (error) {
    await markPublishFailed(job.id, error);
    throw error;
  }
}, { connection, concurrency: 1 });

for (const worker of [tiktokWorker, facebookWorker, youtubeWorker]) {
  worker.on("error", error => console.error("worker error", error));
}

tiktokWorker.on("failed", async (queueJob, error) => {
  const jobId = queueJob?.data.jobId;
  if (!jobId) return;
  const job = await prisma.uploadJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === VideoStatus.SAVING_DRAFT || job.status === VideoStatus.VERIFYING) return;
  await updateTikTokStatus(job.id, job.videoId, undefined, VideoStatus.FAILED, error.message);
});

process.on("SIGINT", async () => {
  await Promise.all([
    tiktokWorker.close(),
    facebookWorker.close(),
    youtubeWorker.close(),
  ]);
  await prisma.$disconnect();
  process.exit(0);
});

async function loadPublishJob(id: string) {
  return prisma.publishJob.findUnique({ where: { id }, include: { video: true } });
}

async function markPublishing(jobId: string) {
  await prisma.publishJob.update({
    where: { id: jobId },
    data: { status: PublishStatus.PUBLISHING, startedAt: new Date(), errorMessage: null },
  });
}

async function markPublished(jobId: string, externalId: string, raw: Record<string, unknown>) {
  await prisma.publishJob.update({
    where: { id: jobId },
    data: {
      status: PublishStatus.PUBLISHED,
      finishedAt: new Date(),
      response: { externalId, ...raw } as Prisma.InputJsonValue,
    },
  });
}

async function markPublishFailed(jobId: string, error: unknown) {
  await prisma.publishJob.update({
    where: { id: jobId },
    data: {
      status: PublishStatus.FAILED,
      finishedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
}

async function updateTikTokStatus(
  jobId: string,
  videoId: string,
  attemptId: string | undefined,
  status: VideoStatus,
  error?: string,
) {
  const completed = ([
    VideoStatus.DRAFT_SAVED,
    VideoStatus.FAILED,
    VideoStatus.LOGIN_REQUIRED,
    VideoStatus.AMBIGUOUS,
  ] as VideoStatus[]).includes(status);

  await prisma.$transaction([
    prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status,
        errorMessage: error ?? null,
        startedAt: status === VideoStatus.UPLOADING ? new Date() : undefined,
        finishedAt: completed ? new Date() : undefined,
      },
    }),
    prisma.video.update({ where: { id: videoId }, data: { status } }),
    ...(attemptId ? [prisma.uploadAttempt.update({
      where: { id: attemptId },
      data: {
        status,
        errorMessage: error ?? null,
        finishedAt: completed ? new Date() : undefined,
      },
    })] : []),
  ]);
}

function toDatabaseStatus(state: RunState): VideoStatus {
  if (state === "DRAFT_SAVED") return VideoStatus.DRAFT_SAVED;
  if (state === "LOGIN_REQUIRED") return VideoStatus.LOGIN_REQUIRED;
  if (state === "AMBIGUOUS") return VideoStatus.AMBIGUOUS;
  if (state === "SAVING_DRAFT") return VideoStatus.SAVING_DRAFT;
  if (state === "VERIFYING") return VideoStatus.VERIFYING;
  if (state === "UPLOADING") return VideoStatus.UPLOADING;
  return VideoStatus.FAILED;
}
