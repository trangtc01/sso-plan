import { createReadStream } from "node:fs";
import { request as httpsRequest } from "node:https";
import type { FacebookConfig } from "./config.js";
import type { FacebookVideoState, PublishResult, SocialVideoInput } from "./types.js";
import { validateVideoFile } from "./file.js";

interface StartReelResponse {
  video_id?: string;
  upload_url?: string;
  error?: unknown;
}

interface SuccessResponse {
  success?: boolean;
  error?: unknown;
}

export class FacebookReelsPublisher {
  constructor(private readonly config: FacebookConfig) {}

  async publish(
    input: SocialVideoInput,
    videoState: FacebookVideoState = this.config.defaultVideoState,
  ): Promise<PublishResult> {
    const file = await validateVideoFile(input.filePath);
    const target = this.config.pageId ?? "me";

    const started = await this.graphPost<StartReelResponse>(`${target}/video_reels`, {
      upload_phase: "start",
    });

    if (!started.video_id || !started.upload_url) {
      throw new Error(`Facebook did not return video_id/upload_url: ${safeJson(started)}`);
    }

    await uploadBinary(started.upload_url, file.path, file.size, this.config.pageAccessToken);

    const description = input.description?.trim() || undefined;
    const finished = await this.graphPost<SuccessResponse>(`${target}/video_reels`, {
      video_id: started.video_id,
      upload_phase: "finish",
      video_state: videoState,
      title: input.title,
      description,
    });

    if (finished.success !== true) {
      throw new Error(`Facebook finish/publish failed: ${safeJson(finished)}`);
    }

    return {
      platform: "facebook",
      externalId: started.video_id,
      state: videoState,
      raw: finished,
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

async function uploadBinary(
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
          const parsed = parseJson(body) as SuccessResponse | null;
          const okStatus = (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300;

          if (!okStatus || parsed?.success !== true) {
            reject(new Error(`Facebook binary upload failed (${response.statusCode}): ${safeJson(parsed ?? body)}`));
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
  return text.replace(/access_token=[^&\s"]+/gi, "access_token=[REDACTED]");
}
