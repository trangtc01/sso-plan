import "dotenv/config";
import { loadFacebookConfig, loadYoutubePlaywrightConfig } from "./config.js";
import { validateVideoFile } from "./file.js";
import { FacebookReelsPublisher } from "./facebook-publisher.js";
import { YoutubePlaywrightPublisher } from "./youtube-playwright-publisher.js";
import { bootstrapYoutubeProfile } from "./youtube-profile-bootstrap.js";
import type { FacebookVideoState, SocialVideoInput, YoutubePrivacy } from "./types.js";

const [command, ...args] = process.argv.slice(2);

import readline from "node:readline";

function promptEnter(stepMessage: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\n[PAUSE] ${stepMessage}\n👉 Bấm ENTER để tiếp tục bước tiếp theo... `, () => {
      rl.close();
      resolve();
    });
  });
}

try {
  if (command === "youtube-bootstrap") {
    await bootstrapYoutubeProfile(loadYoutubePlaywrightConfig());
  } else if (command === "upload") {
    await runUpload(args);
  } else {
    printUsage();
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function runUpload(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const isPauseMode = Boolean(flags.pause || flags.step || flags.p);
  const platform = (String(flags.platform ?? "all")).toLowerCase();
  if (!new Set(["facebook", "youtube", "all"]).has(platform)) {
    throw new Error("--platform must be facebook, youtube, or all");
  }

  const fileArg = requiredFlag(flags, "file");
  const file = await validateVideoFile(fileArg);
  const title = (flags.title as string)?.trim() || file.defaultTitle;
  const description = (flags.description as string) ?? "";
  const tags = ((flags.tags as string) ?? "")
    .split(",")
    .map(value => value.trim().replace(/^#/, ""))
    .filter(Boolean);

  const input: SocialVideoInput = { filePath: file.path, title, description, tags };

  if (platform === "facebook" || platform === "all") {
    const config = loadFacebookConfig();
    const state = normalizeFacebookState((flags["facebook-state"] as string) ?? config.defaultVideoState);
    process.stdout.write(`Uploading to Facebook (${state})...\n`);
    if (isPauseMode) await promptEnter("Chuẩn bị gọi Meta Graph API để tải video Reel lên Facebook");
    const result = await new FacebookReelsPublisher(config).publish(input, state);
    process.stdout.write(`Facebook OK: video_id=${result.externalId}, state=${result.state}\n`);
    if (isPauseMode) await promptEnter("Đã hoàn tất đăng video Reel lên Facebook");
  }

  if (platform === "youtube" || platform === "all") {
    const config = loadYoutubePlaywrightConfig();
    const privacy = normalizeYoutubePrivacy((flags["youtube-privacy"] as string) ?? config.defaultPrivacy);
    const madeForKids = normalizeBoolean(
      (flags["made-for-kids"] as string) ?? String(config.defaultMadeForKids),
      "--made-for-kids",
    );

    process.stdout.write([
      "Uploading to YouTube via Playwright...",
      `[YouTube] profileDir=${config.profileDir}`,
      `[YouTube] profile=${config.chromeProfileDirectory ?? "Default"}`,
      `[YouTube] executable=${config.chromeExecutablePath ?? "Playwright bundled Chromium"}`,
      `[YouTube] privacy=${privacy}`,
      `[YouTube] pauseMode=${isPauseMode ? "ENABLED" : "disabled"}`,
      "",
    ].join("\n"));

    const result = await new YoutubePlaywrightPublisher(config).publish(input, {
      privacy,
      madeForKids,
      onStep: isPauseMode ? promptEnter : undefined,
    });
    process.stdout.write(
      `YouTube OK: video_id=${result.externalId}, state=${result.state}${result.url ? `, url=${result.url}` : ""}\n`,
    );
    if (isPauseMode) await promptEnter("Đã hoàn tất đăng video lên YouTube Studio");
  }
}

function parseFlags(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--") && !token?.startsWith("-")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.replace(/^-+/, "");
    const value = args[index + 1];
    if (!value || value.startsWith("-")) {
      result[key] = true;
    } else {
      result[key] = value;
      index += 1;
    }
  }
  return result;
}

function requiredFlag(flags: Record<string, string | boolean>, key: string): string {
  const value = typeof flags[key] === "string" ? (flags[key] as string).trim() : "";
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

function normalizeFacebookState(value: string): FacebookVideoState {
  const state = value.toUpperCase();
  if (state !== "DRAFT" && state !== "PUBLISHED") {
    throw new Error("--facebook-state must be DRAFT or PUBLISHED");
  }
  return state;
}

function normalizeYoutubePrivacy(value: string): YoutubePrivacy {
  const privacy = value.toLowerCase();
  if (!new Set(["private", "unlisted", "public"]).has(privacy)) {
    throw new Error("--youtube-privacy must be private, unlisted, or public");
  }
  return privacy as YoutubePrivacy;
}

function normalizeBoolean(value: string, name: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function printUsage(): void {
  process.stderr.write("Usage:\n");
  process.stderr.write("  npm run youtube:bootstrap\n");
  process.stderr.write(
    '  npm run upload:youtube -- --file /abs/video.mp4 --title "Title" --youtube-privacy private --made-for-kids false\n',
  );
  process.stderr.write(
    '  npm run social:upload -- --platform facebook --file /abs/video.mp4 --title "Title" --description "Caption" --facebook-state DRAFT\n',
  );
  process.stderr.write(
    '  npm run social:upload -- --platform youtube --file /abs/video.mp4 --title "Title" --description "Description" --youtube-privacy public --made-for-kids false\n',
  );
}
