import { BadRequestException } from "@nestjs/common";
import { VideoStatus } from "@prisma/client";
import { TERMINAL_VIDEO_STATUSES, VIDEO_STATUS_TRANSITIONS } from "./constants.js";

export function assertTransition(from: VideoStatus, to: VideoStatus): void {
  if (from === to || VIDEO_STATUS_TRANSITIONS[from].includes(to)) return;
  throw new BadRequestException(`invalid upload-job transition: ${from} -> ${to}`);
}

export function isTerminal(status: VideoStatus): boolean {
  return TERMINAL_VIDEO_STATUSES.includes(status);
}
