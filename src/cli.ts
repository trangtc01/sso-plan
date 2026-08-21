import "dotenv/config";
import { mkdir } from "node:fs/promises";
import readline from "node:readline";
import { loadConfig } from "./config.js";
import { runDraft } from "./run-draft.js";
import { PlaywrightTikTokDraftAdapter } from "./tiktok-adapter.js";
import { chromium } from "playwright";

const [command, ...args] = process.argv.slice(2);
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

if (command === "draft" || command === "publish") {
  const fileFlag = args.indexOf("--file");
  const captionFlag = args.indexOf("--caption");
  const isPauseMode = args.includes("--pause") || args.includes("--step") || args.includes("-p");
  const publishMode = command === "publish" || args.includes("--public") ? "PUBLIC" : "DRAFT";
  const useSound = !args.includes("--no-sound");

  console.log(`[TikTok CLI] Starting upload with publishMode=${publishMode}, useSound=${useSound}${isPauseMode ? " (PAUSE MODE ENABLED)" : ""}`);
  let publishedVideoUrl: string | undefined;

  const exitCode = await runDraft(
    {
      filePath: fileFlag >= 0 ? args[fileFlag + 1] : undefined,
      caption: captionFlag >= 0 ? args[captionFlag + 1] : undefined,
      publishMode,
      useSound,
      onPublishedUrl: async (url) => {
        publishedVideoUrl = url;
        if (url) {
          console.log(`\n======================================================`);
          console.log(`🎉 LẤY THÀNH CÔNG TIKTOK PUBLISHED URL:`);
          console.log(`🔗 ${url}`);
          console.log(`\n👉 Lệnh copy-paste để chạy bước Tải Video TikTok tiếp theo:`);
          console.log(`   npm run tiktok:download -- --url "${url}" --pause`);
          console.log(`======================================================\n`);
        }
      },
      onState: async (state, error) => {
        console.log(`[Draft Progress] ${state}${error ? `: ${error}` : ""}`);
      },
      onStep: isPauseMode ? async (stepName) => {
        if (stepName.includes("Public thành công")) {
          if (publishedVideoUrl) {
            console.log(`\n======================================================`);
            console.log(`📌 TikTok Published URL / ID: ${publishedVideoUrl}`);
            console.log(`💡 Lệnh chạy bước tiếp theo (Tải Video TikTok):`);
            console.log(`   npm run tiktok:download -- --url "${publishedVideoUrl}" --pause`);
            console.log(`======================================================\n`);
          } else {
            console.log(`\n======================================================`);
            console.log(`⚠️ TikTok đã đăng thành công nhưng không lấy được URL tự động từ DOM.`);
            console.log(`💡 Bạn hãy mở kênh TikTok lấy URL video vừa đăng và chạy lệnh:`);
            console.log(`   npm run tiktok:download -- --url "https://www.tiktok.com/@user/video/<ID>" --pause`);
            console.log(`======================================================\n`);
          }
        }
        await promptEnter(stepName);
      } : undefined,
    },
    config
  );
  process.exitCode = exitCode;
} else if (command === "download") {
  const urlFlag = args.indexOf("--url");
  const outputFlag = args.indexOf("--output");
  const url = urlFlag >= 0 ? args[urlFlag + 1] : undefined;
  if (!url) {
    console.error("Usage: npm run tiktok:download -- --url <tiktok-video-url> [--output /path/to/save.mp4] [--pause]");
    process.exit(1);
  }
  const isPauseMode = args.includes("--pause") || args.includes("--step") || args.includes("-p");
  const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : `./.social-automation/tiktok-downloads/manual-${Date.now()}.mp4`;

  console.log(`[Step 1/3] Launching TikTok browser to download video...`);
  if (isPauseMode) await promptEnter("Chuẩn bị mở trình duyệt Playwright để tải TikTok video");

  const adapter = new PlaywrightTikTokDraftAdapter(config, "./.tiktok-automation/artifacts");
  await adapter.open();
  try {
    console.log(`[Step 2/3] Resolving and downloading media from URL: ${url}`);
    if (isPauseMode) await promptEnter("Chuẩn bị truy cập URL video TikTok và bắt gói tin media");

    const result = await adapter.downloadPublishedVideo(url, outputPath);
    console.log(`[Step 3/3] Tải video TikTok thành công! File lưu tại: ${result}`);
    if (isPauseMode) await promptEnter("Đã hoàn tất tải video TikTok");
  } finally {
    await adapter.close();
  }
} else if (command === "bootstrap") {
  await mkdir(config.profileDir, { recursive: true });
  const extraArgs = [
    "--disable-blink-features=AutomationControlled",
    "--test-type",
    ...(config.chromeProfileDirectory ? [`--profile-directory=${config.chromeProfileDirectory}`] : []),
  ];
  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: false,
    executablePath: config.chromeExecutablePath,
    chromiumSandbox: true,
    ignoreDefaultArgs: ["--enable-automation"],
    args: extraArgs,
  });
  const page = context.pages()[0] ?? await context.newPage();
  console.log(`[Bootstrap] Navigating to: ${config.uploadUrl}`);
  await page.goto(config.uploadUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log(`[Bootstrap] Opened URL: ${page.url()}`);
  process.stdout.write("Đăng nhập TikTok thủ công trong browser. Nhấn Ctrl+C khi hoàn tất.\n");
  await new Promise<void>(resolve => process.once("SIGINT", resolve));
  await context.close();
} else {
  process.stderr.write("Usage:\n");
  process.stderr.write("  npm run tiktok:draft -- --file /path/video.mp4 [--pause]\n");
  process.stderr.write("  npm run tiktok:publish -- --file /path/video.mp4 [--pause]\n");
  process.stderr.write("  npm run tiktok:download -- --url https://www.tiktok.com/@user/video/123 [--pause]\n");
  process.stderr.write("  npm run tiktok:bootstrap\n");
  process.exitCode = 2;
}
