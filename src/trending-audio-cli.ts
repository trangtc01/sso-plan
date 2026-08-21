import "dotenv/config";
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { loadConfig } from "./config.js";
import {
  findVideoItemInHydration,
  selectBestTrendingAudio,
  type TrendingAudioCandidate,
} from "./trending-audio.js";

const DISCOVER_URL = "https://www.tiktok.com/discover/%C3%A2m-thanh-th%E1%BB%8Bnh-h%C3%A0nh";

interface CliOptions {
  duration: number;
  output: string;
  limit: number;
  headless: boolean;
  keepSource: boolean;
  pause: boolean;
}

const options = parseArgs(process.argv.slice(2));
const config = loadConfig();

function promptEnter(stepMessage: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\n[PAUSE] ${stepMessage}\n👉 Bấm ENTER để tiếp tục bước tiếp theo... `, () => {
      rl.close();
      resolve();
    });
  });
}

async function pauseAt(stepMessage: string): Promise<void> {
  if (options.pause) await promptEnter(stepMessage);
}

console.log(`[Trending Audio] target video duration=${options.duration}s, candidates=${options.limit}`);
console.log(`[Trending Audio] source=${DISCOVER_URL}${options.pause ? " (PAUSE MODE ENABLED)" : ""}`);

const context = await chromium.launchPersistentContext(config.profileDir, {
  headless: options.headless,
  executablePath: config.chromeExecutablePath,
  chromiumSandbox: true,
  ignoreDefaultArgs: ["--enable-automation"],
  args: [
    "--disable-blink-features=AutomationControlled",
    "--test-type",
    ...(config.chromeProfileDirectory ? [`--profile-directory=${config.chromeProfileDirectory}`] : []),
  ],
  viewport: { width: 1440, height: 1000 },
});

try {
  const page = context.pages()[0] ?? await context.newPage();
  console.log(`[Trending Audio] Opening Discover page: ${DISCOVER_URL}`);
  await page.goto(DISCOVER_URL, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
  await pauseAt("Đã mở trang TikTok Âm Thanh Thịnh Hành. Bấm ENTER để bắt đầu thu thập candidate videos");
  const videoUrls = await collectDiscoverVideoUrls(page, options.limit);
  console.log(`[Trending Audio] discovered ${videoUrls.length} candidate videos`);
  await pauseAt(`Đã lấy ${videoUrls.length} candidate videos. Chuẩn bị đọc metadata sound và lượt view`);

  const candidates: TrendingAudioCandidate[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    const url = videoUrls[i];
    console.log(`[Trending Audio] inspecting ${i + 1}/${videoUrls.length}: ${url}`);
    const candidate = await inspectVideoCandidate(page, url);
    if (!candidate) {
      console.log("  -> skipped: TikTok did not expose playCount + sound metadata");
      continue;
    }
    console.log(`  -> ${candidate.videoPlayCount.toLocaleString()} views | ${candidate.musicTitle} | ${candidate.musicDuration}s`);
    candidates.push(candidate);
  }

  const best = selectBestTrendingAudio(candidates, options.duration);
  if (!best) {
    throw new Error(`No sound with duration >= ${options.duration}s and a valid video playCount/audio URL was found.`);
  }

  console.log("\n[Trending Audio] selected:");
  console.log(`  title: ${best.musicTitle}`);
  console.log(`  author: ${best.musicAuthor ?? "unknown"}`);
  console.log(`  sound duration: ${best.musicDuration}s`);
  console.log(`  source video views: ${best.videoPlayCount.toLocaleString()}`);
  console.log(`  source video: ${best.videoUrl}`);
  await pauseAt(`Đã chọn sound "${best.musicTitle}" (${best.videoPlayCount.toLocaleString()} views). Chuẩn bị tải và cắt audio`);

  const finalPath = path.resolve(options.output);
  await mkdir(path.dirname(finalPath), { recursive: true });
  const rawPath = `${finalPath}.source`;
  await downloadAudio(context, best.musicPlayUrl, rawPath, best.videoUrl);
  await trimAndConvertAudio(rawPath, finalPath, options.duration);
  if (!options.keepSource) await unlink(rawPath).catch(() => undefined);

  console.log(`\n[Trending Audio] downloaded: ${finalPath}`);
  await pauseAt(`Đã hoàn tất tải audio: ${finalPath}`);
} finally {
  await context.close();
}

function parseArgs(args: string[]): CliOptions {
  const duration = readNumberFlag(args, "--duration");
  if (!duration || duration <= 0) {
    printUsage();
    throw new Error("--duration must be a positive number of seconds");
  }

  const limit = readNumberFlag(args, "--limit") ?? 20;
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new Error("--limit must be an integer between 1 and 100");
  }

  return {
    duration,
    limit,
    output: readStringFlag(args, "--output") ?? `./.social-automation/tiktok-audio/trending-${Math.round(duration)}s-${Date.now()}.mp3`,
    headless: args.includes("--headless"),
    keepSource: args.includes("--keep-source"),
    pause: args.includes("--pause") || args.includes("--step") || args.includes("-p"),
  };
}

function readNumberFlag(args: string[], name: string): number | undefined {
  const raw = readStringFlag(args, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function readStringFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function printUsage(): void {
  console.error("Usage: npm run tiktok:trending-audio -- --duration <seconds> [--limit 20] [--output ./audio.mp3] [--headless] [--pause]");
}

const SEARCH_URL = "https://www.tiktok.com/search?q=%C3%A2m%20thanh%20th%E1%BB%8Bnh%20h%C3%A0nh";

async function collectDiscoverVideoUrls(page: Page, limit: number): Promise<string[]> {
  if (!page.url().includes("/discover/") && !page.url().includes("/search")) {
    await page.goto(DISCOVER_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  }
  await page.waitForTimeout(2_000);

  // Detect logged-in user handle/ID from avatar or navigation profile links to exclude self videos
  const loggedInUserHandle = await page.evaluate(() => {
    const profileLinks = Array.from(document.querySelectorAll('a[href*="/@"]')) as HTMLAnchorElement[];
    for (const link of profileLinks) {
      const match = link.href.match(/\/(@[^/?#]+)/);
      if (match && !link.href.includes("/video/")) {
        return match[1].toLowerCase();
      }
    }
    return undefined;
  }).catch(() => undefined);

  if (loggedInUserHandle) {
    console.log(`[Trending Audio] excluding logged-in user handle: ${loggedInUserHandle}`);
  }

  let urls = await extractVideoUrlsFromPage(page, limit, loggedInUserHandle);

  // If Discover page returns 0 candidates or redirects to home/profile, fallback to TikTok Search
  if (urls.length === 0) {
    console.log(`[Trending Audio] Discover page yielded 0 candidates, trying search URL: ${SEARCH_URL}`);
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    urls = await extractVideoUrlsFromPage(page, limit, loggedInUserHandle);
  }

  return urls;
}

async function extractVideoUrlsFromPage(page: Page, limit: number, selfHandle?: string): Promise<string[]> {
  const urls = new Set<string>();
  for (let pass = 0; pass < 8 && urls.size < limit; pass++) {
    const hrefs = await page.evaluate((excludedHandle) => {
      let container: Element | null = document.querySelector(
        'div[class*="DivVideoFeedContainer"], div[class*="DivGridContainer"], [data-e2e="search-card-container"], main, #main-content-search_top, #main-content-others_homepage'
      );
      if (!container) container = document.body;

      const anchors = Array.from(container.querySelectorAll('a[href*="/video/"]')) as HTMLAnchorElement[];

      return anchors
        .filter(a => {
          // Ignore any links inside Header, Nav, Inbox, or Notification popups
          if (a.closest('header, nav, [class*="Header"], [class*="Inbox"], [class*="Notification"], [data-e2e*="inbox"]')) {
            return false;
          }
          const href = a.href;
          if (!href || !/tiktok\.com\/@[^/]+\/video\/\d+/i.test(href)) {
            return false;
          }
          if (excludedHandle && href.toLowerCase().includes(`/${excludedHandle.toLowerCase()}/`)) {
            return false;
          }
          return true;
        })
        .map(a => a.href);
    }, selfHandle);

    for (const href of hrefs) {
      urls.add(href.split("?")[0]);
      if (urls.size >= limit) break;
    }
    if (urls.size >= limit) break;
    await page.mouse.wheel(0, 4_000);
    await page.waitForTimeout(1_500);
  }

  return [...urls].slice(0, limit);
}

async function inspectVideoCandidate(page: Page, videoUrl: string): Promise<TrendingAudioCandidate | undefined> {
  await page.goto(videoUrl, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);

  const hydration = await page.evaluate(() => {
    const selectors = [
      "#__UNIVERSAL_DATA_FOR_REHYDRATION__",
      "#__NEXT_DATA__",
      "#SIGI_STATE",
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node?.textContent) continue;
      try {
        return JSON.parse(node.textContent) as unknown;
      } catch {
        // Try next known hydration script.
      }
    }
    return undefined;
  }).catch(() => undefined);

  if (!hydration) return undefined;
  const item = findVideoItemInHydration(hydration);
  if (!item) return undefined;

  const stats = asRecord(item.stats);
  const music = asRecord(item.music);
  const playCount = Number(stats?.playCount ?? 0);
  const musicId = String(music?.id ?? "");
  const musicTitle = String(music?.title ?? music?.musicName ?? "Untitled TikTok sound");
  const musicAuthor = optionalString(music?.authorName ?? music?.author);
  const musicDuration = Number(music?.duration ?? music?.durationSeconds ?? 0);
  const musicPlayUrl = resolveMusicPlayUrl(music);
  const videoId = optionalString(item.id);

  if (!playCount || !musicId || !musicDuration || !musicPlayUrl) return undefined;

  return {
    videoUrl,
    videoId,
    videoPlayCount: playCount,
    musicId,
    musicTitle,
    musicAuthor,
    musicDuration,
    musicPlayUrl,
  };
}

function resolveMusicPlayUrl(music: Record<string, unknown> | undefined): string {
  if (!music) return "";
  const candidates: unknown[] = [
    music.playUrl,
    music.play_url,
    music.audioUrl,
    music.audio_url,
    asRecord(music.playUrl)?.urlList,
    asRecord(music.playUrl)?.url_list,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) return candidate;
    if (Array.isArray(candidate)) {
      const match = candidate.find(v => typeof v === "string" && /^https?:\/\//i.test(v));
      if (typeof match === "string") return match;
    }
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function downloadAudio(context: BrowserContext, url: string, outputPath: string, referer: string): Promise<void> {
  const response = await context.request.get(url, {
    headers: {
      Referer: referer,
      "User-Agent": await context.pages()[0]?.evaluate(() => navigator.userAgent).catch(() => "Mozilla/5.0") ?? "Mozilla/5.0",
    },
    timeout: 45_000,
  });

  if (!response.ok()) {
    throw new Error(`TikTok audio download failed: HTTP ${response.status()}`);
  }

  const body = await response.body();
  if (!body.length) throw new Error("TikTok audio download returned an empty response");
  await writeFile(outputPath, body);
}

async function trimAndConvertAudio(inputPath: string, outputPath: string, duration: number): Promise<void> {
  const executable = process.env.FFMPEG_EXECUTABLE ?? "ffmpeg";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [
      "-y",
      "-i", inputPath,
      "-t", String(duration),
      "-vn",
      "-c:a", "libmp3lame",
      "-q:a", "2",
      outputPath,
    ], { stdio: ["ignore", "inherit", "inherit"] });

    child.once("error", error => reject(new Error(`Could not execute ${executable}: ${error.message}. Make sure ffmpeg is installed.`)));
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${executable} failed with exit code ${code ?? "unknown"}`)));
  });
}
