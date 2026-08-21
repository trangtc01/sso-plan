import { randomUUID } from "node:crypto";
import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  FacebookContentType,
  Platform,
  PublishMode,
} from "@prisma/client";

export interface BulkImportRow {
  line: number;
  sourcePath: string;
  title: string;
  description: string;
  hashtags: string[];
  platforms: Platform[];
  publishAt: string;
  tiktokPublishMode?: PublishMode;
  tiktokUseSound: boolean;
  facebookPublishMode?: PublishMode;
  facebookContentType?: FacebookContentType;
  youtubePublishMode?: PublishMode;
}

export class BulkImportParseError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid import file:\n${problems.join("\n")}`);
  }
}

const BASE_HEADERS = [
  "video_path",
  "title",
  "description",
  "hashtags",
  "platforms",
  "publish_at",
] as const;

export function parseBulkImportText(
  text: string,
  options: {
    baseDir?: string;
    timezoneOffset?: string;
    format?: "tsv" | "csv";
  } = {},
): BulkImportRow[] {
  const rows: BulkImportRow[] = [];
  const problems: string[] = [];
  const timezoneOffset = normalizeTimezoneOffset(options.timezoneOffset ?? "+07:00");
  const format = options.format ?? "tsv";
  const delimiter = format === "csv" ? "," : "\t";

  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let headerMap: Map<string, number> | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = lines[index] ?? "";
    if (!raw.trim() || raw.trimStart().startsWith("//")) continue;

    let columns: string[];
    try {
      columns = splitDelimitedLine(raw, delimiter);
    } catch (error) {
      problems.push(`Line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const normalizedFirst = normalizeHeader(columns[0] ?? "");
    if (!headerMap && normalizedFirst === "video_path") {
      headerMap = new Map(
        columns.map((column, columnIndex) => [normalizeHeader(column), columnIndex]),
      );
      const missing = BASE_HEADERS.filter(header => !headerMap!.has(header));
      if (missing.length) {
        problems.push(`Line ${lineNumber}: missing required header(s): ${missing.join(", ")}`);
      }
      continue;
    }

    if (!headerMap && (columns.length < 6 || columns.length > 11)) {
      problems.push(
        `Line ${lineNumber}: expected 6-11 ${format === "csv" ? "CSV" : "TAB-separated"} columns, got ${columns.length}`,
      );
      continue;
    }

    const get = (name: string, positionalIndex: number): string => {
      if (headerMap) {
        const columnIndex = headerMap.get(name);
        return columnIndex === undefined ? "" : (columns[columnIndex] ?? "");
      }
      return columns[positionalIndex] ?? "";
    };

    try {
      const sourcePath = resolveSourcePath(get("video_path", 0).trim(), options.baseDir);
      const title = get("title", 1).trim();
      if (!title) throw new Error("title is required");
      if (title.length > 200) throw new Error("title must be <= 200 characters");

      const description = get("description", 2).trim();
      const hashtags = get("hashtags", 3)
        .split(",")
        .map(item => item.trim().replace(/^#/, ""))
        .filter(Boolean);
      const platforms = parsePlatforms(get("platforms", 4));
      const publishAt = normalizePublishAt(get("publish_at", 5).trim(), timezoneOffset);

      rows.push({
        line: lineNumber,
        sourcePath,
        title,
        description,
        hashtags,
        platforms,
        publishAt,
        tiktokPublishMode: parseOptionalPublishMode(get("tiktok_mode", 6), "tiktok_mode"),
        tiktokUseSound: parseBoolean(get("tiktok_use_sound", 7), true, "tiktok_use_sound"),
        facebookPublishMode: parseOptionalPublishMode(get("facebook_mode", 8), "facebook_mode"),
        facebookContentType: parseOptionalFacebookType(get("facebook_type", 9)),
        youtubePublishMode: parseOptionalPublishMode(get("youtube_mode", 10), "youtube_mode"),
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
  if (![".mp4", ".mov"].includes(extension)) {
    throw new Error(`unsupported video extension: ${extension || "none"}`);
  }
  await access(sourcePath);
  await mkdir(storageDir, { recursive: true });
  const destination = path.join(storageDir, `${randomUUID()}${extension}`);
  await copyFile(sourcePath, destination);
  return destination;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function splitDelimitedLine(raw: string, delimiter: string): string[] {
  if (delimiter === "\t") return raw.split("\t");

  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (char === '"') {
      if (inQuotes && raw[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) throw new Error("unclosed quoted CSV field");
  result.push(current);
  return result;
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

  const result = [...new Set(
    value
      .split(",")
      .map(item => aliases[item.trim().toUpperCase()])
      .filter((item): item is Platform => Boolean(item)),
  )];

  if (!result.length) {
    throw new Error("platforms must contain FACEBOOK, YOUTUBE, and/or TIKTOK");
  }
  return result;
}

function parseOptionalPublishMode(value: string, fieldName: string): PublishMode | undefined {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized === PublishMode.PUBLIC || normalized === PublishMode.DRAFT) {
    return normalized as PublishMode;
  }
  throw new Error(`${fieldName} must be PUBLIC or DRAFT`);
}

function parseOptionalFacebookType(value: string): FacebookContentType | undefined {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  if (
    normalized === FacebookContentType.REEL ||
    normalized === FacebookContentType.VIDEO_POST
  ) {
    return normalized as FacebookContentType;
  }
  throw new Error("facebook_type must be REEL or VIDEO_POST");
}

function parseBoolean(value: string, fallback: boolean, fieldName: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y", "on", "co", "có"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off", "khong", "không"].includes(normalized)) return false;
  throw new Error(`${fieldName} must be true/false`);
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
