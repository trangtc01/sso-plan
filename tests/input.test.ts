import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { InputError } from "../src/errors.js";
import { validateVideoInput } from "../src/input.js";

async function fixture(name: string, data: Buffer): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tiktok-draft-test-"));
  const file = path.join(directory, name); await writeFile(file, data); return file;
}
const mp4Header = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);

test("validateVideoInput rejects a non-absolute path", async () => {
  await assert.rejects(() => validateVideoInput("video.mp4", 100), InputError);
});
test("validateVideoInput rejects directories", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tiktok-draft-test-"));
  await mkdir(path.join(directory, "video.mp4"));
  await assert.rejects(() => validateVideoInput(path.join(directory, "video.mp4"), 100), /regular file/);
});
test("validateVideoInput rejects empty and non-MP4 files", async () => {
  const empty = await fixture("empty.mp4", Buffer.alloc(0));
  const invalid = await fixture("invalid.mp4", Buffer.from("not an mp4"));
  await assert.rejects(() => validateVideoInput(empty, 100), /must not be empty/);
  await assert.rejects(() => validateVideoInput(invalid, 100), /not a valid/);
});
test("validateVideoInput accepts a non-empty MP4 container and hashes it", async () => {
  const file = await fixture("video.mp4", mp4Header);
  const result = await validateVideoInput(file, 100);
  assert.equal(result.path, file); assert.equal(result.size, mp4Header.length); assert.equal(result.fileHash.length, 64);
});
test("validateVideoInput accepts a MOV extension with an ISO Base Media container", async () => {
  const file = await fixture("video.mov", mp4Header);
  const result = await validateVideoInput(file, 100);
  assert.equal(result.path, file);
});
