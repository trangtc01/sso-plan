import { randomUUID } from "node:crypto";
import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Platform } from "@prisma/client";

export interface BulkImportRow {
  line: number;
  sourcePath: string;
  title: string;
  description: string;
  hashtags: string[];
  platforms: Platform[];
  publishAt: string;
}

export class BulkImportParseError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid import file:\n${problems.join("\n")}`);
  }
}

export function parseBulkImportText(
  text: string,
  options: { baseDir?: string; timezoneOffset?: string } = {},
): BulkImportRow[] {
  const rows: BulkImportRow[] = [];
  const problems: string[] = [];
  const timezoneOffset = normalizeTimezoneOffset(options.timezoneOffset ?? "+07:00");

  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = lines[index] ?? "";
    if (!raw.trim() || raw.trimStart().startsWith("//")) continue;
    if (/^video_path\t/i.test(raw)) continue;

    const columns = raw.split("\t");
    if (columns.length !== 6) {
      problems.push(`Line ${lineNumber}: expected 6 TAB-separated columns, got ${columns.length}`);
      continue;
    }

    const [videoPathRaw, titleRaw, descriptionRaw, hashtagsRaw, platformsRaw, publishAtRaw] = columns;
    try {
      const sourcePath = resolveSourcePath(videoPathRaw.trim(), options.baseDir);
      const title = titleRaw.trim();
      if (!title) throw new Error("title is required");
      if (title.length > 200) throw new Error("title must be <= 200 characters");

      const platforms = parsePlatforms(platformsRaw);
      const publishAt = normalizePublishAt(publishAtRaw.trim(), timezoneOffset);
      rows.push({
        line: lineNumber,
        sourcePath,
        title,
        description: descriptionRaw.trim(),
        hashtags: hashtagsRaw.split(",").map(item => item.trim().replace(/^#/, "")).filter(Boolean),
        platforms,
        publishAt,
      });
    } catch (error) {
      problems.push(`Line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!rows.length && !problems.length) problems.push("No data rows found");
  if (problems.length) throw new BulkImportParseError(problems);
  return rows;
}

export async function stageImportedVideo(sourcePath: string, storageDir: string): Promise<string> {
  const extension = path.extname(sourcePath).toLowerCase();
  if (![".mp4", ".mov"].includes(extension)) throw new Error(`unsupported video extension: ${extension || "none"}`);
  await access(sourcePath);
  await mkdir(storageDir, { recursive: true });
  const destination = path.join(storageDir, `${randomUUID()}${extension}`);
  await copyFile(sourcePath, destination);
  return destination;
}

function resolveSourcePath(value: string, baseDir?: string): string {
  if (!value) throw new Error("video_path is required");
  if (path.isAbsolute(value)) return path.normalize(value);
  if (!baseDir) throw new Error("relative video_path requires BULK_VIDEO_BASE_DIR");
  return path.resolve(baseDir, value);
}

function parsePlatforms(value: string): Platform[] {
  const aliases: Record<string, Platform> = {
    FB: Platform.FACEBOOK,
    FACEBOOK: Platform.FACEBOOK,
    YT: Platform.YOUTUBE,
    YOUTUBE: Platform.YOUTUBE,
    TT: Platform.TIKTOK,
    TIKTOK: Platform.TIKTOK,
  };
  const result = [...new Set(value.split(",").map(item => aliases[item.trim().toUpperCase()]).filter((item): item is Platform => Boolean(item)))];
  if (!result.length) throw new Error("platforms must contain FACEBOOK, YOUTUBE, and/or TIKTOK");
  return result;
}

function normalizePublishAt(value: string, timezoneOffset: string): string {
  if (!value) throw new Error("publish_at is required");
  const localMatch = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
  const normalized = localMatch
    ? `${localMatch[1]}T${localMatch[2]}:${localMatch[3] ?? "00"}${timezoneOffset}`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid publish_at: ${value}`);
  return date.toISOString();
}

function normalizeTimezoneOffset(value: string): string {
  if (!/^[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("BULK_IMPORT_TIMEZONE_OFFSET must look like +07:00");
  }
  return value;
}
