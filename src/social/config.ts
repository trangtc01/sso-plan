import os from "node:os";
import path from "node:path";
import type { FacebookVideoState, YoutubePrivacy } from "./types.js";

export interface FacebookConfig {
  pageAccessToken: string;
  graphVersion: string;
  pageId?: string;
  defaultVideoState: FacebookVideoState;
}

export interface YoutubePlaywrightConfig {
  profileDir: string;
  artifactDir: string;
  uploadUrl: string;
  previewUrl: string;
  chromeExecutablePath?: string;
  chromeProfileDirectory?: string;
  defaultPrivacy: YoutubePrivacy;
  defaultMadeForKids: boolean;
  navigationTimeoutMs: number;
  uploadTimeoutMs: number;
}

export function loadFacebookConfig(env = process.env): FacebookConfig {
  const pageAccessToken = required(env.FB_PAGE_ACCESS_TOKEN, "FB_PAGE_ACCESS_TOKEN");
  const graphVersion = normalizeGraphVersion(env.FB_GRAPH_VERSION ?? "v25.0");
  const state = (env.FB_DEFAULT_VIDEO_STATE ?? "DRAFT").toUpperCase();
  if (state !== "DRAFT" && state !== "PUBLISHED") {
    throw new Error("FB_DEFAULT_VIDEO_STATE must be DRAFT or PUBLISHED");
  }
  return {
    pageAccessToken,
    graphVersion,
    pageId: env.FB_PAGE_ID?.trim() || undefined,
    defaultVideoState: state,
  };
}

export function loadYoutubePlaywrightConfig(env = process.env): YoutubePlaywrightConfig {
  const privacy = normalizeYoutubePrivacy(env.YOUTUBE_DEFAULT_PRIVACY ?? "public");
  const navigationTimeoutMs = positiveInteger(env.YOUTUBE_NAVIGATION_TIMEOUT_MS ?? "60000", "YOUTUBE_NAVIGATION_TIMEOUT_MS");
  const uploadTimeoutMs = positiveInteger(env.YOUTUBE_UPLOAD_TIMEOUT_MS ?? "600000", "YOUTUBE_UPLOAD_TIMEOUT_MS");
  return {
    profileDir: resolveUserPath(env.YOUTUBE_PROFILE_DIR ?? "~/.sso-plan/youtube-profile"),
    artifactDir: resolveUserPath(env.YOUTUBE_ARTIFACT_DIR ?? ".social-automation/youtube-artifacts"),
    uploadUrl: env.YOUTUBE_UPLOAD_URL?.trim() || "https://studio.youtube.com",
    previewUrl: env.YOUTUBE_PREVIEW_URL?.trim() || "https://studio.youtube.com",
    chromeExecutablePath: env.YOUTUBE_CHROME_EXECUTABLE?.trim() || defaultChromeExecutable(),
    chromeProfileDirectory: env.YOUTUBE_CHROME_PROFILE_DIRECTORY?.trim() || "Default",
    defaultPrivacy: privacy,
    defaultMadeForKids: booleanValue(env.YOUTUBE_DEFAULT_MADE_FOR_KIDS ?? "false", "YOUTUBE_DEFAULT_MADE_FOR_KIDS"),
    navigationTimeoutMs,
    uploadTimeoutMs,
  };
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function normalizeGraphVersion(version: string): string {
  const value = version.trim();
  if (!/^v\d+\.\d+$/.test(value)) throw new Error("FB_GRAPH_VERSION must look like v25.0");
  return value;
}

function normalizeYoutubePrivacy(value: string): YoutubePrivacy {
  const privacy = value.trim().toLowerCase();
  if (!new Set(["private", "unlisted", "public"]).has(privacy)) {
    throw new Error("YOUTUBE_DEFAULT_PRIVACY must be private, unlisted, or public");
  }
  return privacy as YoutubePrivacy;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function booleanValue(value: string, name: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function resolveUserPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
  return path.resolve(trimmed);
}

function defaultChromeExecutable(): string | undefined {
  if (process.platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return undefined;
}
