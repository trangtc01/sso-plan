import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import { Diagnostics } from "./diagnostics.js";
import { AmbiguousSaveError, InputError, LoginRequiredError, ProfileLockedError, UploadError } from "./errors.js";
import { validateVideoInput } from "./input.js";
import { acquireProfileLock } from "./profile-lock.js";
import { PlaywrightTikTokDraftAdapter, type TikTokDraftAdapter } from "./tiktok-adapter.js";
import { EXIT_CODE, type RunJournal, type RunState } from "./types.js";

export type AdapterFactory = (config: AppConfig, screenshotDir: string) => TikTokDraftAdapter;
export interface RunDraftOptions {
  filePath: string | undefined;
  caption?: string;
  publishMode?: "DRAFT" | "PUBLIC";
  onPublishedUrl?: (url: string | undefined) => Promise<void>;
  onState?: (state: RunState, error?: string) => Promise<void>;
  onStep?: (stepName: string) => Promise<void>;
}

export async function runDraft(options: RunDraftOptions, config: AppConfig, adapterFactory: AdapterFactory = (cfg, dir) => new PlaywrightTikTokDraftAdapter(cfg, dir)): Promise<number> {
  const journal: RunJournal = { runId: randomUUID(), fileHash: null, state: "CREATED", startedAt: new Date().toISOString(), finishedAt: null, lastCompletedStep: null, error: null };
  const diagnostics = new Diagnostics(config.artifactDir, journal);
  await diagnostics.initialize();
  let adapter: TikTokDraftAdapter | undefined;
  let lock: Awaited<ReturnType<typeof acquireProfileLock>> | undefined;
  let saveClicked = false;

  try {
    await diagnostics.transition("VALIDATING");
    const input = await validateVideoInput(options.filePath, config.maxFileBytes);
    journal.fileHash = input.fileHash;
    await diagnostics.log({ event: "input_validated", bytes: input.size, fileHash: input.fileHash });

    lock = await acquireProfileLock(config.profileDir);
    await report(options, "UPLOADING");
    await diagnostics.transition("LAUNCHING_BROWSER");
    adapter = adapterFactory(config, diagnostics.runDir);
    await adapter.open();
    await diagnostics.transition("CHECKING_SESSION");
    await adapter.ensureAuthenticated();
    await options.onStep?.("Mở trang TikTok Studio thành công");

    await diagnostics.transition("OPENING_UPLOAD_PAGE");
    await diagnostics.transition("UPLOADING");
    await adapter.upload(input.path);
    await options.onStep?.("Chọn file video thành công");

    if (adapter.selectSound) {
      await adapter.selectSound().catch(err => {
        console.warn(`[TikTok Adapter] Sound selection warning: ${err instanceof Error ? err.message : String(err)}`);
      });
      await options.onStep?.("Thêm nhạc/âm thanh thành công");
    }

    await adapter.setCaption(options.caption ?? "");
    await diagnostics.transition("READY_TO_SAVE");
    const publishMode = options.publishMode ?? "DRAFT";

    if (publishMode === "PUBLIC") {
      await adapter.screenshot("before-publish");
      await options.onStep?.("Điền caption thành công, nút Post/Publish đã sẵn sàng");

      await diagnostics.transition("PUBLISHING");
      await report(options, "PUBLISHING");
      saveClicked = true;
      await adapter.publish();

      await diagnostics.transition("VERIFYING");
      await report(options, "VERIFYING");
      if (!await adapter.verifyPublished()) {
        throw new AmbiguousSaveError("Post/Publish was clicked but no confirmed published evidence was found");
      }

      const publishedUrl = await adapter.getPublishedUrl?.().catch(() => undefined);
      await options.onPublishedUrl?.(publishedUrl);
      await adapter.screenshot("verified-published");
      await diagnostics.finish("PUBLISHED");
      await report(options, "PUBLISHED");
      await options.onStep?.("TikTok đã xác nhận đăng Public thành công");
      return EXIT_CODE.SUCCESS;
    }

    await adapter.screenshot("before-save-draft");
    await options.onStep?.("Điền caption thành công, nút Save Draft đã sẵn sàng");

    await diagnostics.transition("SAVING_DRAFT");
    await report(options, "SAVING_DRAFT");
    saveClicked = true;
    await adapter.saveDraft();
    await diagnostics.transition("VERIFYING");
    await report(options, "VERIFYING");
    if (!await adapter.verifyDraft()) throw new AmbiguousSaveError("Save Draft was clicked but no confirmed draft evidence was found");
    await adapter.screenshot("verified-draft");
    await diagnostics.finish("DRAFT_SAVED");
    await report(options, "DRAFT_SAVED");
    await adapter.navigateToDraftsList?.().catch(() => undefined);
    await options.onStep?.("Đã lưu nháp và chuyển đến trang danh sách Draft");
    return EXIT_CODE.SUCCESS;
  } catch (error) {
    const message = messageOf(error);
    const outcome = classifyError(error, saveClicked);
    await adapter?.screenshot("failure").catch(() => undefined);
    await diagnostics.finish(outcome.state, message);
    await report(options, outcome.state, message);
    return outcome.code;
  } finally {
    await adapter?.close().catch(() => undefined);
    await lock?.release().catch(() => undefined);
  }
}

async function report(options: RunDraftOptions, state: RunState, error?: string): Promise<void> { await options.onState?.(state, error); }

function classifyError(error: unknown, saveClicked: boolean): { state: RunState; code: number } {
  if (error instanceof InputError) return { state: "INVALID_INPUT", code: EXIT_CODE.INVALID_INPUT };
  if (error instanceof ProfileLockedError) return { state: "UPLOAD_FAILED", code: EXIT_CODE.PROFILE_LOCKED };
  if (error instanceof LoginRequiredError) return { state: "LOGIN_REQUIRED", code: EXIT_CODE.LOGIN_REQUIRED };
  if (saveClicked || error instanceof AmbiguousSaveError) return { state: "AMBIGUOUS", code: EXIT_CODE.AMBIGUOUS };
  if (error instanceof UploadError) return { state: "UPLOAD_FAILED", code: EXIT_CODE.UPLOAD_FAILED };
  return { state: "UPLOAD_FAILED", code: EXIT_CODE.UPLOAD_FAILED };
}

function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
