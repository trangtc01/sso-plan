export const RUN_STATES = [
  "CREATED", "VALIDATING", "LAUNCHING_BROWSER", "CHECKING_SESSION",
  "OPENING_UPLOAD_PAGE", "UPLOADING", "READY_TO_SAVE", "SAVING_DRAFT",
  "PUBLISHING", "VERIFYING", "DRAFT_SAVED", "PUBLISHED", "INVALID_INPUT", "LOGIN_REQUIRED",
  "UPLOAD_FAILED", "SAVE_DRAFT_FAILED", "AMBIGUOUS",
] as const;

export type RunState = (typeof RUN_STATES)[number];

export interface RunJournal {
  runId: string;
  fileHash: string | null;
  state: RunState;
  startedAt: string;
  finishedAt: string | null;
  lastCompletedStep: RunState | null;
  error: string | null;
}

export interface ValidatedInput {
  path: string;
  fileHash: string;
  size: number;
}

export const EXIT_CODE = {
  SUCCESS: 0,
  INVALID_INPUT: 2,
  LOGIN_REQUIRED: 3,
  UPLOAD_FAILED: 4,
  AMBIGUOUS: 5,
  PROFILE_LOCKED: 6,
} as const;
