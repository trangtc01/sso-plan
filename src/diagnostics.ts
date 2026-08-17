import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunJournal, RunState } from "./types.js";

const redact = (value: unknown): string => JSON.stringify(value, (key, item) => {
  if (/cookie|token|authorization|credential|password/i.test(key)) return "[REDACTED]";
  if (typeof item === "string") return item
    .replace(/\b(cookie|token|authorization|credential|password)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]");
  return item;
});

export class Diagnostics {
  readonly runDir: string;
  readonly journalPath: string;
  readonly logPath: string;

  constructor(private readonly artifactDir: string, readonly journal: RunJournal) {
    this.runDir = path.join(artifactDir, journal.runId);
    this.journalPath = path.join(this.runDir, "journal.json");
    this.logPath = path.join(this.runDir, "run.jsonl");
  }

  async initialize(): Promise<void> { await mkdir(this.runDir, { recursive: true }); await this.persist(); }
  async transition(state: RunState, error: string | null = null): Promise<void> {
    this.journal.state = state; this.journal.lastCompletedStep = state; this.journal.error = error;
    await this.log({ level: error ? "error" : "info", state, error }); await this.persist();
  }
  async finish(state: RunState, error: string | null = null): Promise<void> {
    this.journal.finishedAt = new Date().toISOString(); await this.transition(state, error);
  }
  async log(record: Record<string, unknown>): Promise<void> { await appendFile(this.logPath, `${redact({ timestamp: new Date().toISOString(), ...record })}\n`); }
  private async persist(): Promise<void> {
    const temporaryPath = `${this.journalPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, redact(this.journal)); await rename(temporaryPath, this.journalPath);
  }
}
