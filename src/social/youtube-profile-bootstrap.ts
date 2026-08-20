import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import type { YoutubePlaywrightConfig } from "./config.js";

/**
 * Opens REAL Google Chrome with a dedicated user-data directory.
 * Login happens in normal Chrome, not in Playwright.
 */
export async function bootstrapYoutubeProfile(config: YoutubePlaywrightConfig): Promise<void> {
  await mkdir(config.profileDir, { recursive: true });

  const executable = config.chromeExecutablePath;
  if (!executable) {
    throw new Error(
      "YOUTUBE_CHROME_EXECUTABLE is required for youtube:bootstrap. " +
      "On macOS use /Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );
  }
  await access(executable);

  const args = [
    `--user-data-dir=${config.profileDir}`,
    ...(config.chromeProfileDirectory
      ? [`--profile-directory=${config.chromeProfileDirectory}`]
      : []),
    config.uploadUrl,
  ];

  process.stdout.write([
    "[YouTube bootstrap] Opening REAL Google Chrome (not Playwright).",
    `[YouTube bootstrap] executable: ${executable}`,
    `[YouTube bootstrap] userDataDir: ${config.profileDir}`,
    `[YouTube bootstrap] profile: ${config.chromeProfileDirectory ?? "Default"}`,
    `[YouTube bootstrap] URL: ${config.uploadUrl}`,
    "",
    "1. Login to the Google account for the target YouTube channel.",
    "2. Open YouTube Studio and verify the channel/avatar.",
    "3. Quit this dedicated Chrome completely (Cmd+Q on macOS).",
    "",
    "Normal personal Chrome can stay open because this uses a different user-data directory.",
    "Do not point YOUTUBE_PROFILE_DIR at ~/Library/Application Support/Google/Chrome.",
    "",
  ].join("\n"));

  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => {
      if (code !== null && code !== 0) {
        reject(new Error(`YouTube bootstrap Chrome exited with code ${code}`));
        return;
      }
      resolve();
    });
  });

  process.stdout.write([
    "",
    "[YouTube bootstrap] Dedicated Chrome closed; profile/session persisted.",
    "[YouTube bootstrap] Next:",
    'npm run upload:youtube -- --file /absolute/path/video.mp4 --title "Test" --youtube-privacy private --made-for-kids false',
    "",
  ].join("\n"));
}
