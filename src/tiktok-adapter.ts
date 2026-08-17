import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import type { AppConfig } from "./config.js";
import { LoginRequiredError, UploadError } from "./errors.js";

export interface TikTokDraftAdapter {
  open(): Promise<void>;
  ensureAuthenticated(): Promise<void>;
  upload(filePath: string): Promise<void>;
  setCaption(caption: string): Promise<void>;
  saveDraft(): Promise<void>;
  verifyDraft(): Promise<boolean>;
  screenshot(name: string): Promise<void>;
  close(): Promise<void>;
}

export class PlaywrightTikTokDraftAdapter implements TikTokDraftAdapter {
  private context?: BrowserContext;
  private page?: Page;

  constructor(private readonly config: AppConfig, private readonly screenshotDir: string) {}

  async open(): Promise<void> {
    this.context = await chromium.launchPersistentContext(this.config.profileDir, {
      headless: false,
      executablePath: this.config.chromeExecutablePath,
      chromiumSandbox: true,
      args: this.config.chromeProfileDirectory ? [`--profile-directory=${this.config.chromeProfileDirectory}`] : undefined,
      viewport: { width: 1440, height: 1000 },
    });
    this.page = this.context.pages()[0] ?? await this.context.newPage();
  }

  async ensureAuthenticated(): Promise<void> {
    const page = this.requirePage();
    await page.goto(this.config.uploadUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if (isLoginUrl(page.url()) || await page.getByRole("button", { name: /log in|sign in/i }).isVisible().catch(() => false)) {
      throw new LoginRequiredError("TikTok session requires manual login, MFA, or CAPTCHA completion");
    }
  }

  async upload(filePath: string): Promise<void> {
    const page = this.requirePage();
    const input = page.locator('input[type="file"]').first();
    if (!await input.count()) throw new UploadError("TikTok upload file input was not found");
    await input.setInputFiles(filePath);

    const saveDraft = page.getByRole("button", { name: /save\s*draft|draft/i }).first();
    try {
      await saveDraft.waitFor({ state: "visible", timeout: 120_000 });
      await page.waitForFunction(button => !(button as HTMLButtonElement).disabled, await saveDraft.elementHandle(), { timeout: 120_000 });
    } catch (error) {
      throw new UploadError(`upload did not reach a ready-to-save state: ${messageOf(error)}`);
    }
  }

  async setCaption(caption: string): Promise<void> {
    if (!caption) return;
    const page = this.requirePage();
    const editor = page.getByRole("textbox", { name: /description|caption/i }).first();
    if (!await editor.count()) throw new UploadError("TikTok description editor was not found");
    await editor.fill(caption);
  }

  async saveDraft(): Promise<void> {
    const saveDraft = this.requirePage().getByRole("button", { name: /save\s*draft|draft/i }).first();
    await saveDraft.click({ timeout: 15_000 });
  }

  async verifyDraft(): Promise<boolean> {
    const page = this.requirePage();
    const confirmation = page.getByText(/draft\s*(saved|has been saved)|saved\s+to\s+drafts/i).first();
    if (await confirmation.isVisible({ timeout: 15_000 }).catch(() => false)) return true;

    // The concrete URL/list evidence must be confirmed during the feasibility gate.
    // A redirect alone is deliberately insufficient evidence to avoid duplicate drafts.
    return false;
  }

  async screenshot(name: string): Promise<void> {
    await this.requirePage().screenshot({ path: `${this.screenshotDir}/${name}.png`, fullPage: true });
  }
  async close(): Promise<void> { await this.context?.close(); }
  private requirePage(): Page { if (!this.page) throw new Error("browser page is not initialized"); return this.page; }
}

function isLoginUrl(url: string): boolean { return /login|signin|challenge|captcha/i.test(url); }
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
