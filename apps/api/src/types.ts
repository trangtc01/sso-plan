import { FacebookContentType, Platform, PublishMode } from "@prisma/client";

export type { Platform, PublishMode, FacebookContentType, VideoStatus, PublishStatus } from "@prisma/client";

export interface CreateVideoInput {
  title: string;
  description: string;
  hashtags: string[] | string;
  sourcePath: string;
  platforms?: Platform[];
  publishAt?: string;
  facebookPublishMode?: PublishMode;
  facebookContentType?: FacebookContentType;
  youtubePublishMode?: PublishMode;
  tiktokPublishMode?: PublishMode;
  tiktokUseSound?: boolean | string;
}

export interface TtsProvider {
  synthesize(input: { text: string; outputPath: string }): Promise<{ path: string }>;
}

export interface Renderer {
  render(input: {
    sourcePath: string;
    voicePath?: string;
    subtitlePath?: string;
    musicPath?: string;
    outputPath: string;
  }): Promise<{ path: string }>;
}

export interface Publisher {
  readonly platform: Platform;
  publish(input: {
    outputPath: string;
    title: string;
    description: string;
    hashtags: string[];
    scheduledAt?: Date;
  }): Promise<{ externalId: string; response: Record<string, unknown> }>;
}

export interface Storage {
  put(input: { localPath: string; key: string }): Promise<{ key: string; url?: string }>;
  remove(key: string): Promise<void>;
}
