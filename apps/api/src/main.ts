import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.enableCors({ origin: process.env.ADMIN_ORIGIN ?? "http://localhost:3000" });
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
await app.listen(Number(process.env.API_PORT ?? 3001));
