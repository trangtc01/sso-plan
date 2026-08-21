import "dotenv/config";
import { Queue, Worker } from "bullmq";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  FacebookContentType,
  Platform,
  Prisma,
  PrismaClient,
  PublishMode,
  PublishStatus,
  VideoStatus,
} from "@prisma/client";
import { loadConfig } from "../../../src/config.js";
import { runDraft } from "../../../src/run-draft.js";
import type { RunState } from "../../../src/types.js";
import { PUBLISH_QUEUES } from "../../../src/publish-queues.js";
import { PlaywrightTikTokDraftAdapter } from "../../../src/tiktok-adapter.js";
import { FacebookReelsPublisher } from "../../../src/social/facebook-publisher.js";
import { YoutubePlaywrightPublisher } from "../../../src/social/youtube-playwright-publisher.js";
import { loadFacebookConfig, loadYoutubePlaywrightConfig } from "../../../src/social/config.js";

const prisma = new PrismaClient();
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
const tiktokConfig = loadConfig();
const facebookQueue = new Queue(PUBLISH_QUEUES.facebook, { connection });
const youtubeQueue = new Queue(PUBLISH_QUEUES.youtube, { connection });

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

  await updateTikTokStatus(job.id, job.videoId, attempt.id, VideoStatus.UPLOADING);

  const caption = [job.video.description, ...job.video.hashtags.map(tag => `#${tag}`)]
    .filter(Boolean)
    .join(" ");

  let publishedUrl: string | undefined;

  const code = await runDraft({
    filePath: job.video.sourcePath,
    caption,
    publishMode: job.publishMode,
    useSound: job.useSound,
    onPublishedUrl: async url => {
      publishedUrl = url;
      if (url) {
        await prisma.video.update({
          where: { id: job.videoId },
          data: { tiktokPublishedUrl: url },
        });
      }
    },
    onState: async (state, error) => updateTikTokStatus(
      job.id,
      job.videoId,
      attempt.id,
      toDatabaseStatus(state),
      error,
    ),
  }, tiktokConfig);

  if (code !== 0) return;

  const downstreamJobs = await prisma.publishJob.findMany({
    where: {
      videoId: job.videoId,
      status: { in: [PublishStatus.WAITING_SOURCE, PublishStatus.WAITING_TIKTOK_SOURCE] },
      platform: { in: [Platform.FACEBOOK, Platform.YOUTUBE] },
    },
  });

  if (!downstreamJobs.length) return;

  if (job.publishMode !== PublishMode.PUBLIC) {
    const errorMessage =
      "One or more downstream platforms require the TikTok video source, but TikTok is not PUBLIC; a published TikTok URL is required.";
    await prisma.uploadJob.update({ where: { id: job.id }, data: { errorMessage } });
    await failWaitingDownstream(job.videoId, errorMessage);
    return;
  }

  const latestVideo = await prisma.video.findUnique({ where: { id: job.videoId } });
  const finalPublishedUrl = publishedUrl ?? latestVideo?.tiktokPublishedUrl ?? undefined;

  if (!finalPublishedUrl) {
    const errorMessage =
      "TikTok was published but its public video URL could not be resolved; Facebook/YouTube were not released.";
    await prisma.uploadJob.update({ where: { id: job.id }, data: { errorMessage } });
    await failWaitingDownstream(job.videoId, errorMessage);
    return;
  }

  const downloadDir = path.resolve(
    process.env.TIKTOK_DOWNLOAD_DIR ?? ".social-automation/tiktok-downloads",
  );
  const preferredDownloadPath = path.join(downloadDir, `${job.videoId}.mp4`);

  try {
    let downloadedPath = latestVideo?.tiktokDownloadedPath ?? undefined;

    if (!downloadedPath) {
      try {
        downloadedPath = await downloadTikTokVideoWithPlaywright(
          finalPublishedUrl,
          preferredDownloadPath,
        );
        console.log(`[TikTok Worker] Playwright download completed: ${downloadedPath}`);
      } catch (playwrightError) {
        console.warn(
          `[TikTok Worker] Playwright download failed; falling back to yt-dlp: ${
            playwrightError instanceof Error ? playwrightError.message : String(playwrightError)
          }`,
        );
        downloadedPath = await downloadTikTokVideoWithYtDlp(job.videoId, finalPublishedUrl);
      }
    }

    await prisma.video.update({
      where: { id: job.videoId },
      data: {
        tiktokPublishedUrl: finalPublishedUrl,
        tiktokDownloadedPath: downloadedPath,
        outputPath: downloadedPath,
      },
    });

    await releaseDownstream(downstreamJobs);
  } catch (error) {
    const errorMessage =
      `TikTok published successfully but downstream source download failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
    await prisma.uploadJob.update({ where: { id: job.id }, data: { errorMessage } });
    await failWaitingDownstream(job.videoId, errorMessage);
  }
}, { connection, concurrency: 1 });

const facebookWorker = new Worker<{ publishJobId: string }>(PUBLISH_QUEUES.facebook, async queueJob => {
  const job = await loadPublishJob(queueJob.data.publishJobId);
  if (!job) return;
  await markPublishing(job.id);

  try {
    const hashtags = job.video.hashtags.map(tag => `#${tag}`).join(" ");
    const description = [job.video.description, hashtags].filter(Boolean).join("\n\n");
    const videoState = job.publishMode === PublishMode.DRAFT ? "DRAFT" : "PUBLISHED";
    const contentType = job.facebookContentType === FacebookContentType.VIDEO_POST
      ? "VIDEO_POST"
      : "REEL";

    const result = await new FacebookReelsPublisher(loadFacebookConfig()).publish({
      filePath: resolvePublishSource(job),
      title: job.video.title,
      description,
      tags: job.video.hashtags,
    }, videoState, contentType);

    await markPublished(job.id, result.externalId, result.raw, job.publishMode);
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
      filePath: resolvePublishSource(job),
      title: job.video.title,
      description: job.video.description,
      tags: job.video.hashtags,
    }, {
      privacy: job.publishMode === PublishMode.DRAFT ? "private" : "public",
      madeForKids: (process.env.YOUTUBE_DEFAULT_MADE_FOR_KIDS ?? "false").toLowerCase() === "true",
    });

    await markPublished(job.id, result.externalId, result.raw, job.publishMode);
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

async function recoverScheduledPublishJobs() {
  try {
    const scheduledJobs = await prisma.publishJob.findMany({
      where: { status: { in: [PublishStatus.SCHEDULED, PublishStatus.READY_TO_RUN] } },
    });
    for (const job of scheduledJobs) {
      const queue = job.platform === Platform.FACEBOOK ? facebookQueue : youtubeQueue;
      const queueJob = await queue.getJob(job.id);
      if (!queueJob) {
        const delay = Math.max(0, (job.publishTime?.getTime() ?? 0) - Date.now());
        await queue.add("publish", { publishJobId: job.id }, {
          jobId: job.id,
          delay,
          removeOnComplete: 100,
          removeOnFail: 100,
        });
        console.log(`[Worker Recovery] Enqueued scheduled job ${job.id} for ${job.platform}`);
      }
    }
  } catch (error) {
    console.error("[Worker Recovery] Error recovering scheduled jobs:", error);
  }
}

recoverScheduledPublishJobs();

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
  return prisma.publishJob.findUnique({
    where: { id },
    include: { video: true },
  });
}

type LoadedPublishJob = NonNullable<Awaited<ReturnType<typeof loadPublishJob>>>;

function resolvePublishSource(job: LoadedPublishJob): string {
  if (!job.useTikTokSource) return job.video.sourcePath;

  if (!job.video.tiktokDownloadedPath) {
    throw new Error(
      `Publish job ${job.id} requires the TikTok-downloaded source, but tiktokDownloadedPath is empty. Refusing to fall back to the original file.`,
    );
  }

  return job.video.tiktokDownloadedPath;
}

async function releaseDownstream(
  jobs: Array<{ id: string; platform: Platform }>,
): Promise<void> {
  for (const downstream of jobs) {
    const updated = await prisma.publishJob.update({
      where: { id: downstream.id },
      data: {
        status: PublishStatus.READY_TO_RUN,
        errorMessage: null,
        finishedAt: null,
      },
    });

    const queue = updated.platform === Platform.FACEBOOK ? facebookQueue : youtubeQueue;
    try {
      await queue.add("publish", { publishJobId: updated.id }, {
        jobId: `${updated.id}:after-tiktok`,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    } catch (error) {
      await markPublishFailed(updated.id, error);
      throw error;
    }
  }
}

async function failWaitingDownstream(videoId: string, errorMessage: string) {
  await prisma.publishJob.updateMany({
    where: {
      videoId,
      status: { in: [PublishStatus.WAITING_SOURCE, PublishStatus.WAITING_TIKTOK_SOURCE] },
      platform: { in: [Platform.FACEBOOK, Platform.YOUTUBE] },
    },
    data: {
      status: PublishStatus.FAILED,
      finishedAt: new Date(),
      errorMessage,
    },
  });
}

async function downloadTikTokVideoWithPlaywright(
  url: string,
  outputPath: string,
): Promise<string> {
  const adapter = new PlaywrightTikTokDraftAdapter(
    tiktokConfig,
    path.resolve(tiktokConfig.artifactDir),
  );

  console.log("[TikTok Worker] Opening a fresh Playwright browser for the download step...");
  await adapter.open();
  try {
    return await adapter.downloadPublishedVideo(url, outputPath);
  } finally {
    await adapter.close().catch(() => undefined);
  }
}

async function downloadTikTokVideoWithYtDlp(videoId: string, url: string): Promise<string> {
  const downloadDir = path.resolve(
    process.env.TIKTOK_DOWNLOAD_DIR ?? ".social-automation/tiktok-downloads",
  );
  await mkdir(downloadDir, { recursive: true });

  const outputPath = path.join(downloadDir, `${videoId}.mp4`);
  const executable = process.env.YT_DLP_EXECUTABLE ?? "yt-dlp";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [
      "--no-playlist",
      "--force-overwrites",
      "-f", "bv*+ba/b",
      "--merge-output-format", "mp4",
      "-o", outputPath,
      url,
    ], {
      stdio: ["ignore", "inherit", "inherit"],
    });

    child.once("error", error => {
      reject(new Error(
        `Could not start ${executable}. Install yt-dlp or set YT_DLP_EXECUTABLE. ${error.message}`,
      ));
    });

    child.once("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`${executable} exited with code ${code ?? "unknown"}`));
    });
  });

  return outputPath;
}

async function markPublishing(jobId: string) {
  await prisma.publishJob.update({
    where: { id: jobId },
    data: { status: PublishStatus.PUBLISHING, startedAt: new Date(), errorMessage: null },
  });
}

async function markPublished(
  jobId: string,
  externalId: string,
  raw: unknown,
  publishMode?: PublishMode,
) {
  const status = publishMode === PublishMode.DRAFT
    ? PublishStatus.DRAFT_SAVED
    : PublishStatus.PUBLISHED;
  await prisma.publishJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: new Date(),
      response: { externalId, raw } as Prisma.InputJsonValue,
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
    VideoStatus.PUBLISHED,
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
  if (state === "PUBLISHING") return VideoStatus.PUBLISHING;
  if (state === "PUBLISHED") return VideoStatus.PUBLISHED;
  if (state === "LOGIN_REQUIRED") return VideoStatus.LOGIN_REQUIRED;
  if (state === "AMBIGUOUS") return VideoStatus.AMBIGUOUS;
  if (state === "SAVING_DRAFT") return VideoStatus.SAVING_DRAFT;
  if (state === "VERIFYING") return VideoStatus.VERIFYING;
  if (state === "UPLOADING") return VideoStatus.UPLOADING;
  return VideoStatus.FAILED;
}
