import "dotenv/config";
import { loadFacebookConfig } from "./config.js";
import { FacebookStatusClient } from "./status.js";
import type { FacebookContentType, FacebookStatusResult } from "./types.js";

const args = process.argv.slice(2);

try {
  await main(args);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function main(argv: string[]): Promise<void> {
  const flags = parseArgs(argv);
  const id = required(flags.values, "id");
  const type = normalizeType(flags.values.type ?? "reel");
  const client = new FacebookStatusClient(loadFacebookConfig());

  const result = await client.getStatus(id, type);

  if (flags.booleans.has("json")) {
    process.stdout.write(`${JSON.stringify(result.raw, null, 2)}\n`);
    return;
  }

  printStatus(result);
}

function printStatus(result: FacebookStatusResult): void {
  process.stdout.write(`Facebook ${result.type} status\n`);
  process.stdout.write(`id: ${result.externalId}\n`);
  process.stdout.write(`video_status: ${result.videoStatus ?? "unknown"}\n`);
  if (result.processingProgress !== undefined) {
    process.stdout.write(`processing_progress: ${result.processingProgress}%\n`);
  }
  process.stdout.write(`uploading: ${result.uploading ?? "unknown"}\n`);
  process.stdout.write(`processing: ${result.processing ?? "unknown"}\n`);
  process.stdout.write(`publishing: ${result.publishing ?? "unknown"}\n`);
  process.stdout.write("\n");
  process.stdout.write(`permalink: ${result.permalinkUrl ?? "unavailable"}\n`);
  process.stdout.write(`preview: ${result.previewUrl ?? "unavailable"}\n`);
  process.stdout.write(`thumbnail: ${result.thumbnailUrl ?? "unavailable"}\n`);

  if (result.previewUrl) {
    process.stdout.write("note: preview/source URL may expire; do not persist it as a permanent URL.\n");
  }
}

interface ParsedArgs {
  values: Record<string, string>;
  booleans: Set<string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string> = {};
  const booleans = new Set<string>();
  const booleanFlags = new Set(["json"]);

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

function normalizeType(value: string): FacebookContentType {
  const normalized = value.toLowerCase();
  if (normalized !== "reel" && normalized !== "video") {
    throw new Error("--type must be reel or video");
  }
  return normalized;
}
