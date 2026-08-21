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
import { parseBoolean } from "./parse-boolean.js";
import { QUEUES, RERUNNABLE_VIDEO_STATUSES, STORAGE_DIR } from "./constants.js";
import type { CreateVideoInput } from "./types.js";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
const tiktokQueue = new Queue(QUEUES.tiktok, { connection });
const facebookQueue = new Queue(QUEUES.facebook, { connection });
const youtubeQueue = new Queue(QUEUES.youtube, { connection });

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

  async create(input: CreateVideoInput) {
    const platforms = normalizePlatforms(input.platforms);
    const publishTime = normalizePublishTime(input.publishAt);
    const hasTikTok = platforms.includes(Platform.TIKTOK);
    const hasDownstream = platforms.some(platform => platform !== Platform.TIKTOK);
    const tiktokUseSound = parseBoolean(input.tiktokUseSound, true);
    const facebookUseTikTokSource =
      platforms.includes(Platform.FACEBOOK) &&
      parseBoolean(input.facebookUseTikTokSource, false);
    const youtubeUseTikTokSource =
      platforms.includes(Platform.YOUTUBE) &&
      parseBoolean(input.youtubeUseTikTokSource, false);
    const needsTikTokSource = facebookUseTikTokSource || youtubeUseTikTokSource;
    const tiktokPublishMode = input.tiktokPublishMode
      ?? (needsTikTokSource ? PublishMode.PUBLIC : PublishMode.DRAFT);

    if (needsTikTokSource && !hasTikTok) {
      throw new BadRequestException(
        "Facebook/YouTube can only use the TikTok video source when TikTok is also selected.",
      );
    }

    if (needsTikTokSource && tiktokPublishMode !== PublishMode.PUBLIC) {
      throw new BadRequestException(
        "TikTok must be PUBLIC when Facebook or YouTube is configured to use the TikTok video source.",
      );
    }

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
            data: {
              videoId: video.id,
              status: VideoStatus.QUEUED,
              publishMode: tiktokPublishMode,
              useSound: tiktokUseSound,
              publishTime,
            },
          })
        : null;

      const publishJobs = [];
      for (const platform of platforms.filter(item => item !== Platform.TIKTOK)) {
        const publishMode = platform === Platform.FACEBOOK
          ? input.facebookPublishMode ?? PublishMode.PUBLIC
          : input.youtubePublishMode ?? PublishMode.PUBLIC;
        const useTikTokSource = platform === Platform.FACEBOOK
          ? facebookUseTikTokSource
          : youtubeUseTikTokSource;

        publishJobs.push(await tx.publishJob.create({
          data: {
            videoId: video.id,
            platform,
            publishMode,
            facebookContentType: platform === Platform.FACEBOOK
              ? input.facebookContentType ?? FacebookContentType.REEL
              : null,
            useTikTokSource,
            publishTime,
            status: useTikTokSource
              ? PublishStatus.WAITING_TIKTOK_SOURCE
              : PublishStatus.SCHEDULED,
          },
        }));
      }

      return { video, tiktokJob, publishJobs };
    });

    const delay = delayUntil(publishTime);
    if (result.tiktokJob) {
      await tiktokQueue.add("tiktok-publish", { jobId: result.tiktokJob.id }, {
        jobId: result.tiktokJob.id,
        delay,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    }

    for (const job of result.publishJobs) {
      if (job.status === PublishStatus.SCHEDULED || job.status === PublishStatus.READY_TO_RUN) {
        await publishQueue(job.platform).add("publish", { publishJobId: job.id }, {
          jobId: job.id,
          delay,
          removeOnComplete: 100,
          removeOnFail: 100,
        });
      }
    }

    return result;
  }

  async importTxt(text: string, fileName = "import.txt") {
    let rows;
    try {
      rows = parseBulkImportText(text, {
        baseDir: process.env.BULK_VIDEO_BASE_DIR,
        timezoneOffset: process.env.BULK_IMPORT_TIMEZONE_OFFSET ?? "+07:00",
        format: fileName.toLowerCase().endsWith(".csv") ? "csv" : "tsv",
      });
    } catch (error) {
      if (error instanceof BulkImportParseError) throw new BadRequestException(error.problems);
      throw error;
    }

    const items: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      try {
        const stagedPath = await stageImportedVideo(row.sourcePath, STORAGE_DIR);
        const created = await this.create({
          title: row.title,
          description: row.description,
          hashtags: row.hashtags,
          sourcePath: stagedPath,
          platforms: row.platforms,
          publishAt: row.publishAt,
          tiktokPublishMode: row.tiktokPublishMode,
          tiktokUseSound: row.tiktokUseSound,
          facebookPublishMode: row.facebookPublishMode,
          facebookContentType: row.facebookContentType,
          facebookUseTikTokSource: row.facebookUseTikTokSource,
          youtubePublishMode: row.youtubePublishMode,
          youtubeUseTikTokSource: row.youtubeUseTikTokSource,
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
    if (!RERUNNABLE_VIDEO_STATUSES.has(job.status) && job.status !== VideoStatus.AMBIGUOUS) {
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
    await tiktokQueue.add("tiktok-publish", { jobId }, {
      jobId: `${jobId}:retry:${updated.retryCount}`,
      delay: delayUntil(job.publishTime ?? new Date()),
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return updated;
  }

  async rerunPublish(jobId: string) {
    const job = await this.prisma.publishJob.findUnique({
      where: { id: jobId },
      include: { video: true },
    });
    if (!job) throw new NotFoundException("publish job not found");
    if (job.status !== PublishStatus.FAILED) {
      throw new BadRequestException(`publish job cannot be rerun from ${job.status}`);
    }
    if (job.useTikTokSource && !job.video.tiktokDownloadedPath) {
      throw new BadRequestException(
        "This publish job requires the downloaded TikTok source, but no TikTok-downloaded file is available. Rerun the TikTok/download flow first.",
      );
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

  async previewPlaywright(id: string, targetPlatform?: string) {
    const video = await this.detail(id);
    const mode = (targetPlatform || "file").toLowerCase();

    let targetUrl = "";
    let userDataDir = "";

    const filePath = video.outputPath || video.sourcePath;

    if (mode === "tiktok") {
      targetUrl = video.tiktokPublishedUrl || "https://www.tiktok.com/tiktokstudio/upload";
      userDataDir = path.resolve(process.env.TIKTOK_PROFILE_DIR ?? "./.tiktok-automation/profile");
    } else if (mode === "youtube") {
      targetUrl = process.env.YOUTUBE_PREVIEW_URL || "https://studio.youtube.com";
      userDataDir = path.resolve(process.env.YOUTUBE_PROFILE_DIR ?? "./.social-automation/youtube-profile");
    } else {
      if (!filePath) throw new BadRequestException("No valid video file path found for preview");
      targetUrl = `file://${path.resolve(filePath)}`;
    }

    try {
      const { chromium } = await import("playwright");
      let context;
      if (userDataDir) {
        context = await chromium.launchPersistentContext(userDataDir, {
          headless: false,
          viewport: null,
          args: ["--start-maximized"],
        });
      } else {
        const browser = await chromium.launch({ headless: false });
        context = await browser.newContext();
      }

      const page = context.pages()[0] || await context.newPage();
      if (mode === "file" || !userDataDir) {
        const absolutePath = path.resolve(filePath);
        const fileUrl = `file://${absolutePath}`;
        const html = `<!DOCTYPE html>
<html>
<head><title>Preview Video - SSO Plan</title></head>
<body style="margin:0; background:#0f172a; display:flex; align-items:center; justify-content:center; height:100vh;">
  <video src="${fileUrl}" controls autoplay style="max-width:95vw; max-height:95vh; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);"></video>
</body>
</html>`;
        await page.setContent(html);
        return { ok: true, platform: mode, targetUrl: fileUrl };
      }

      await page.goto(targetUrl);
      return { ok: true, platform: mode, targetUrl };
    } catch (error) {
      throw new BadRequestException(
        `Could not launch Playwright browser for ${mode}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function normalizePlatforms(platforms?: unknown): Platform[] {
  let list: string[] = [];
  if (Array.isArray(platforms)) {
    list = platforms.flatMap(item => parsePlatformString(item));
  } else if (typeof platforms === "string") {
    list = parsePlatformString(platforms);
  }

  const validPlatforms = Object.values(Platform) as string[];
  const filtered = list.filter((item): item is Platform => validPlatforms.includes(item));
  const result = [...new Set(filtered.length ? filtered : [Platform.TIKTOK])];
  if (!result.length) throw new BadRequestException("At least one platform is required");
  return result;
}

function parsePlatformString(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return value.split(",").map(item => item.trim()).filter(Boolean);
  }
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
