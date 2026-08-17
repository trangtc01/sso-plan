import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config.js";
import { runDraft } from "./run-draft.js";
import { chromium } from "playwright";

const [command, ...args] = process.argv.slice(2);
const config = loadConfig();

if (command === "draft") {
  const fileFlag = args.indexOf("--file");
  const exitCode = await runDraft({ filePath: fileFlag >= 0 ? args[fileFlag + 1] : undefined }, config);
  process.exitCode = exitCode;
} else if (command === "bootstrap") {
  await mkdir(config.profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(config.profileDir, { headless: false, executablePath: config.chromeExecutablePath, chromiumSandbox: true, args: config.chromeProfileDirectory ? [`--profile-directory=${config.chromeProfileDirectory}`] : undefined });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(config.uploadUrl, { waitUntil: "domcontentloaded" });
  process.stdout.write("Đăng nhập TikTok thủ công trong browser. Nhấn Ctrl+C khi hoàn tất.\n");
  await new Promise<void>(resolve => process.once("SIGINT", resolve));
  await context.close();
} else {
  process.stderr.write("Usage: npm run tiktok:draft -- --file /absolute/path/video.mp4\n");
  process.stderr.write("       npm run tiktok:bootstrap\n");
  process.exitCode = 2;
}
