import type { FacebookConfig } from "./config.js";
import type { FacebookContentType, FacebookStatusResult } from "./types.js";

interface FacebookVideoStatusPayload {
  id?: string;
  status?: {
    video_status?: string;
    processing_progress?: number;
    uploading_phase?: { status?: string; errors?: unknown[] };
    processing_phase?: { status?: string; errors?: unknown[] };
    publishing_phase?: { status?: string; errors?: unknown[] };
    [key: string]: unknown;
  };
  permalink_url?: string;
  source?: string;
  picture?: string;
  error?: unknown;
  [key: string]: unknown;
}

export class FacebookStatusClient {
  constructor(private readonly config: FacebookConfig) {}

  async getStatus(id: string, type: FacebookContentType): Promise<FacebookStatusResult> {
    const normalizedId = id.trim();
    if (!/^\d+$/.test(normalizedId)) {
      throw new Error("--id must be a numeric Facebook video/reel id");
    }

    // Always fetch status first. Optional preview fields are fetched best-effort
    // because Meta can expose different fields depending on object type/state.
    const statusPayload = await this.graphGet(normalizedId, ["status"]);
    const optionalPayload = await this.getOptionalPreviewFields(normalizedId);
    const merged: FacebookVideoStatusPayload = {
      ...statusPayload,
      ...optionalPayload,
      status: statusPayload.status,
      id: statusPayload.id ?? optionalPayload.id ?? normalizedId,
    };

    const status = merged.status;
    return {
      platform: "facebook",
      type,
      externalId: merged.id ?? normalizedId,
      videoStatus: stringOrUndefined(status?.video_status),
      processingProgress: numberOrUndefined(status?.processing_progress),
      uploading: stringOrUndefined(status?.uploading_phase?.status),
      processing: stringOrUndefined(status?.processing_phase?.status),
      publishing: stringOrUndefined(status?.publishing_phase?.status),
      permalinkUrl: normalizeFacebookPermalink(stringOrUndefined(merged.permalink_url)),
      previewUrl: stringOrUndefined(merged.source),
      thumbnailUrl: stringOrUndefined(merged.picture),
      raw: merged,
    };
  }

  private async getOptionalPreviewFields(id: string): Promise<FacebookVideoStatusPayload> {
    const result: FacebookVideoStatusPayload = {};

    // Request each optional field separately. If one field is unsupported for a
    // draft/unpublished object, the remaining fields can still be returned.
    for (const field of ["permalink_url", "source", "picture"] as const) {
      try {
        const payload = await this.graphGet(id, [field]);
        result.id ??= payload.id;
        if (field === "permalink_url") result.permalink_url = stringOrUndefined(payload.permalink_url);
        if (field === "source") result.source = stringOrUndefined(payload.source);
        if (field === "picture") result.picture = stringOrUndefined(payload.picture);
      } catch {
        // Best effort only. Status must remain usable even if Meta doesn't expose
        // one of these fields for this object/state/token.
      }
    }

    return result;
  }

  private async graphGet(id: string, fields: string[]): Promise<FacebookVideoStatusPayload> {
    const url = new URL(
      `https://graph.facebook.com/${this.config.graphVersion}/${encodeURIComponent(id)}`,
    );
    url.searchParams.set("fields", fields.join(","));
    url.searchParams.set("access_token", this.config.pageAccessToken);

    const response = await fetch(url, { method: "GET" });
    const text = await response.text();
    const parsed = parseJson(text) as FacebookVideoStatusPayload | null;

    if (!response.ok) {
      throw new Error(
        `Facebook status API ${response.status}: ${safeJson(parsed ?? text)}`,
      );
    }

    return parsed ?? {};
  }
}

function normalizeFacebookPermalink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `https://www.facebook.com${value}`;
  return `https://www.facebook.com/${value.replace(/^\/+/, "")}`;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseJson(value: string): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function safeJson(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text
    .replace(/access_token=[^&\s\"]+/gi, "access_token=[REDACTED]")
    .replace(/EA[A-Za-z0-9_-]{20,}/g, "[REDACTED_TOKEN]");
}
