import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import type { AppConfig } from "./config.js";
import { LoginRequiredError, UploadError } from "./errors.js";

export interface TikTokDraftAdapter {
  open(): Promise<void>;
  ensureAuthenticated(): Promise<void>;
  upload(filePath: string): Promise<void>;
  selectSound?(): Promise<void>;
  setCaption(caption: string): Promise<void>;
  saveDraft(): Promise<void>;
  verifyDraft(): Promise<boolean>;
  publish(): Promise<void>;
  verifyPublished(): Promise<boolean>;
  getPublishedUrl?(): Promise<string | undefined>;
  navigateToDraftsList?(): Promise<void>;
  screenshot(name: string): Promise<void>;
  close(): Promise<void>;
}

export class PlaywrightTikTokDraftAdapter implements TikTokDraftAdapter {
  private context?: BrowserContext;
  private page?: Page;

  constructor(private readonly config: AppConfig, private readonly screenshotDir: string) {}

  async open(): Promise<void> {
    const extraArgs = [
      "--disable-blink-features=AutomationControlled",
      "--test-type",
      ...(this.config.chromeProfileDirectory ? [`--profile-directory=${this.config.chromeProfileDirectory}`] : []),
    ];

    this.context = await chromium.launchPersistentContext(this.config.profileDir, {
      headless: false,
      executablePath: this.config.chromeExecutablePath,
      chromiumSandbox: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: extraArgs,
      viewport: { width: 1440, height: 1000 },
    });
    this.page = this.context.pages()[0] ?? await this.context.newPage();
  }

  async ensureAuthenticated(): Promise<void> {
    const page = this.requirePage();
    console.log(`[TikTok Adapter] Current URL: ${page.url()}`);
    console.log(`[TikTok Adapter] Navigating to: ${this.config.uploadUrl}`);
    await page.goto(this.config.uploadUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    console.log(`[TikTok Adapter] Opened URL: ${page.url()}`);
    await page.waitForTimeout(500);
    if (isLoginUrl(page.url()) || await page.getByRole("button", { name: /log in|sign in|đăng\s*nhập/i }).isVisible().catch(() => false)) {
      throw new LoginRequiredError("TikTok session requires manual login, MFA, or CAPTCHA completion");
    }
  }

  async upload(filePath: string): Promise<void> {
    const page = this.requirePage();
    const input = page.locator('input[type="file"]').first();
    try {
      await input.waitFor({ state: "attached", timeout: 30_000 });
    } catch {
      throw new UploadError("TikTok upload file input was not found within 30s");
    }
    await input.setInputFiles(filePath);

    await this.dismissPopups().catch(() => undefined);

    const readyAction = page.getByRole("button", {
      name: /save\s*draft|draft|lưu\s*nháp|bản\s*nháp|^post$|^publish$|^đăng$|đăng\s*ngay/i,
    }).first();
    try {
      await readyAction.waitFor({ state: "visible", timeout: 120_000 });
      const handle = await readyAction.elementHandle();
      await page.waitForFunction(
        button => !!button && !(button as HTMLButtonElement).disabled && button.getAttribute("aria-disabled") !== "true",
        handle,
        { timeout: 120_000 },
      );
    } catch (error) {
      throw new UploadError(`upload did not reach a ready-to-submit state: ${messageOf(error)}`);
    }

    await this.dismissPopups().catch(() => undefined);
  }

  async selectSound(): Promise<void> {
    const page = this.requirePage();
    await this.dismissPopups().catch(() => undefined);

    console.log("[TikTok Adapter] Searching for 'Sounds/Âm thanh' button...");
    const soundsBtn = page.locator('button[data-button-name="sounds"], button[data-default-left-menu="MusicPanel"], #open-new-editor button:nth-child(2), button:has-text("Sounds"), button:has-text("Âm thanh")').first();
    try {
      await soundsBtn.waitFor({ state: "visible", timeout: 20_000 });
    } catch {
      console.warn("[TikTok Adapter] 'Sounds/Âm thanh' button was not visible on page within 20s.");
      return;
    }

    console.log("[TikTok Adapter] Waiting for 'Sounds/Âm thanh' button to become enabled...");
    await page.waitForFunction(
      btn => btn && !(btn as HTMLButtonElement).disabled && btn.getAttribute("aria-disabled") !== "true",
      await soundsBtn.elementHandle().catch(() => null),
      { timeout: 30_000 }
    ).catch(() => undefined);

    const listWrap = page.locator('.MusicPanelTabListMusicList__list, .MusicPanelContainer__content, [role="listitem"]').first();

    let opened = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[TikTok Adapter] Clicking 'Sounds/Âm thanh' button (attempt ${attempt})...`);
      await soundsBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      
      // Dispatch click via Playwright API and DOM click event to ensure event fires
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-button-name="sounds"]') as HTMLButtonElement;
        if (btn) btn.click();
      }).catch(() => undefined);

      await soundsBtn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(2_500);

      await this.handleLeaveModal(page, "cancel");

      if (await listWrap.isVisible({ timeout: 3_000 }).catch(() => false)) {
        opened = true;
        console.log("[TikTok Adapter] Music panel opened successfully!");
        break;
      }
    }

    if (!opened) {
      console.warn("[TikTok Adapter] Music panel list did not open after clicking Sounds button.");
      return;
    }

    // Wait until track titles are populated (not empty skeleton placeholders)
    console.log("[TikTok Adapter] Waiting for music tracks text to populate...");
    console.log("[TikTok Adapter] Waiting for music tracks text to populate...");
    await page.waitForFunction(() => {
      const titles = document.querySelectorAll('.MusicPanelMusicItem__infoBasicTitle');
      return Array.from(titles).some(el => el.textContent && el.textContent.trim().length > 0);
    }, { timeout: 15_000 }).catch(() => undefined);

    const videoDuration = await page.evaluate(async () => {
      const videos = Array.from(document.querySelectorAll("video"));
      for (const v of videos) {
        if (!isNaN(v.duration) && v.duration > 0) return v.duration;
      }
      const timeEl = document.querySelector('.play-time, .VideoClip__hoverText');
      if (timeEl && timeEl.textContent) {
        const matches = timeEl.textContent.match(/(\d+):(\d+):(\d+)|(\d+):(\d+)/g);
        if (matches && matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          const parts = lastMatch.split(":").map(Number);
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (parts.length === 2) return parts[0] * 60 + parts[1];
        }
      }
      return 0;
    });
    console.log(`[TikTok Adapter] Target video duration: ${videoDuration}s`);

    const tracksData = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.MusicPanelMusicItem__wrap'));
      return items.map((item, idx) => {
        const titleEl = item.querySelector('.MusicPanelMusicItem__infoBasicTitle');
        const descEl = item.querySelector('.MusicPanelMusicItem__infoBasicDesc');
        const title = titleEl ? (titleEl.textContent || "").trim() : "";
        const desc = descEl ? (descEl.textContent || "").trim() : "";
        const match = desc.match(/(\d+):(\d+)/);
        let duration = 0;
        if (match) {
          duration = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        }
        return { index: idx, title, desc, duration };
      }).filter(t => t.title.length > 0 || t.duration > 0);
    }).catch(() => []);

    console.log(`[TikTok Adapter] Extracted ${tracksData.length} music tracks.`);

    let selectedIndex = -1;
    let selectedTitle = "";

    for (const track of tracksData) {
      if (track.title || track.duration > 0) {
        console.log(`[TikTok Adapter] Track #${track.index + 1}: "${track.title}" | Duration: ${track.duration}s (raw: "${track.desc}")`);
      }

      if (videoDuration > 0 && track.duration > videoDuration) {
        selectedIndex = track.index;
        selectedTitle = track.title;
        console.log(`[TikTok Adapter] Selected track #${track.index + 1} "${track.title}" (${track.duration}s > video ${videoDuration}s)`);
        break;
      }
    }

    if (selectedIndex === -1 && tracksData.length > 0) {
      let maxTrack = tracksData[0];
      for (const track of tracksData) {
        if (track.duration > maxTrack.duration) {
          maxTrack = track;
        }
      }
      selectedIndex = maxTrack.index;
      selectedTitle = maxTrack.title || `Track #${maxTrack.index + 1}`;
      console.log(`[TikTok Adapter] No track with duration > ${videoDuration}s found. Fallback: selected track #${maxTrack.index + 1} "${selectedTitle}" with max duration ${maxTrack.duration}s.`);
    }

    if (selectedIndex >= 0) {
      const trackToSelect = tracksData[selectedIndex];
      console.log(`[TikTok Adapter] Clicking '+' button for track "${selectedTitle}" (Duration: ${trackToSelect?.duration || 0}s)...`);

      await page.evaluate((targetIdx) => {
        const items = Array.from(document.querySelectorAll('.MusicPanelMusicItem__wrap'));
        const target = items[targetIdx];
        if (target) {
          const btn = (
            target.querySelector('.MusicPanelMusicItem__operation button') ||
            target.querySelector('button')
          ) as HTMLButtonElement;
          if (btn) btn.click();
        }
      }, trackToSelect.index).catch(() => undefined);

      await page.waitForTimeout(1_500);
    }

    console.log("[TikTok Adapter] Looking for 'Save/Lưu' button in editor header...");
    const savedHeader = await page.evaluate(() => {
      const headerRight = document.querySelector('.TopBar__rightBox, .clip-forge-editor-header-right');
      if (!headerRight) return false;
      const saveBtn = Array.from(headerRight.querySelectorAll('button')).find(
        b => b.textContent && /lưu|save/i.test(b.textContent)
      ) || headerRight.querySelector('button.Button__root--type-primary') as HTMLButtonElement;
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    }).catch(() => false);

    if (savedHeader) {
      console.log("[TikTok Adapter] Clicked 'Save/Lưu' in editor header successfully.");
      await page.waitForTimeout(2_500);
    } else {
      const saveHeaderBtn = page.locator('.clip-forge-editor-header-right button.Button__root--type-primary, .TopBar__rightBox button:has-text("Lưu"), .TopBar__rightBox button:has-text("Save")').first();
      if (await saveHeaderBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        console.log("[TikTok Adapter] Clicking 'Save/Lưu' via Playwright locator...");
        await saveHeaderBtn.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(2_500);
      } else {
        console.warn("[TikTok Adapter] Header 'Save/Lưu' button not found or not visible.");
      }
    }

    // Handle "Bạn có chắc bạn muốn thoát" modal if it popped up after clicking save or closing editor
    await this.handleLeaveModal(page, "confirm");
  }

  async setCaption(caption: string): Promise<void> {
    if (!caption) return;
    const page = this.requirePage();
    let editor = page.getByRole("textbox", { name: /description|caption|mô\s*tả|chú\s*thích/i }).first();
    if (!await editor.count()) {
      editor = page.locator('div[contenteditable="true"], textarea, [role="textbox"]').first();
    }
    if (!await editor.count()) throw new UploadError("TikTok description editor was not found");
    await editor.fill(caption);
  }

  async saveDraft(): Promise<void> {
    const page = this.requirePage();
    const saveDraft = page.getByRole("button", { name: /save\s*draft|draft|lưu\s*nháp|bản\s*nháp/i }).first();
    await saveDraft.click({ timeout: 15_000 });

    // TikTok may show a modal: "The copyright check is still running..." / "Vẫn lưu"
    const saveAnyway = page.getByRole("button", { name: /save\s*anyway|vẫn\s*lưu/i }).first();
    if (await saveAnyway.isVisible({ timeout: 5_000 }).catch(() => false)) {
      console.log("[TikTok Adapter] Copyright check modal detected. Clicking 'Save anyway / Vẫn lưu'...");
      await saveAnyway.click({ timeout: 10_000 });
    }
  }

  async verifyDraft(): Promise<boolean> {
    const page = this.requirePage();
    const confirmation = page.getByText(/draft\s*(saved|has been saved)|saved\s+to\s+drafts|đã\s*lưu\s*nháp|đã\s*lưu/i).first();
    if (await confirmation.isVisible({ timeout: 15_000 }).catch(() => false)) return true;

    // TikTok often redirects to content list or posts manage page after draft is saved
    if (/content|posts|manage|overview/i.test(page.url())) return true;

    // Wait briefly in case toast appears late or URL changes slowly
    await page.waitForTimeout(3_000);
    if (/content|posts|manage|overview/i.test(page.url())) return true;
    if (await confirmation.isVisible({ timeout: 2_000 }).catch(() => false)) return true;

    return false;
  }

  async publish(): Promise<void> {
    const page = this.requirePage();
    await this.dismissPopups().catch(() => undefined);

    const candidates = [
      page.getByRole("button", { name: /^post$|^publish$|^đăng$|^đăng ngay$/i }).first(),
      page.locator('button[data-e2e*="post" i], button[data-e2e*="publish" i]').first(),
      page.locator("button").filter({ hasText: /^Post$|^Publish$|^Đăng$|^Đăng ngay$/i }).first(),
    ];

    let clicked = false;
    for (const button of candidates) {
      if (!await button.isVisible({ timeout: 2_500 }).catch(() => false)) continue;
      await button.scrollIntoViewIfNeeded().catch(() => undefined);
      if (!await button.isEnabled().catch(() => false)) continue;
      console.log("[TikTok Adapter] Clicking Post/Publish...");
      await button.click({ timeout: 15_000 });
      clicked = true;
      break;
    }

    if (!clicked) {
      throw new UploadError("TikTok Post/Publish button was not found or enabled");
    }

    const confirmations = [
      page.getByRole("button", { name: /post anyway|publish anyway|continue posting|continue|đăng dù sao|vẫn đăng|tiếp tục/i }).first(),
      page.locator("button").filter({ hasText: /post anyway|publish anyway|continue|vẫn đăng|tiếp tục/i }).first(),
    ];

    for (const confirm of confirmations) {
      if (await confirm.isVisible({ timeout: 4_000 }).catch(() => false)) {
        console.log("[TikTok Adapter] Publish confirmation modal detected; confirming...");
        await confirm.click({ timeout: 10_000 });
        break;
      }
    }
  }

  async verifyPublished(): Promise<boolean> {
    const page = this.requirePage();
    const confirmation = page.getByText(
      /video\s+(has been\s+)?posted|post(ed)?\s+successfully|published\s+successfully|đã\s+đăng|đăng\s+thành\s+công/i,
    ).first();

    if (await confirmation.isVisible({ timeout: 20_000 }).catch(() => false)) return true;

    await page.waitForTimeout(2_000);
    if (/tiktokstudio\/(content|posts|manage)|creator-center\/content/i.test(page.url())) {
      const submitStillVisible = await page.getByRole("button", {
        name: /^post$|^publish$|^đăng$|^đăng ngay$/i,
      }).first().isVisible().catch(() => false);
      if (!submitStillVisible) return true;
    }

    return await confirmation.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async getPublishedUrl(): Promise<string | undefined> {
    const page = this.requirePage();

    const current = page.url();
    if (/tiktok\.com\/@[^/]+\/video\/\d+/i.test(current)) return current;

    const direct = page.locator('a[href*="/video/"]').first();
    const href = await direct.getAttribute("href").catch(() => null);
    if (href) {
      try {
        return new URL(href, page.url()).toString();
      } catch {
        // Continue with content-list fallback.
      }
    }

    const contentUrl = "https://www.tiktok.com/tiktokstudio/content";
    if (!page.url().includes("/content")) {
      await page.goto(contentUrl, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(1_500);
    }

    const contentLink = page.locator('a[href*="/video/"]').first();
    const contentHref = await contentLink.getAttribute("href").catch(() => null);
    if (!contentHref) return undefined;

    try {
      return new URL(contentHref, page.url()).toString();
    } catch {
      return undefined;
    }
  }

  async navigateToDraftsList(): Promise<void> {
    const page = this.requirePage();
    const draftsUrl = "https://www.tiktok.com/tiktokstudio/content";
    if (!page.url().includes("/content")) {
      console.log(`[TikTok Adapter] Navigating to drafts list: ${draftsUrl}`);
      await page.goto(draftsUrl, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
    }
  }

  async screenshot(name: string): Promise<void> {
    await this.requirePage().screenshot({ path: `${this.screenshotDir}/${name}.png`, fullPage: true });
  }
  async close(): Promise<void> { await this.context?.close(); }
  private async dismissPopups(): Promise<void> {
    const page = this.requirePage();
    const popupBtn = page.getByRole("button", { name: /^got\s*it$|^skip$|^dismiss$|^close$|^đã\s*hiểu$|^bỏ\s*qua$|^đóng$/i }).first();
    if (await popupBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      console.log("[TikTok Adapter] Onboarding tutorial popup detected. Clicking 'Got it / Đã hiểu'...");
      await popupBtn.click({ timeout: 5_000 }).catch(() => undefined);
    }
  }

  private async handleLeaveModal(page: Page, action: "cancel" | "confirm"): Promise<void> {
    const leaveModalText = page.getByText(/bạn có chắc bạn muốn thoát|sure you want to leave|tiến độ và nội dung/i).first();
    if (await leaveModalText.isVisible({ timeout: 1_500 }).catch(() => false)) {
      if (action === "cancel") {
        console.log("[TikTok Adapter] Leave modal detected. Clicking 'Hủy/Cancel' to stay in editor...");
        const cancelBtn = page.getByRole("button", { name: /^hủy$|^cancel$/i }).first();
        await cancelBtn.click({ timeout: 5_000 }).catch(() => undefined);
      } else {
        console.log("[TikTok Adapter] Leave modal detected. Clicking 'Thoát/Discard/Leave'...");
        const leaveBtn = page.getByRole("button", { name: /thoát|rời\s*khỏi|leave|discard|ok|xác\s*nhận/i }).first();
        await leaveBtn.click({ timeout: 5_000 }).catch(() => undefined);
      }
    }
  }

  private requirePage(): Page { if (!this.page) throw new Error("browser page is not initialized"); return this.page; }
}

function isLoginUrl(url: string): boolean { return /login|signin|challenge|captcha/i.test(url); }
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
