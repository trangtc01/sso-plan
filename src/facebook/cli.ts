import "dotenv/config";
import { loadFacebookConfig } from "./config.js";
import { FacebookPublisher } from "./publisher.js";
import type {
  FacebookCliContentType,
  FacebookContentType,
  FacebookPublishMode,
  FacebookVideoInput,
} from "./types.js";

const args = process.argv.slice(2);

try {
  await main(args);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function main(argv: string[]): Promise<void> {
  const flags = parseArgs(argv);
  const filePath = required(flags.values, "file");
  const type = normalizeType(flags.values.type ?? "reel");
  const mode: FacebookPublishMode = flags.booleans.has("public") ? "public" : "draft";

  const hashtags = (flags.values.hashtags ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  const input: FacebookVideoInput = {
    filePath,
    title: flags.values.title,
    description: flags.values.description,
    hashtags,
  };

  const targets: FacebookContentType[] = type === "both" ? ["reel", "video"] : [type];
  const publisher = new FacebookPublisher(loadFacebookConfig());
  const failures: Array<{ type: FacebookContentType; error: unknown }> = [];

  process.stdout.write(`Facebook upload mode: ${mode.toUpperCase()}\n`);
  process.stdout.write(`Content type: ${type}\n`);
  process.stdout.write(`File: ${filePath}\n\n`);

  for (const target of targets) {
    process.stdout.write(`Uploading Facebook ${target}...\n`);
    try {
      const result = await publisher.publish(target, input, mode);
      process.stdout.write(
        `Facebook ${target} OK: id=${result.externalId}, mode=${result.mode}\n`,
      );
    } catch (error) {
      failures.push({ type: target, error });
      process.stderr.write(
        `Facebook ${target} FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  if (failures.length > 0) {
    if (targets.length > 1) {
      process.stderr.write(
        "WARNING: --type both can partially succeed. Check Facebook before retrying to avoid duplicate content.\n",
      );
    }
    process.exitCode = 1;
  }
}

interface ParsedArgs {
  values: Record<string, string>;
  booleans: Set<string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string> = {};
  const booleans = new Set<string>();
  const booleanFlags = new Set(["public"]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);

    const key = token.slice(2);
    if (booleanFlags.has(key)) {
      booleans.add(key);
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    values[key] = value;
    index += 1;
  }

  return { values, booleans };
}

function required(values: Record<string, string>, key: string): string {
  const value = values[key]?.trim();
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

function normalizeType(value: string): FacebookCliContentType {
  const normalized = value.toLowerCase();
  if (!new Set(["reel", "video", "both"]).has(normalized)) {
    throw new Error("--type must be reel, video, or both");
  }
  return normalized as FacebookCliContentType;
}
