export type FacebookContentType = "reel" | "video";
export type FacebookCliContentType = FacebookContentType | "both";
export type FacebookPublishMode = "draft" | "public";

export interface FacebookVideoInput {
  filePath: string;
  title?: string;
  description?: string;
  hashtags?: string[];
}

export interface FacebookPublishResult {
  platform: "facebook";
  type: FacebookContentType;
  externalId: string;
  mode: FacebookPublishMode;
  raw?: unknown;
}

export interface FacebookStatusResult {
  platform: "facebook";
  type: FacebookContentType;
  externalId: string;
  videoStatus?: string;
  processingProgress?: number;
  uploading?: string;
  processing?: string;
  publishing?: string;

  /** Facebook permalink when Meta exposes it for this object/state. */
  permalinkUrl?: string;

  /** Direct video/CDN URL. Treat as temporary and do not persist long-term. */
  previewUrl?: string;

  /** Thumbnail/picture URL. Can also be temporary. */
  thumbnailUrl?: string;

  raw?: unknown;
}
