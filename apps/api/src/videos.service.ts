import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { VideoStatus } from "@prisma/client";
import { PrismaService } from "./prisma.service.js";
import { normalizeHashtags } from "./hashtags.js";
import { assertTransition } from "./job-state.js";

const queue = new Queue("tiktok-draft", { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" } });
const rerunnable = new Set<VideoStatus>([VideoStatus.FAILED, VideoStatus.LOGIN_REQUIRED]);

@Injectable()
export class VideosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(page = 1, perPage = 20, status?: VideoStatus) {
    const take = Math.min(Math.max(perPage, 1), 100); const skip = (Math.max(page, 1) - 1) * take;
    const where = status ? { status } : undefined;
    const [items, total] = await this.prisma.$transaction([this.prisma.video.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { jobs: { orderBy: { createdAt: "desc" }, take: 1 } } }), this.prisma.video.count({ where })]);
    return { items, page: Math.max(page, 1), perPage: take, total };
  }
  async detail(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id }, include: { jobs: { orderBy: { createdAt: "desc" }, include: { attempts: { orderBy: { number: "desc" } } } } } });
    if (!video) throw new NotFoundException("video not found"); return video;
  }
  async create(input: { title: string; description: string; hashtags: string[] | string; sourcePath: string }) {
    const [video, job] = await this.prisma.$transaction(async tx => {
      const video = await tx.video.create({ data: { ...input, hashtags: normalizeHashtags(input.hashtags), status: VideoStatus.QUEUED } });
      const job = await tx.uploadJob.create({ data: { videoId: video.id, status: VideoStatus.QUEUED } }); return [video, job];
    });
    await queue.add("upload-draft", { jobId: job.id }, { jobId: job.id, removeOnComplete: 100, removeOnFail: 100 });
    return { video, job };
  }
  async rerun(jobId: string, confirmNoDraft: boolean) {
    const job = await this.prisma.uploadJob.findUnique({ where: { id: jobId }, include: { video: true } });
    if (!job) throw new NotFoundException("upload job not found");
    if (job.status === VideoStatus.AMBIGUOUS && !confirmNoDraft) throw new BadRequestException("AMBIGUOUS requires confirmNoDraft=true after manual draft check");
    if (!rerunnable.has(job.status) && job.status !== VideoStatus.AMBIGUOUS) throw new BadRequestException(`job cannot be rerun from ${job.status}`);
    assertTransition(job.status, VideoStatus.QUEUED);
    const updated = await this.prisma.uploadJob.update({ where: { id: jobId }, data: { status: VideoStatus.QUEUED, retryCount: { increment: 1 }, errorMessage: null, startedAt: null, finishedAt: null } });
    await this.prisma.video.update({ where: { id: job.videoId }, data: { status: VideoStatus.QUEUED } });
    await queue.add("upload-draft", { jobId }, { jobId: `${jobId}:retry:${updated.retryCount}`, removeOnComplete: 100, removeOnFail: 100 });
    return updated;
  }
}
