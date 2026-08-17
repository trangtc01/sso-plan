import { Module } from "@nestjs/common";
import { VideosController } from "./videos.controller.js";
import { VideosService } from "./videos.service.js";
import { PrismaService } from "./prisma.service.js";
import { HealthController } from "./health.controller.js";

@Module({ controllers: [VideosController, HealthController], providers: [VideosService, PrismaService] })
export class AppModule {}
