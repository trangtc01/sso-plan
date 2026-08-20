import "dotenv/config";
import { mkdir } from "node:fs/promises";
import readline from "node:readline";
import { loadConfig } from "./config.js";
import { runDraft } from "./run-draft.js";
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

if (command === "draft") {
  const fileFlag = args.indexOf("--file");
  const isPauseMode = args.includes("--pause") || args.includes("--step") || args.includes("-p");
  const exitCode = await runDraft(
    {
      filePath: fileFlag >= 0 ? args[fileFlag + 1] : undefined,
      onState: async (state, error) => {
        console.log(`[Draft Progress] ${state}${error ? `: ${error}` : ""}`);
      },
      onStep: isPauseMode ? promptEnter : undefined,
    },
    config
  );
  process.exitCode = exitCode;
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
  process.stderr.write("Usage: npm run tiktok:draft -- --file /absolute/path/video.mp4 [--pause]\n");
  process.stderr.write("       npm run tiktok:bootstrap\n");
  process.exitCode = 2;
}
