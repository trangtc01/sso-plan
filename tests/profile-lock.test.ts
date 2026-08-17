import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ProfileLockedError } from "../src/errors.js";
import { acquireProfileLock } from "../src/profile-lock.js";

test("acquireProfileLock rejects a second runner and releases safely", async () => {
  const profile = path.join(await mkdtemp(path.join(os.tmpdir(), "tiktok-lock-test-")), "profile");
  const lock = await acquireProfileLock(profile);
  await assert.rejects(() => acquireProfileLock(profile), ProfileLockedError);
  await lock.release();
  const afterRelease = await acquireProfileLock(profile);
  await afterRelease.release();
});
