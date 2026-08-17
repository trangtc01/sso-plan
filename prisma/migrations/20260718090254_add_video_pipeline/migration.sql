-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('FACEBOOK', 'YOUTUBE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'VOICE_GENERATING', 'VOICE_READY', 'RENDERING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('QUEUED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'AMBIGUOUS');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "outputPath" TEXT,
ADD COLUMN     "subtitlePath" TEXT;

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "voicePath" TEXT,
    "musicPath" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishJob" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "publishTime" TIMESTAMP(3),
    "status" "PublishStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "response" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "displayName" TEXT NOT NULL,
    "credential" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expireTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Music" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Music_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishJob_platform_status_publishTime_idx" ON "PublishJob"("platform", "status", "publishTime");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccount_platform_displayName_key" ON "PlatformAccount"("platform", "displayName");

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
