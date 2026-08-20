import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import type { YoutubePlaywrightConfig } from "./config.js";
import { validateVideoFile } from "./file.js";
import type { PublishResult, SocialVideoInput, YoutubePrivacy } from "./types.js";

export interface YoutubePublishOptions {
  privacy?: YoutubePrivacy;
  madeForKids?: boolean;
}

export class YoutubePlaywrightPublisher {
  constructor(private readonly config: YoutubePlaywrightConfig) {}

  async bootstrap(): Promise<void> {
    await mkdir(this.config.profileDir, { recursive: true });
    const context = await this.launch();
    try {
      const page = context.pages()[0] ?? await context.newPage();
      process.stdout.write(`Opening YouTube upload page: ${this.config.uploadUrl}\n`);
      await page.goto(this.config.uploadUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.config.navigationTimeoutMs,
      }).catch(error => {
        process.stderr.write(`Initial navigation failed: ${messageOf(error)}\n`);
      });
      process.stdout.write(
        "Login to the target YouTube/Google account manually in this browser. Complete MFA/CAPTCHA if required. Press Ctrl+C when the account is ready.\n",
      );
      await new Promise<void>(resolve => process.once("SIGINT", resolve));
    } finally {
      await context.close();
    }
  }

  async publish(input: SocialVideoInput, options: YoutubePublishOptions = {}): Promise<PublishResult> {
    const file = await validateVideoFile(input.filePath);
    const privacy = options.privacy ?? this.config.defaultPrivacy;
    const madeForKids = options.madeForKids ?? this.config.defaultMadeForKids;
    validateMetadata(input.title || file.defaultTitle, input.description ?? "");

    const runDir = path.join(this.config.artifactDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`);
    await mkdir(runDir, { recursive: true });

    let context: BrowserContext | undefined;
    let page: Page | undefined;
    try {
      context = await this.launch();
      page = context.pages()[0] ?? await context.newPage();
      page.setDefaultTimeout(30_000);

      await page.goto(this.config.uploadUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.config.navigationTimeoutMs,
      });
      await page.waitForTimeout(800);
      await this.ensureAuthenticated(page);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: "attached", timeout: 30_000 });
      await fileInput.setInputFiles(file.path);

      const dialog = page.locator("ytcp-uploads-dialog").first();
      await dialog.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);

      await this.fillTitle(page, input.title || file.defaultTitle);
      await this.fillDescription(page, input.description ?? "");
      await this.selectAudience(page, madeForKids);
      await this.fillTagsBestEffort(page, input.tags ?? []);

      const videoUrl = await this.readVideoUrl(page);
      await page.screenshot({ path: path.join(runDir, "details-filled.png"), fullPage: true });

      await this.advanceToVisibility(page);
      await this.selectPrivacy(page, privacy);
      await page.screenshot({ path: path.join(runDir, "before-publish.png"), fullPage: true });

      const doneButton = page.locator("#done-button").first();
      await doneButton.waitFor({ state: "visible", timeout: 30_000 });
      await waitEnabled(doneButton, this.config.uploadTimeoutMs);
      await doneButton.click();

      await dialog.waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
      await page.screenshot({ path: path.join(runDir, "after-publish.png"), fullPage: true }).catch(() => undefined);

      const finalUrl = videoUrl ?? await this.readVideoUrl(page);
      const videoId = extractYoutubeVideoId(finalUrl);

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
        },
      };
    } catch (error) {
      if (page) {
        await page.screenshot({ path: path.join(runDir, "failure.png"), fullPage: true }).catch(() => undefined);
      }
      throw new Error(`YouTube Playwright upload failed: ${messageOf(error)}. Diagnostics: ${runDir}`);
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  private async launch(): Promise<BrowserContext> {
    await mkdir(this.config.profileDir, { recursive: true });
    return chromium.launchPersistentContext(this.config.profileDir, {
      headless: false,
      executablePath: this.config.chromeExecutablePath,
      args: this.config.chromeProfileDirectory
        ? [`--profile-directory=${this.config.chromeProfileDirectory}`]
        : undefined,
      viewport: { width: 1440, height: 1000 },
    });
  }

  private async ensureAuthenticated(page: Page): Promise<void> {
    const url = page.url();
    if (/accounts\.google\.com|ServiceLogin|signin|challenge|captcha/i.test(url)) {
      throw new Error("YouTube session requires manual login/MFA/CAPTCHA. Run: npm run youtube:bootstrap");
    }

    const signIn = page.getByRole("link", { name: /sign in/i }).first();
    if (await signIn.isVisible().catch(() => false)) {
      throw new Error("YouTube is not logged in. Run: npm run youtube:bootstrap");
    }
  }

  private async fillTitle(page: Page, title: string): Promise<void> {
    const locator = await firstVisible([
      page.locator("#title-textarea #textbox").first(),
      page.locator('ytcp-social-suggestions-textbox#title-textarea [contenteditable="true"]').first(),
      page.locator('[contenteditable="true"][aria-label*="title" i]').first(),
    ]);
    if (!locator) throw new Error("YouTube title editor was not found");
    await locator.fill(title);
  }

  private async fillDescription(page: Page, description: string): Promise<void> {
    if (!description) return;
    const locator = await firstVisible([
      page.locator("#description-textarea #textbox").first(),
      page.locator('ytcp-social-suggestions-textbox#description-textarea [contenteditable="true"]').first(),
      page.locator('[contenteditable="true"][aria-label*="description" i]').first(),
    ]);
    if (!locator) throw new Error("YouTube description editor was not found");
    await locator.fill(description);
  }

  private async selectAudience(page: Page, madeForKids: boolean): Promise<void> {
    const name = madeForKids ? "VIDEO_MADE_FOR_KIDS_MFK" : "VIDEO_MADE_FOR_KIDS_NOT_MFK";
    const byName = page.locator(`tp-yt-paper-radio-button[name="${name}"]`).first();
    if (await byName.isVisible().catch(() => false)) {
      await byName.click();
      return;
    }

    const text = madeForKids
      ? /yes,?\s*(it'?s|this video is)\s*made for kids/i
      : /no,?\s*(it'?s|this video is)\s*not made for kids/i;
    const fallback = page.getByText(text).first();
    if (await fallback.isVisible().catch(() => false)) {
      await fallback.click();
      return;
    }

    throw new Error("YouTube audience selector was not found");
  }

  private async fillTagsBestEffort(page: Page, tags: string[]): Promise<void> {
    if (!tags.length) return;
    const showMore = page.locator("#toggle-button").first();
    if (await showMore.isVisible().catch(() => false)) {
      await showMore.click().catch(() => undefined);
    }

    const tagsInput = page.locator("#tags-container #text-input").first();
    if (await tagsInput.isVisible().catch(() => false)) {
      await tagsInput.fill(tags.join(","));
    }
  }

  private async advanceToVisibility(page: Page): Promise<void> {
    for (let step = 0; step < 5; step += 1) {
      if (await this.isVisibilityStep(page)) return;

      const nextButton = page.locator("#next-button").first();
      await nextButton.waitFor({ state: "visible", timeout: 30_000 });
      await waitEnabled(nextButton, this.config.uploadTimeoutMs);
      await nextButton.click();
      await page.waitForTimeout(600);
    }

    if (!await this.isVisibilityStep(page)) {
      throw new Error("Could not reach YouTube Visibility step");
    }
  }

  private async isVisibilityStep(page: Page): Promise<boolean> {
    return page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').first().isVisible().catch(() => false);
  }

  private async selectPrivacy(page: Page, privacy: YoutubePrivacy): Promise<void> {
    const name = privacy.toUpperCase();
    const radio = page.locator(`tp-yt-paper-radio-button[name="${name}"]`).first();
    if (await radio.isVisible().catch(() => false)) {
      await radio.click();
      return;
    }

    const label = privacy === "public" ? /^Public$/i : privacy === "unlisted" ? /^Unlisted$/i : /^Private$/i;
    const fallback = page.getByText(label).last();
    if (await fallback.isVisible().catch(() => false)) {
      await fallback.click();
      return;
    }

    throw new Error(`YouTube privacy option was not found: ${privacy}`);
  }

  private async readVideoUrl(page: Page, timeoutMs = 30_000): Promise<string | null> {
    const link = page.locator(
      'ytcp-video-info a[href*="youtu.be/"], ytcp-video-info a[href*="youtube.com/watch"], a.style-scope.ytcp-video-info[href]',
    ).first();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await link.isVisible().catch(() => false)) {
        const href = await link.getAttribute("href");
        if (href) return href;
      }
      await page.waitForTimeout(250);
    }
    return null;
  }
}

async function firstVisible(locators: Locator[], timeoutMs = 30_000): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const locator of locators) {
      if (await locator.isVisible().catch(() => false)) return locator;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return null;
}

async function waitEnabled(locator: Locator, timeoutMs: number): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: timeoutMs });
  await locator.evaluate((element, timeout) => new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + Number(timeout);
    const check = () => {
      const disabled =
        Boolean((element as HTMLButtonElement).disabled) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true";
      if (!disabled) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error("Timed out waiting for button to become enabled"));
        return;
      }
      setTimeout(check, 250);
    };
    check();
  }), timeoutMs);
}

function extractYoutubeVideoId(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    if (parsed.hostname === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/);
    if (shortsMatch?.[1]) return shortsMatch[1];
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
