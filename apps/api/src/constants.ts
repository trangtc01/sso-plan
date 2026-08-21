import { VideoStatus } from "@prisma/client";
import path from "node:path";
import { PUBLISH_QUEUES } from "../../../src/publish-queues.js";

export const QUEUES = {
  voice: "voice",
  render: "render",
  facebook: PUBLISH_QUEUES.facebook,
  youtube: PUBLISH_QUEUES.youtube,
  tiktok: PUBLISH_QUEUES.tiktok,
  cleanup: "cleanup",
} as const;

export const RERUNNABLE_VIDEO_STATUSES = new Set<VideoStatus>([
  VideoStatus.FAILED,
  VideoStatus.LOGIN_REQUIRED,
]);

export const VIDEO_STATUS_TRANSITIONS: Record<VideoStatus, readonly VideoStatus[]> = {
  UPLOADED: [VideoStatus.QUEUED],
  QUEUED: [VideoStatus.UPLOADING],
  UPLOADING: [
    VideoStatus.SAVING_DRAFT,
    VideoStatus.PUBLISHING,
    VideoStatus.FAILED,
    VideoStatus.LOGIN_REQUIRED,
  ],
  PUBLISHING: [VideoStatus.VERIFYING, VideoStatus.AMBIGUOUS, VideoStatus.FAILED],
  SAVING_DRAFT: [VideoStatus.VERIFYING, VideoStatus.AMBIGUOUS],
  VERIFYING: [VideoStatus.DRAFT_SAVED, VideoStatus.PUBLISHED, VideoStatus.AMBIGUOUS],
  DRAFT_SAVED: [],
  PUBLISHED: [],
  FAILED: [VideoStatus.QUEUED],
  LOGIN_REQUIRED: [VideoStatus.QUEUED],
  AMBIGUOUS: [VideoStatus.QUEUED],
};

export const TERMINAL_VIDEO_STATUSES: readonly VideoStatus[] = [
  VideoStatus.DRAFT_SAVED,
  VideoStatus.PUBLISHED,
  VideoStatus.FAILED,
  VideoStatus.LOGIN_REQUIRED,
  VideoStatus.AMBIGUOUS,
];

export const STORAGE_DIR = path.resolve(
  process.env.VIDEO_STORAGE_DIR ?? ".tiktok-automation/uploads"
);
