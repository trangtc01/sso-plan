import { BadRequestException } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";

const transitions: Record<VideoStatus, readonly VideoStatus[]> = {
  UPLOADED: [VideoStatus.QUEUED], QUEUED: [VideoStatus.UPLOADING],
  UPLOADING: [VideoStatus.SAVING_DRAFT, VideoStatus.PUBLISHING, VideoStatus.FAILED, VideoStatus.LOGIN_REQUIRED],
  PUBLISHING: [VideoStatus.VERIFYING, VideoStatus.AMBIGUOUS, VideoStatus.FAILED],
  SAVING_DRAFT: [VideoStatus.VERIFYING, VideoStatus.AMBIGUOUS],
  VERIFYING: [VideoStatus.DRAFT_SAVED, VideoStatus.PUBLISHED, VideoStatus.AMBIGUOUS],
  DRAFT_SAVED: [], PUBLISHED: [], FAILED: [VideoStatus.QUEUED], LOGIN_REQUIRED: [VideoStatus.QUEUED], AMBIGUOUS: [VideoStatus.QUEUED],
};

export function assertTransition(from: VideoStatus, to: VideoStatus): void {
  if (from === to || transitions[from].includes(to)) return;
  throw new BadRequestException(`invalid upload-job transition: ${from} -> ${to}`);
}

export function isTerminal(status: VideoStatus): boolean { return ([VideoStatus.DRAFT_SAVED, VideoStatus.PUBLISHED, VideoStatus.FAILED, VideoStatus.LOGIN_REQUIRED, VideoStatus.AMBIGUOUS] as VideoStatus[]).includes(status); }
