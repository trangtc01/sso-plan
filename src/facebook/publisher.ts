import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { request as httpsRequest } from "node:https";
import type { FacebookConfig } from "./config.js";
import { validateFacebookVideoFile, type ValidatedFacebookVideoFile } from "./file.js";
import type {
  FacebookContentType,
  FacebookPublishMode,
  FacebookPublishResult,
  FacebookVideoInput,
} from "./types.js";

interface ReelStartResponse {
  video_id?: string;
  upload_url?: string;
  error?: unknown;
}

interface ReelFinishResponse {
  success?: boolean;
  error?: unknown;
}

interface PageVideoResponse {
  id?: string;
  error?: unknown;
}

export class FacebookPublisher {
  constructor(private readonly config: FacebookConfig) {}

  async publish(
    type: FacebookContentType,
    input: FacebookVideoInput,
    mode: FacebookPublishMode,
  ): Promise<FacebookPublishResult> {
    if (type === "reel") return this.publishReel(input, mode);
    return this.publishVideo(input, mode);
  }

  async publishReel(
    input: FacebookVideoInput,
    mode: FacebookPublishMode,
  ): Promise<FacebookPublishResult> {
    const file = await validateFacebookVideoFile(input.filePath);
    const target = this.config.pageId ?? "me";
    const title = input.title?.trim() || file.defaultTitle;
    const description = buildDescription(input.description, input.hashtags);

    const started = await this.graphPost<ReelStartResponse>(`${target}/video_reels`, {
      upload_phase: "start",
    });

    if (!started.video_id || !started.upload_url) {
      throw new Error(`Facebook Reel start did not return video_id/upload_url: ${safeJson(started)}`);
    }

    await uploadReelBinary(
      started.upload_url,
      file.path,
      file.size,
      this.config.pageAccessToken,
    );

    const finished = await this.graphPost<ReelFinishResponse>(`${target}/video_reels`, {
      video_id: started.video_id,
      upload_phase: "finish",
      video_state: mode === "public" ? "PUBLISHED" : "DRAFT",
      title,
      description: description || undefined,
    });

    if (finished.success !== true) {
      throw new Error(`Facebook Reel finish failed: ${safeJson(finished)}`);
    }

    return {
      platform: "facebook",
      type: "reel",
      externalId: started.video_id,
      mode,
      raw: finished,
    };
  }

  async publishVideo(
    input: FacebookVideoInput,
    mode: FacebookPublishMode,
  ): Promise<FacebookPublishResult> {
    const file = await validateFacebookVideoFile(input.filePath);
    const target = this.config.pageId ?? "me";
    const title = input.title?.trim() || file.defaultTitle;
    const description = buildDescription(input.description, input.hashtags);

    const response = await uploadPageVideoMultipart({
      graphVersion: this.config.graphVersion,
      target,
      pageAccessToken: this.config.pageAccessToken,
      file,
      title,
      description,
      published: mode === "public",
    });

    if (!response.id) {
      throw new Error(`Facebook Page video upload did not return id: ${safeJson(response)}`);
    }

    return {
      platform: "facebook",
      type: "video",
      externalId: response.id,
      mode,
      raw: response,
    };
  }

  private async graphPost<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const url = new URL(`https://graph.facebook.com/${this.config.graphVersion}/${path}`);
    url.searchParams.set("access_token", this.config.pageAccessToken);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, value);
    }

    const response = await fetch(url, { method: "POST" });
    const text = await response.text();
    const parsed = parseJson(text);

    if (!response.ok) {
      throw new Error(`Facebook Graph API ${response.status}: ${safeJson(parsed ?? text)}`);
    }

    return (parsed ?? {}) as T;
  }
}

async function uploadReelBinary(
  uploadUrl: string,
  filePath: string,
  fileSize: number,
  pageAccessToken: string,
): Promise<void> {
  const url = new URL(uploadUrl);

  await new Promise<void>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `OAuth ${pageAccessToken}`,
          offset: "0",
          file_size: String(fileSize),
          "Content-Type": "application/octet-stream",
          "Content-Length": String(fileSize),
        },
      },
      response => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const parsed = parseJson(body) as ReelFinishResponse | null;
          const status = response.statusCode ?? 500;
          if (status < 200 || status >= 300 || parsed?.success !== true) {
            reject(new Error(`Facebook Reel binary upload failed (${status}): ${safeJson(parsed ?? body)}`));
            return;
          }
          resolve();
        });
      },
    );

    request.on("error", reject);
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.pipe(request);
  });
}

interface UploadPageVideoArgs {
  graphVersion: string;
  target: string;
  pageAccessToken: string;
  file: ValidatedFacebookVideoFile;
  title: string;
  description: string;
  published: boolean;
}

async function uploadPageVideoMultipart(args: UploadPageVideoArgs): Promise<PageVideoResponse> {
  const boundary = `----ssoPlanFacebook${randomBytes(12).toString("hex")}`;
  const fields: Array<[string, string]> = [
    ["title", args.title],
    ["description", args.description],
    ["published", args.published ? "true" : "false"],
  ];

  const preambleParts: Buffer[] = [];
  for (const [name, value] of fields) {
    preambleParts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${escapeHeaderValue(name)}"\r\n\r\n` +
      `${value}\r\n`,
      "utf8",
    ));
  }

  preambleParts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="source"; filename="${escapeHeaderValue(args.file.filename)}"\r\n` +
    `Content-Type: ${args.file.mimeType}\r\n\r\n`,
    "utf8",
  ));

  const preamble = Buffer.concat(preambleParts);
  const postamble = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const contentLength = preamble.length + args.file.size + postamble.length;

  const url = new URL(
    `https://graph-video.facebook.com/${args.graphVersion}/${args.target}/videos`,
  );
  url.searchParams.set("access_token", args.pageAccessToken);

  return new Promise<PageVideoResponse>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(contentLength),
        },
      },
      response => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const status = response.statusCode ?? 500;
          const body = Buffer.concat(chunks).toString("utf8");
          const parsed = parseJson(body) as PageVideoResponse | null;

          if (status < 200 || status >= 300) {
            reject(new Error(`Facebook Page video upload failed (${status}): ${safeJson(parsed ?? body)}`));
            return;
          }

          resolve(parsed ?? {});
        });
      },
    );

    request.on("error", reject);
    request.write(preamble);

    const stream = createReadStream(args.file.path);
    stream.on("error", reject);
    stream.on("end", () => request.end(postamble));
    stream.pipe(request, { end: false });
  });
}

function buildDescription(description?: string, hashtags?: string[]): string {
  const text = description?.trim() ?? "";
  const tags = (hashtags ?? [])
    .map(tag => tag.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map(tag => `#${tag}`)
    .join(" ");

  if (text && tags) return `${text}\n\n${tags}`;
  return text || tags;
}

function escapeHeaderValue(value: string): string {
  return value.replace(/["\r\n]/g, "_");
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
    .replace(/access_token=[^&\s"]+/gi, "access_token=[REDACTED]")
    .replace(/EA[A-Za-z0-9_-]{20,}/g, "[REDACTED_TOKEN]");
}
