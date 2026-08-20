import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import type { YoutubePlaywrightConfig } from "./config.js";
import { validateVideoFile } from "./file.js";
import type { PublishResult, SocialVideoInput, YoutubePrivacy } from "./types.js";

export interface YoutubePublishOptions {
  privacy?: YoutubePrivacy;
  madeForKids?: boolean;
}

interface LaunchedChrome {
  process: ChildProcess;
  browser: Browser;
  context: BrowserContext;
}

export class YoutubePlaywrightPublisher {
  constructor(private readonly config: YoutubePlaywrightConfig) {}

  async publish(input: SocialVideoInput, options: YoutubePublishOptions = {}): Promise<PublishResult> {
    const file = await validateVideoFile(input.filePath);
    const privacy = options.privacy ?? this.config.defaultPrivacy;
    const madeForKids = options.madeForKids ?? this.config.defaultMadeForKids;
    const title = input.title || file.defaultTitle;

    validateMetadata(title, input.description ?? "");

    const runDir = path.join(
      this.config.artifactDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`,
    );
    await mkdir(runDir, { recursive: true });

    let chrome: LaunchedChrome | undefined;
    let page: Page | undefined;

    this.log(`=== START YOUTUBE UPLOAD ===`);
    this.log(`[Step 1/12] Validated input: file=${input.filePath}, title="${title}", privacy=${privacy}, madeForKids=${madeForKids}`);
    this.log(`[Diagnostics] Artifact directory: ${runDir}`);

    try {
      this.log(`[Step 2/12] Launching Chrome via CDP...`);
      chrome = await this.launchViaCdp();
      page = chrome.context.pages()[0] ?? await chrome.context.newPage();
      page.setDefaultTimeout(30_000);

      this.log(`[Step 3/12] Navigating to YouTube Studio: ${this.config.uploadUrl}...`);
      await this.gotoStudio(page);
      this.log(`[Studio Nav] Current page URL: ${page.url()}`);

      this.log(`[Step 4/12] Verifying authentication session...`);
      await this.ensureAuthenticated(page);
      this.log(`[Auth Check] Session is authenticated successfully`);

      this.log(`[Step 5/12] Opening Upload dialog...`);
      await this.openUploadDialog(page);
      this.log(`[Upload Dialog] Dialog opened successfully`);

      this.log(`[Step 6/12] Attaching video file: ${file.path}...`);
      await this.setVideoFile(page, file.path);
      this.log(`[File Upload] Video file attached`);

      const dialog = page.locator("ytcp-uploads-dialog").first();
      await dialog.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);

      this.log(`[Step 7/12] Filling metadata (title, description, audience, tags)...`);
      this.log(`  -> Title: "${title}"`);
      await this.fillTitle(page, title);

      if (input.description) {
        this.log(`  -> Description (${input.description.length} chars)`);
        await this.fillDescription(page, input.description);
      }

      this.log(`  -> Audience: madeForKids=${madeForKids}`);
      await this.selectAudience(page, madeForKids);
      await this.setNotAgeRestrictedBestEffort(page);

      if (input.tags?.length) {
        this.log(`  -> Tags: ${input.tags.join(", ")}`);
        await this.fillTagsBestEffort(page, input.tags);
      }

      this.log(`[Step 8/12] Reading video URL from Studio...`);
      const videoUrl = await this.readVideoUrl(page);
      this.log(`  -> Video URL found: ${videoUrl ?? "not available yet"}`);
      await this.screenshot(page, runDir, "details-filled.png");

      this.log(`[Step 9/12] Advancing through wizard to Visibility tab...`);
      await this.advanceToVisibility(page);

      this.log(`[Step 10/12] Setting privacy: ${privacy}...`);
      await this.selectPrivacy(page, privacy);
      await this.screenshot(page, runDir, "before-publish.png");

      this.log(`[Step 11/12] Clicking Save/Publish/Done button...`);
      await this.clickDone(page);

      this.log(`[Step 12/12] Waiting for publish confirmation...`);
      const confirmation = await this.waitForPublishConfirmation(page, dialog, privacy);

      await this.screenshot(page, runDir, "after-publish.png");

      if (!confirmation.ok) {
        throw new Error(confirmation.reason ?? "YouTube did not confirm upload completion");
      }

      const finalUrl = videoUrl ?? await this.readVideoUrl(page, 10_000);
      const videoId = extractYoutubeVideoId(finalUrl);

      this.log(`=== YOUTUBE UPLOAD SUCCESS ===`);
      this.log(`Final Result: videoId=${videoId ?? "unknown"}, privacy=${privacy}, url=${finalUrl ?? "N/A"}`);

      return {
        platform: "youtube",
        externalId: videoId ?? "unknown",
        state: privacy,
        url: finalUrl ?? undefined,
        raw: {
          privacy,
          madeForKids,
          artifactDir: runDir,
          videoIdFound: Boolean(videoId),
          profileDir: this.config.profileDir,
          profile: this.config.chromeProfileDirectory ?? "Default",
          confirmed: confirmation.ok,
        },
      };
    } catch (error) {
      this.log(`[ERROR] YouTube upload failed: ${messageOf(error)}`);
      if (page) {
        await this.screenshot(page, runDir, "failure.png").catch(() => undefined);
        const body = await page.locator("body").innerText().catch(() => "");
        await import("node:fs/promises").then(fs =>
          fs.writeFile(path.join(runDir, "failure-body.txt"), body.slice(0, 40_000), "utf8"),
        ).catch(() => undefined);
        this.log(`[Diagnostics] Screenshots & failure-body.txt saved to: ${runDir}`);
      }

      throw new Error(
        `YouTube Playwright upload failed: ${messageOf(error)}. Diagnostics: ${runDir}`,
      );
    } finally {
      await chrome?.browser.close().catch(() => undefined);
      if (chrome?.process && !chrome.process.killed) {
        chrome.process.kill("SIGTERM");
      }
      this.log(`=== END YOUTUBE UPLOAD PROCESS ===`);
    }
  }

  private async launchViaCdp(): Promise<LaunchedChrome> {
    await mkdir(this.config.profileDir, { recursive: true });

    const executable = this.config.chromeExecutablePath;
    if (!executable) {
      throw new Error(
        "YOUTUBE_CHROME_EXECUTABLE is required for CDP upload. " +
        "On macOS use /Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      );
    }

    await access(executable);

    const port = Number(process.env.YOUTUBE_CDP_PORT ?? "9222");
    if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
      throw new Error("YOUTUBE_CDP_PORT must be a valid TCP port");
    }

    const args = [
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${this.config.profileDir}`,
      ...(this.config.chromeProfileDirectory
        ? [`--profile-directory=${this.config.chromeProfileDirectory}`]
        : []),
      "--no-first-run",
      "--no-default-browser-check",
      this.config.uploadUrl,
    ];

    this.log(`[CDP Launch] Spawning real Chrome binary: ${executable}`);
    this.log(`[CDP Launch] Port=${port}, ProfileDir=${this.config.profileDir}, Profile=${this.config.chromeProfileDirectory ?? "Default"}`);

    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.log(`[CDP Launch] Chrome spawned with PID: ${child.pid}`);

    child.stdout?.on("data", chunk => {
      if (process.env.DEBUG_YOUTUBE_CHROME === "1") {
        process.stdout.write(`[YouTube Chrome stdout] ${String(chunk)}`);
      }
    });

    child.stderr?.on("data", chunk => {
      if (process.env.DEBUG_YOUTUBE_CHROME === "1") {
        process.stderr.write(`[YouTube Chrome stderr] ${String(chunk)}`);
      }
    });

    const endpoint = `http://127.0.0.1:${port}`;
    this.log(`[CDP Launch] Connecting Playwright over CDP to endpoint: ${endpoint}...`);
    const browser = await connectWithRetry(endpoint, child, 20_000);
    const context = browser.contexts()[0];

    if (!context) {
      await browser.close().catch(() => undefined);
      if (!child.killed) child.kill("SIGTERM");
      throw new Error("Chrome CDP connected but no browser context was available");
    }

    this.log(`[CDP Launch] Playwright CDP connection established successfully`);

    return {
      process: child,
      browser,
      context,
    };
  }

  private async gotoStudio(page: Page): Promise<void> {
    await page.goto(this.config.uploadUrl, {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeoutMs,
    });

    await page.waitForTimeout(900);
    await this.recoverFromBrokenUploadRoute(page);
  }

  private async recoverFromBrokenUploadRoute(page: Page): Promise<void> {
    const body = await page.locator("body").innerText().catch(() => "");
    const url = page.url();

    const looksBroken =
      /studio\.youtube\.com\/.*(?:upload|videos)/i.test(url) &&
      /something went wrong|error|try again|oops|đã xảy ra lỗi|thử lại/i.test(body);

    if (!looksBroken) return;

    this.log(`recovering broken Studio route: ${url}`);
    await page.goto("https://studio.youtube.com", {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeoutMs,
    });
    await page.waitForTimeout(1_200);
  }

  private async ensureAuthenticated(page: Page): Promise<void> {
    const url = page.url();

    if (/accounts\.google\.com|ServiceLogin|signin|challenge|captcha/i.test(url)) {
      throw new Error(
        "Dedicated YouTube profile is not authenticated. Run npm run youtube:bootstrap, " +
        "login in the REAL Chrome window, quit it completely, then retry.",
      );
    }

    const signInCandidates = [
      page.getByRole("link", { name: /sign in|đăng nhập/i }).first(),
      page.getByRole("button", { name: /sign in|đăng nhập/i }).first(),
      page.locator('a[href*="accounts.google.com"]').first(),
    ];

    for (const candidate of signInCandidates) {
      if (await candidate.isVisible().catch(() => false)) {
        throw new Error(
          "YouTube profile is not logged in. Run npm run youtube:bootstrap first.",
        );
      }
    }
  }

  private async openUploadDialog(page: Page): Promise<void> {
    await this.recoverFromBrokenUploadRoute(page);

    if (await this.hasFileInput(page)) return;

    const createButtons: Locator[] = [
      page.locator("ytcp-button.ytcpAppHeaderCreateIcon button").first(),
      page.getByRole("button", { name: /create|tạo/i }).first(),
      page.locator('button[aria-label*="create" i], button[aria-label*="tạo" i]').first(),
    ];

    const uploadTargets: Locator[] = [
      page.locator('a[href*="/videos/upload"]').first(),
      page.getByRole("menuitem", { name: /upload videos|upload video|tải video lên|tải video/i }).first(),
      page.getByRole("button", { name: /upload videos|upload video|tải video lên|tải video/i }).first(),
      page.locator('[role="menuitem"], a, button').filter({
        hasText: /upload videos|upload video|tải video lên|tải video/i,
      }).first(),
    ];

    for (const create of createButtons) {
      if (!await clickFirstVisibleEnabled(create)) continue;

      await page.waitForTimeout(700);

      for (const target of uploadTargets) {
        if (!await clickFirstVisibleEnabled(target)) continue;
        await page.waitForTimeout(1_000);

        if (await this.hasFileInput(page) || /\/videos\/upload/i.test(page.url())) {
          return;
        }
      }
    }

    const directUpload = page.locator('a[href*="/videos/upload"]').first();
    if (await clickFirstVisibleEnabled(directUpload)) {
      await page.waitForTimeout(1_000);
      if (await this.hasFileInput(page)) return;
    }

    if (!await this.hasFileInput(page)) {
      throw new Error(`Could not open YouTube upload dialog. Current URL: ${page.url()}`);
    }
  }

  private async setVideoFile(page: Page, filePath: string): Promise<void> {
    const tryFileChooser = async (): Promise<boolean> => {
      const triggers: Locator[] = [
        page.getByRole("button", { name: /select files|upload videos|upload video|chọn tệp|tải video/i }).first(),
        page.locator("ytcp-upload-video-button button, ytcp-button#upload-button button").first(),
        page.locator('button[aria-label*="upload" i], button[aria-label*="select" i]').first(),
        page.locator("button, [role='button']").filter({
          hasText: /select files|upload videos|upload video|chọn tệp|tải video/i,
        }).first(),
      ];

      for (const trigger of triggers) {
        const chooserPromise = page.waitForEvent("filechooser", { timeout: 2_500 }).catch(() => null);
        const clicked = await clickFirstVisibleEnabled(trigger);

        if (!clicked) {
          await chooserPromise;
          continue;
        }

        const chooser = await chooserPromise;
        if (chooser) {
          await chooser.setFiles(filePath);
          return true;
        }
      }

      return false;
    };

    if (await tryFileChooser()) return;

    let input = page.locator('input[type="file"]').first();
    if (await input.count()) {
      await input.setInputFiles(filePath);
      return;
    }

    await page.waitForTimeout(1_000);

    if (await tryFileChooser()) return;

    input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 10_000 });
    await input.setInputFiles(filePath);
  }

  private async fillTitle(page: Page, title: string): Promise<void> {
    const shortTitle = title.slice(0, 100);

    const candidates: Locator[] = [
      page.locator('#title-textarea #textbox[contenteditable="true"]').first(),
      page.locator('#title-textarea [role="textbox"][contenteditable="true"]').first(),
      page.locator('ytcp-social-suggestions-textbox#title-textarea [contenteditable="true"]').first(),
      page.locator('[contenteditable="true"][aria-label*="title" i]').first(),
      page.locator('#title-textarea textarea').first(),
    ];

    if (!await fillPolymerField(page, candidates, shortTitle)) {
      throw new Error("Could not set YouTube title field");
    }
  }

  private async fillDescription(page: Page, description: string): Promise<void> {
    if (!description) return;

    const candidates: Locator[] = [
      page.locator('#description-textarea #textbox[contenteditable="true"]').first(),
      page.locator('#description-textarea [role="textbox"][contenteditable="true"]').first(),
      page.locator('ytcp-social-suggestions-textbox#description-textarea [contenteditable="true"]').first(),
      page.locator('[contenteditable="true"][aria-label*="description" i]').first(),
      page.locator('#description-textarea textarea').first(),
    ];

    if (!await fillPolymerField(page, candidates, description)) {
      throw new Error("Could not set YouTube description field");
    }
  }

  private async selectAudience(page: Page, madeForKids: boolean): Promise<void> {
    const name = madeForKids ? "VIDEO_MADE_FOR_KIDS_MFK" : "VIDEO_MADE_FOR_KIDS_NOT_MFK";
    const text = madeForKids
      ? /yes,?.*made for kids|có,?.*trẻ em/i
      : /no,?.*not made for kids|không,?.*trẻ em/i;

    const candidates: Locator[] = [
      page.locator(`tp-yt-paper-radio-button[name="${name}"]`).first(),
      page.locator(`[name="${name}"]`).first(),
      page.getByRole("radio", { name: text }).first(),
      page.locator("tp-yt-paper-radio-button").filter({ hasText: text }).first(),
    ];

    for (const candidate of candidates) {
      if (!await clickFirstVisibleEnabled(candidate)) continue;

      const checked = await page
        .locator(`tp-yt-paper-radio-button[name="${name}"]`)
        .first()
        .getAttribute("aria-checked")
        .catch(() => null);

      if (checked === null || checked === "true") return;
    }

    throw new Error("Could not select YouTube audience option");
  }

  private async setNotAgeRestrictedBestEffort(page: Page): Promise<void> {
    const desired = page.locator(
      'tp-yt-paper-radio-button[name="VIDEO_AGE_RESTRICTION_NONE"], [name="VIDEO_AGE_RESTRICTION_NONE"]',
    ).first();

    if (await desired.isVisible().catch(() => false)) {
      await clickFirstVisibleEnabled(desired);
      return;
    }

    const expanders: Locator[] = [
      page.locator('button[aria-controls="age-restriction"]').first(),
      page.getByRole("button", { name: /age restriction|giới hạn độ tuổi/i }).first(),
    ];

    for (const expander of expanders) {
      if (!await clickFirstVisibleEnabled(expander)) continue;
      await page.waitForTimeout(400);
      if (await desired.isVisible().catch(() => false)) {
        await clickFirstVisibleEnabled(desired);
        return;
      }
    }
  }

  private async fillTagsBestEffort(page: Page, tags: string[]): Promise<void> {
    if (!tags.length) return;

    const showMoreCandidates = [
      page.locator("#toggle-button").first(),
      page.getByRole("button", { name: /show more|hiện thêm/i }).first(),
    ];

    for (const candidate of showMoreCandidates) {
      if (await clickFirstVisibleEnabled(candidate)) {
        await page.waitForTimeout(300);
        break;
      }
    }

    const tagCandidates: Locator[] = [
      page.locator("#tags-container #text-input").first(),
      page.locator('input[aria-label*="tags" i]').first(),
    ];

    for (const candidate of tagCandidates) {
      if (!await candidate.isVisible().catch(() => false)) continue;
      await candidate.fill(tags.join(","));
      return;
    }
  }

  private async advanceToVisibility(page: Page): Promise<void> {
    const nextCandidates = (): Locator[] => [
      page.locator("ytcp-button#next-button button").first(),
      page.locator("#next-button").first(),
      page.getByRole("button", { name: /next|tiếp/i }).first(),
      page.locator('button[aria-label*="next" i], button[aria-label*="tiếp" i]').first(),
    ];

    for (let step = 0; step < 6; step += 1) {
      if (await this.isVisibilityStep(page)) return;

      let clicked = false;
      for (const candidate of nextCandidates()) {
        if (!await clickFirstVisibleEnabled(candidate)) continue;
        clicked = true;
        await page.waitForTimeout(800);
        break;
      }

      if (!clicked) break;
    }

    if (!await this.isVisibilityStep(page)) {
      throw new Error("Could not reach YouTube Visibility step");
    }
  }

  private async isVisibilityStep(page: Page): Promise<boolean> {
    const indicators: Locator[] = [
      page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').first(),
      page.locator('tp-yt-paper-radio-button[name="PRIVATE"]').first(),
      page.getByRole("radio", { name: /public|private|unlisted|công khai|riêng tư|không công khai/i }).first(),
    ];

    for (const indicator of indicators) {
      if (await indicator.isVisible().catch(() => false)) return true;
    }

    return false;
  }

  private async selectPrivacy(page: Page, privacy: YoutubePrivacy): Promise<void> {
    const name = privacy.toUpperCase();
    const labels: Record<YoutubePrivacy, RegExp> = {
      public: /public|công khai/i,
      private: /private|riêng tư/i,
      unlisted: /unlisted|không công khai/i,
    };

    const candidates: Locator[] = [
      page.locator(`tp-yt-paper-radio-button[name="${name}"]`).first(),
      page.locator(`[name="${name}"]`).first(),
      page.getByRole("radio", { name: labels[privacy] }).first(),
      page.locator("tp-yt-paper-radio-button").filter({ hasText: labels[privacy] }).first(),
    ];

    for (const candidate of candidates) {
      if (await clickFirstVisibleEnabled(candidate)) return;
    }

    throw new Error(`Could not select YouTube privacy: ${privacy}`);
  }

  private async clickDone(page: Page): Promise<void> {
    const candidates: Locator[] = [
      page.locator("ytcp-button#done-button button").first(),
      page.locator("#done-button").first(),
      page.getByRole("button", { name: /publish|save|done|xuất bản|lưu|xong/i }).first(),
      page.locator("button").filter({ hasText: /publish|save|done|xuất bản|lưu|xong/i }).first(),
    ];

    const deadline = Date.now() + this.config.uploadTimeoutMs;

    while (Date.now() < deadline) {
      for (const candidate of candidates) {
        if (!await candidate.isVisible().catch(() => false)) continue;
        if (await candidate.isDisabled().catch(() => false)) continue;
        if (await clickFirstVisibleEnabled(candidate)) return;
      }
      await page.waitForTimeout(500);
    }

    throw new Error("Timed out waiting for YouTube Publish/Save/Done button");
  }

  private async waitForPublishConfirmation(
    page: Page,
    dialog: Locator,
    privacy: YoutubePrivacy,
  ): Promise<{ ok: boolean; reason?: string }> {
    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      const body = await page.locator("body").innerText().catch(() => "");

      if (/checks complete|video published|published|upload complete|saved|đã xuất bản|đã lưu|tải lên hoàn tất/i.test(body)) {
        return { ok: true };
      }

      if (/failed|something went wrong|upload failed|error|đã xảy ra lỗi|không thể tải/i.test(body)) {
        return { ok: false, reason: "YouTube UI reported an upload/publish error" };
      }

      const dialogHidden = await dialog.isHidden().catch(() => false);
      if (dialogHidden) return { ok: true };

      await page.waitForTimeout(1_000);
    }

    if (privacy !== "public") {
      const dialogHidden = await dialog.isHidden().catch(() => false);
      if (dialogHidden) return { ok: true };
    }

    return { ok: false, reason: "No reliable YouTube completion confirmation within timeout" };
  }

  private async hasFileInput(page: Page): Promise<boolean> {
    return (await page.locator('input[type="file"]').count()) > 0;
  }

  private async readVideoUrl(page: Page, timeoutMs = 30_000): Promise<string | null> {
    const candidates = page.locator(
      'ytcp-video-info a[href*="youtu.be/"], ' +
      'ytcp-video-info a[href*="youtube.com/watch"], ' +
      'a[href*="youtu.be/"], a[href*="youtube.com/watch?v="]',
    );

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const total = await candidates.count();
      for (let i = 0; i < total; i += 1) {
        const href = await candidates.nth(i).getAttribute("href").catch(() => null);
        if (href) return href;
      }
      await page.waitForTimeout(250);
    }

    return null;
  }

  private async screenshot(page: Page, runDir: string, file: string): Promise<void> {
    await page.screenshot({
      path: path.join(runDir, file),
      fullPage: true,
    });
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    process.stdout.write(`[YouTube ${timestamp}] ${message}\n`);
  }
}

async function connectWithRetry(
  endpoint: string,
  child: ChildProcess,
  timeoutMs: number,
): Promise<Browser> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Chrome exited before CDP became ready (exit=${child.exitCode})`);
    }

    try {
      return await chromium.connectOverCDP(endpoint);
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  throw new Error(
    `Timed out connecting Playwright to Chrome CDP at ${endpoint}: ${messageOf(lastError)}`,
  );
}

async function clickFirstVisibleEnabled(locator: Locator): Promise<boolean> {
  const total = await locator.count().catch(() => 0);

  for (let i = 0; i < total; i += 1) {
    const candidate = locator.nth(i);

    if (!await candidate.isVisible().catch(() => false)) continue;
    if (await candidate.isDisabled().catch(() => false)) continue;

    await candidate.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => undefined);

    try {
      await candidate.click({ timeout: 5_000 });
      return true;
    } catch {
      try {
        await candidate.click({ timeout: 5_000, force: true });
        return true;
      } catch {
        // try next
      }
    }
  }

  return false;
}

async function fillPolymerField(
  page: Page,
  candidates: Locator[],
  value: string,
): Promise<boolean> {
  for (const candidate of candidates) {
    if (!await candidate.isVisible().catch(() => false)) continue;

    try {
      await candidate.fill(value);
      return true;
    } catch {
      // fall through
    }

    try {
      await candidate.click({ timeout: 5_000 });

      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${modifier}+A`);
      await page.keyboard.press("Backspace");

      if (value) {
        await page.keyboard.type(value, { delay: 5 });
      }

      await candidate.evaluate((element, nextValue) => {
        const node = element as HTMLElement;
        node.textContent = nextValue;
        node.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: "insertText",
            data: nextValue,
          }),
        );
        node.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        node.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
      }, value);

      return true;
    } catch {
      // try next selector
    }
  }

  return false;
}

function extractYoutubeVideoId(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, "https://www.youtube.com");

    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    const watchId = parsed.searchParams.get("v");
    if (watchId) return watchId;

    const shorts = parsed.pathname.match(/\/shorts\/([^/?]+)/);
    if (shorts?.[1]) return shorts[1];
  } catch {
    return null;
  }

  return null;
}

function validateMetadata(title: string, description: string): void {
  if (!title.trim()) throw new Error("YouTube title must not be empty");
  if (title.length > 100) throw new Error("YouTube title must be <= 100 characters");
  if (description.length > 5_000) throw new Error("YouTube description must be <= 5000 characters");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
