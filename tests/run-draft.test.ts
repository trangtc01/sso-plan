import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { LoginRequiredError } from "../src/errors.js";
import { runDraft } from "../src/run-draft.js";
import type { TikTokDraftAdapter } from "../src/tiktok-adapter.js";
import { EXIT_CODE } from "../src/types.js";

const mp4Header = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
async function setup(): Promise<{ config: AppConfig; file: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "tiktok-run-test-"));
  const file = path.join(root, "video.mp4"); await writeFile(file, mp4Header);
  return { file, config: { profileDir: path.join(root, "profile"), artifactDir: path.join(root, "artifacts"), maxFileBytes: 100, uploadUrl: "https://example.test/upload" } };
}
class SuccessfulAdapter implements TikTokDraftAdapter {
  readonly calls: string[] = [];
  async open() { this.calls.push("open"); } async ensureAuthenticated() { this.calls.push("auth"); }
  async upload() { this.calls.push("upload"); } async setCaption() { this.calls.push("caption"); } async saveDraft() { this.calls.push("save"); }
  async verifyDraft() { this.calls.push("verify"); return true; }
  async publish() { this.calls.push("publish"); }
  async verifyPublished() { this.calls.push("verify-publish"); return true; }
  async screenshot(name: string) { this.calls.push(`screen:${name}`); }
  async close() { this.calls.push("close"); }
}
test("runDraft completes orchestration and journals DRAFT_SAVED", async () => {
  const { config, file } = await setup(); const adapter = new SuccessfulAdapter();
  assert.equal(await runDraft({ filePath: file }, config, () => adapter), EXIT_CODE.SUCCESS);
  assert.deepEqual(adapter.calls, ["open", "auth", "upload", "caption", "screen:before-save-draft", "save", "verify", "screen:verified-draft", "close"]);
  const [runId] = await (await import("node:fs/promises")).readdir(config.artifactDir);
  const journal = JSON.parse(await readFile(path.join(config.artifactDir, runId!, "journal.json"), "utf8"));
  assert.equal(journal.state, "DRAFT_SAVED");
});
test("runDraft returns LOGIN_REQUIRED without attempting upload", async () => {
  const { config, file } = await setup(); const adapter = new SuccessfulAdapter();
  adapter.ensureAuthenticated = async () => { throw new LoginRequiredError("token=secret"); };
  assert.equal(await runDraft({ filePath: file }, config, () => adapter), EXIT_CODE.LOGIN_REQUIRED);
  assert.deepEqual(adapter.calls, ["open", "screen:failure", "close"]);
  const [runId] = await (await import("node:fs/promises")).readdir(config.artifactDir);
  const log = await readFile(path.join(config.artifactDir, runId!, "run.jsonl"), "utf8");
  assert.doesNotMatch(log, /secret/);
  assert.match(log, /token=\[REDACTED\]/);
});

test("runDraft handles publishMode PUBLIC and journals PUBLISHED", async () => {
  const { config, file } = await setup(); const adapter = new SuccessfulAdapter();
  assert.equal(await runDraft({ filePath: file, publishMode: "PUBLIC" }, config, () => adapter), EXIT_CODE.SUCCESS);
  assert.deepEqual(adapter.calls, ["open", "auth", "upload", "caption", "screen:before-publish", "publish", "verify-publish", "screen:verified-published", "close"]);
  const [runId] = await (await import("node:fs/promises")).readdir(config.artifactDir);
  const journal = JSON.parse(await readFile(path.join(config.artifactDir, runId!, "journal.json"), "utf8"));
  assert.equal(journal.state, "PUBLISHED");
});
