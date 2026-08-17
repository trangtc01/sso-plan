-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADED', 'QUEUED', 'UPLOADING', 'SAVING_DRAFT', 'VERIFYING', 'DRAFT_SAVED', 'FAILED', 'LOGIN_REQUIRED', 'AMBIGUOUS');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT[],
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadJob" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'QUEUED',
    "logPath" TEXT,
    "screenshotPath" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "UploadAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadAttempt_jobId_number_key" ON "UploadAttempt"("jobId", "number");

-- AddForeignKey
ALTER TABLE "UploadJob" ADD CONSTRAINT "UploadJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAttempt" ADD CONSTRAINT "UploadAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "UploadJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
