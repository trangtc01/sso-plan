ALTER TYPE "PublishStatus" ADD VALUE IF NOT EXISTS 'WAITING_SOURCE';

ALTER TABLE "Video"
ADD COLUMN "tiktokPublishedUrl" TEXT,
ADD COLUMN "tiktokDownloadedPath" TEXT;
