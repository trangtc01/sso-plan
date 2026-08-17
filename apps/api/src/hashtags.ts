import { BadRequestException } from "@nestjs/common";

export function normalizeHashtags(values: string[] | string | undefined): string[] {
  const parsed = typeof values === "string" ? parseHashtags(values) : values;
  if (!Array.isArray(parsed)) throw new BadRequestException("hashtags must be a JSON array or comma-separated string");
  return [...new Set(parsed.map(value => value.trim().replace(/^#/, "")).filter(Boolean))];
}

function parseHashtags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) return parsed;
  } catch { /* comma-separated values are also accepted for direct API clients */ }
  return value.split(",");
}
