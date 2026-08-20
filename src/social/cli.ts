import "dotenv/config";
import { loadFacebookConfig, loadYoutubePlaywrightConfig } from "./config.js";
import { validateVideoFile } from "./file.js";
import { FacebookReelsPublisher } from "./facebook-publisher.js";
import { YoutubePlaywrightPublisher } from "./youtube-playwright-publisher.js";
import { bootstrapYoutubeProfile } from "./youtube-profile-bootstrap.js";
import type { FacebookVideoState, SocialVideoInput, YoutubePrivacy } from "./types.js";

const [command, ...args] = process.argv.slice(2);

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
  const platform = (flags.platform ?? "all").toLowerCase();
  if (!new Set(["facebook", "youtube", "all"]).has(platform)) {
    throw new Error("--platform must be facebook, youtube, or all");
  }

  const fileArg = requiredFlag(flags, "file");
  const file = await validateVideoFile(fileArg);
  const title = flags.title?.trim() || file.defaultTitle;
  const description = flags.description ?? "";
  const tags = (flags.tags ?? "")
    .split(",")
    .map(value => value.trim().replace(/^#/, ""))
    .filter(Boolean);

  const input: SocialVideoInput = { filePath: file.path, title, description, tags };

  if (platform === "facebook" || platform === "all") {
    const config = loadFacebookConfig();
    const state = normalizeFacebookState(flags["facebook-state"] ?? config.defaultVideoState);
    process.stdout.write(`Uploading to Facebook (${state})...\n`);
    const result = await new FacebookReelsPublisher(config).publish(input, state);
    process.stdout.write(`Facebook OK: video_id=${result.externalId}, state=${result.state}\n`);
  }

  if (platform === "youtube" || platform === "all") {
    const config = loadYoutubePlaywrightConfig();
    const privacy = normalizeYoutubePrivacy(flags["youtube-privacy"] ?? config.defaultPrivacy);
    const madeForKids = normalizeBoolean(
      flags["made-for-kids"] ?? String(config.defaultMadeForKids),
      "--made-for-kids",
    );

    process.stdout.write([
      "Uploading to YouTube via Playwright...",
      `[YouTube] profileDir=${config.profileDir}`,
      `[YouTube] profile=${config.chromeProfileDirectory ?? "Default"}`,
      `[YouTube] executable=${config.chromeExecutablePath ?? "Playwright bundled Chromium"}`,
      `[YouTube] privacy=${privacy}`,
      "",
    ].join("\n"));

    const result = await new YoutubePlaywrightPublisher(config).publish(input, { privacy, madeForKids });
    process.stdout.write(
      `YouTube OK: video_id=${result.externalId}, state=${result.state}${result.url ? `, url=${result.url}` : ""}\n`,
    );
  }
}

function parseFlags(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token?.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function requiredFlag(flags: Record<string, string>, key: string): string {
  const value = flags[key]?.trim();
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
