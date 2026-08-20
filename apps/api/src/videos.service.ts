import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  FacebookContentType,
  Platform,
  PublishMode,
  PublishStatus,
  VideoStatus,
} from "@prisma/client";
import { Queue } from "bullmq";
import path from "node:path";
import { PrismaService } from "./prisma.service.js";
import { normalizeHashtags } from "./hashtags.js";
import { assertTransition } from "./job-state.js";
import { BulkImportParseError, parseBulkImportText, stageImportedVideo } from "./bulk-import.js";
import { PUBLISH_QUEUES } from "../../../src/publish-queues.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
const tiktokQueue = new Queue(PUBLISH_QUEUES.tiktok, { connection });
const facebookQueue = new Queue(PUBLISH_QUEUES.facebook, { connection });
const youtubeQueue = new Queue(PUBLISH_QUEUES.youtube, { connection });
const rerunnable = new Set<VideoStatus>([VideoStatus.FAILED, VideoStatus.LOGIN_REQUIRED]);
const storageDir = path.resolve(process.env.VIDEO_STORAGE_DIR ?? ".tiktok-automation/uploads");

interface CreateInput {
  title: string;
  description: string;
  hashtags: string[] | string;
  sourcePath: string;
  platforms?: Platform[];
  publishAt?: string;
  facebookPublishMode?: PublishMode;
  facebookContentType?: FacebookContentType;
  youtubePublishMode?: PublishMode;
}

@Injectable()
export class VideosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(page = 1, perPage = 20, status?: VideoStatus) {
    const take = Math.min(Math.max(perPage, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where = status ? { status } : undefined;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.video.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          jobs: { orderBy: { createdAt: "desc" }, take: 5 },
          publishJobs: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      }),
      this.prisma.video.count({ where }),
    ]);
    return { items, page: Math.max(page, 1), perPage: take, total };
  }

  async detail(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        jobs: { orderBy: { createdAt: "desc" }, include: { attempts: { orderBy: { number: "desc" } } } },
        publishJobs: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!video) throw new NotFoundException("video not found");
    return video;
  }

  async create(input: CreateInput) {
    const platforms = normalizePlatforms(input.platforms);
    const publishTime = normalizePublishTime(input.publishAt);
    if (platforms.includes(Platform.YOUTUBE) && input.title.length > 100) {
      throw new BadRequestException("YouTube title must be <= 100 characters");
    }

    const result = await this.prisma.$transaction(async tx => {
      const video = await tx.video.create({
        data: {
          title: input.title,
          description: input.description,
          hashtags: normalizeHashtags(input.hashtags),
          sourcePath: input.sourcePath,
          status: platforms.includes(Platform.TIKTOK) ? VideoStatus.QUEUED : VideoStatus.UPLOADED,
        },
      });

      const tiktokJob = platforms.includes(Platform.TIKTOK)
        ? await tx.uploadJob.create({
            data: { videoId: video.id, status: VideoStatus.QUEUED, publishTime },
          })
        : null;

      const publishJobs = [];
      for (const platform of platforms.filter(item => item !== Platform.TIKTOK)) {
        const publishMode = platform === Platform.FACEBOOK
          ? input.facebookPublishMode ?? PublishMode.PUBLIC
          : input.youtubePublishMode ?? PublishMode.PUBLIC;

        publishJobs.push(await tx.publishJob.create({
          data: {
            videoId: video.id,
            platform,
            publishMode,
            facebookContentType: platform === Platform.FACEBOOK
              ? input.facebookContentType ?? FacebookContentType.REEL
              : null,
            publishTime,
            status: PublishStatus.SCHEDULED,
          },
        }));
      }

      return { video, tiktokJob, publishJobs };
    });

    const delay = delayUntil(publishTime);
    if (result.tiktokJob) {
      await tiktokQueue.add("upload-draft", { jobId: result.tiktokJob.id }, {
        jobId: result.tiktokJob.id,
        delay,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    }

    for (const job of result.publishJobs) {
      await publishQueue(job.platform).add("publish", { publishJobId: job.id }, {
        jobId: job.id,
        delay,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    }

    return result;
  }

  async importTxt(text: string) {
    let rows;
    try {
      rows = parseBulkImportText(text, {
        baseDir: process.env.BULK_VIDEO_BASE_DIR,
        timezoneOffset: process.env.BULK_IMPORT_TIMEZONE_OFFSET ?? "+07:00",
      });
    } catch (error) {
      if (error instanceof BulkImportParseError) throw new BadRequestException(error.problems);
      throw error;
    }

    const items: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      try {
        const stagedPath = await stageImportedVideo(row.sourcePath, storageDir);
        const created = await this.create({
          title: row.title,
          description: row.description,
          hashtags: row.hashtags,
          sourcePath: stagedPath,
          platforms: row.platforms,
          publishAt: row.publishAt,
        });
        items.push({ line: row.line, ok: true, videoId: created.video.id });
      } catch (error) {
        items.push({ line: row.line, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return {
      total: rows.length,
      created: items.filter(item => item.ok).length,
      failed: items.filter(item => !item.ok).length,
      items,
    };
  }

  async rerun(jobId: string, confirmNoDraft: boolean) {
    const job = await this.prisma.uploadJob.findUnique({ where: { id: jobId }, include: { video: true } });
    if (!job) throw new NotFoundException("upload job not found");
    if (job.status === VideoStatus.AMBIGUOUS && !confirmNoDraft) {
      throw new BadRequestException("AMBIGUOUS requires confirmNoDraft=true after manual draft check");
    }
    if (!rerunnable.has(job.status) && job.status !== VideoStatus.AMBIGUOUS) {
      throw new BadRequestException(`job cannot be rerun from ${job.status}`);
    }

    assertTransition(job.status, VideoStatus.QUEUED);
    const updated = await this.prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: VideoStatus.QUEUED,
        retryCount: { increment: 1 },
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      },
    });
    await this.prisma.video.update({ where: { id: job.videoId }, data: { status: VideoStatus.QUEUED } });
    await tiktokQueue.add("upload-draft", { jobId }, {
      jobId: `${jobId}:retry:${updated.retryCount}`,
      delay: delayUntil(job.publishTime ?? new Date()),
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return updated;
  }

  async rerunPublish(jobId: string) {
    const job = await this.prisma.publishJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("publish job not found");
    if (job.status !== PublishStatus.FAILED) {
      throw new BadRequestException(`publish job cannot be rerun from ${job.status}`);
    }

    const updated = await this.prisma.publishJob.update({
      where: { id: jobId },
      data: {
        status: PublishStatus.SCHEDULED,
        retryCount: { increment: 1 },
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      },
    });
    await publishQueue(updated.platform).add("publish", { publishJobId: updated.id }, {
      jobId: `${updated.id}:retry:${updated.retryCount}`,
      delay: delayUntil(updated.publishTime ?? new Date()),
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return updated;
  }
}

function normalizePlatforms(platforms?: Platform[]): Platform[] {
  const result = [...new Set(platforms?.length ? platforms : [Platform.TIKTOK])];
  if (!result.length) throw new BadRequestException("At least one platform is required");
  return result;
}

function normalizePublishTime(value?: string): Date {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException("publishAt is invalid");
  return date;
}

function delayUntil(date: Date): number {
  return Math.max(0, date.getTime() - Date.now());
}

function publishQueue(platform: Platform): Queue {
  if (platform === Platform.FACEBOOK) return facebookQueue;
  if (platform === Platform.YOUTUBE) return youtubeQueue;
  throw new Error(`unsupported publish queue platform: ${platform}`);
}
