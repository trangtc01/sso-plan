import "dotenv/config";
import { Worker } from "bullmq";
import { PrismaClient, VideoStatus } from "@prisma/client";
import { loadConfig } from "../../../src/config.js";
import { runDraft } from "../../../src/run-draft.js";
import type { RunState } from "../../../src/types.js";

const prisma = new PrismaClient();
const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
const config = loadConfig();

const worker = new Worker<{ jobId: string }>("tiktok-draft", async queueJob => {
  const job = await prisma.uploadJob.findUnique({ where: { id: queueJob.data.jobId }, include: { video: true, attempts: true } });
  if (!job) return;
  const attempt = await prisma.uploadAttempt.create({ data: { jobId: job.id, number: job.attempts.length + 1, status: VideoStatus.UPLOADING, logPath: config.artifactDir } });
  await updateStatus(job.id, job.videoId, attempt.id, "UPLOADING");
  const caption = [job.video.description, ...job.video.hashtags.map(tag => `#${tag}`)].filter(Boolean).join(" ");
  const code = await runDraft({ filePath: job.video.sourcePath, caption, onState: async (state, error) => updateStatus(job.id, job.videoId, attempt.id, toDatabaseStatus(state), error) }, config);
  if (code !== 0) return; // status/error are persisted by runDraft; BullMQ must not blindly retry.
}, { connection, concurrency: 1 });

worker.on("failed", async (queueJob, error) => {
  const jobId = queueJob?.data.jobId; if (!jobId) return;
  const job = await prisma.uploadJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === VideoStatus.SAVING_DRAFT || job.status === VideoStatus.VERIFYING) return; // runDraft owns AMBIGUOUS transition
  await updateStatus(job.id, job.videoId, undefined, VideoStatus.FAILED, error.message);
});
worker.on("error", error => console.error("worker error", error));
process.on("SIGINT", async () => { await worker.close(); await prisma.$disconnect(); process.exit(0); });

async function updateStatus(jobId: string, videoId: string, attemptId: string | undefined, status: VideoStatus, error?: string) {
  const completed = ([VideoStatus.DRAFT_SAVED, VideoStatus.FAILED, VideoStatus.LOGIN_REQUIRED, VideoStatus.AMBIGUOUS] as VideoStatus[]).includes(status);
  await prisma.$transaction([
    prisma.uploadJob.update({ where: { id: jobId }, data: { status, errorMessage: error ?? null, startedAt: status === VideoStatus.UPLOADING ? new Date() : undefined, finishedAt: completed ? new Date() : undefined } }),
    prisma.video.update({ where: { id: videoId }, data: { status } }),
    ...(attemptId ? [prisma.uploadAttempt.update({ where: { id: attemptId }, data: { status, errorMessage: error ?? null, finishedAt: completed ? new Date() : undefined } })] : []),
  ]);
}

function toDatabaseStatus(state: RunState): VideoStatus {
  if (state === "DRAFT_SAVED") return VideoStatus.DRAFT_SAVED;
  if (state === "LOGIN_REQUIRED") return VideoStatus.LOGIN_REQUIRED;
  if (state === "AMBIGUOUS") return VideoStatus.AMBIGUOUS;
  if (state === "SAVING_DRAFT") return VideoStatus.SAVING_DRAFT;
  if (state === "VERIFYING") return VideoStatus.VERIFYING;
  return VideoStatus.FAILED;
}
