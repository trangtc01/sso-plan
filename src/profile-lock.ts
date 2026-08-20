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
      let ownerStr = "unknown";
      let ownerPid: number | undefined;
      try {
        ownerStr = (await readFile(path.join(lockDir, "owner.json"), "utf8")).trim();
        const parsed = JSON.parse(ownerStr);
        if (typeof parsed.pid === "number") ownerPid = parsed.pid;
      } catch { /* best effort */ }

      if (ownerPid) {
        try {
          process.kill(ownerPid, 0);
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code === "ESRCH") {
            // Process no longer exists; remove stale lock and acquire
            await rm(lockDir, { recursive: true, force: true }).catch(() => undefined);
            await mkdir(lockDir);
            await writeFile(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
            return { async release() { await rm(lockDir, { recursive: true, force: true }); } };
          }
        }
      }

      throw new ProfileLockedError(`TikTok profile is already in use (${ownerStr})`);
    }
    throw error;
  }
  await writeFile(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
  return { async release() { await rm(lockDir, { recursive: true, force: true }); } };
}
