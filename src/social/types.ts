export type FacebookVideoState = "DRAFT" | "PUBLISHED";
export type FacebookContentType = "REEL" | "VIDEO_POST";
export type YoutubePrivacy = "private" | "unlisted" | "public";

export interface SocialVideoInput {
  filePath: string;
  title: string;
  description?: string;
  tags?: string[];
}

export interface PublishResult {
  platform: "facebook" | "youtube";
  externalId: string;
  state?: string;
  url?: string;
  raw?: unknown;
}
