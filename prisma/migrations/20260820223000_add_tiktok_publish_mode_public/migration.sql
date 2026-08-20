-- Existing TikTok UploadJob rows remain Draft for backward safety.
ALTER TYPE "VideoStatus" ADD VALUE IF NOT EXISTS 'PUBLISHING';
ALTER TYPE "VideoStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';

ALTER TABLE "UploadJob"
ADD COLUMN "publishMode" "PublishMode" NOT NULL DEFAULT 'DRAFT';
