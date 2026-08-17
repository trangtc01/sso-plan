import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ProfileLockedError } from "./errors.js";

export interface ProfileLock { release(): Promise<void>; }

export async function acquireProfileLock(profileDir: string): Promise<ProfileLock> {
  const lockDir = `${profileDir}.lock`;
  await mkdir(path.dirname(lockDir), { recursive: true });
  try {
    await mkdir(lockDir);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      let owner = "unknown";
      try { owner = (await readFile(path.join(lockDir, "owner.json"), "utf8")).trim(); } catch { /* best effort */ }
      throw new ProfileLockedError(`TikTok profile is already in use (${owner})`);
    }
    throw error;
  }
  await writeFile(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
  return { async release() { await rm(lockDir, { recursive: true, force: true }); } };
}
