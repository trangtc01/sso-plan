import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { VideoStatus } from "@prisma/client";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage, memoryStorage } from "multer";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { CreateVideoDto, RerunDto } from "./videos.dto.js";
import { VideosService } from "./videos.service.js";

const uploadDir = path.resolve(process.env.VIDEO_STORAGE_DIR ?? ".tiktok-automation/uploads");
mkdirSync(uploadDir, { recursive: true });

@Controller("videos")
export class VideosController {
  constructor(@Inject(VideosService) private readonly videos: VideosService) {}

  @Get()
  list(
    @Query("page") page?: string,
    @Query("perPage") perPage?: string,
    @Query("status") status?: VideoStatus,
  ) {
    return this.videos.list(Number(page ?? 1), Number(perPage ?? 20), status);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.videos.detail(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: uploadDir,
      filename: (_req, file, done) => done(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: Number(process.env.TIKTOK_MAX_FILE_BYTES ?? 2 * 1024 * 1024 * 1024) },
    fileFilter: (_req, file, done) => {
      const extension = path.extname(file.originalname).toLowerCase();
      done(null, [".mp4", ".mov"].includes(extension) && ["video/mp4", "video/quicktime"].includes(file.mimetype));
    },
  }))
  create(@UploadedFile() file: Express.Multer.File, @Body() body: CreateVideoDto) {
    if (!file) throw new BadRequestException("A valid MP4 or MOV file is required");
    return this.videos.create({ ...body, sourcePath: file.path });
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file", {
    storage: memoryStorage(),
    limits: { fileSize: Number(process.env.BULK_IMPORT_MAX_BYTES ?? 1024 * 1024) },
    fileFilter: (_req, file, done) => {
      const lower = file.originalname.toLowerCase();
      done(null, lower.endsWith(".txt") || lower.endsWith(".csv"));
    },
  }))
  importTxt(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("A .txt or .csv import file is required");
    return this.videos.importTxt(file.buffer.toString("utf8"), file.originalname);
  }

  @Post("jobs/:jobId/rerun")
  rerun(@Param("jobId") jobId: string, @Body() body: RerunDto) {
    return this.videos.rerun(jobId, body.confirmNoDraft);
  }

  @Post("publish-jobs/:jobId/rerun")
  rerunPublish(@Param("jobId") jobId: string) {
    return this.videos.rerunPublish(jobId);
  }
}
