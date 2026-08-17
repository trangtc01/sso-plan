import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Get() async check() { await this.prisma.$queryRaw`SELECT 1`; return { status: "ok" }; }
}
