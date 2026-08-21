export type Platform = "TIKTOK" | "FACEBOOK" | "YOUTUBE";
export type PublishMode = "DRAFT" | "PUBLIC";
export type FacebookContentType = "REEL" | "VIDEO_POST";

export type TikTokJob = {
  id: string;
  status: string;
  retryCount: number;
  errorMessage?: string;
  publishTime?: string;
  publishMode: PublishMode;
  useSound: boolean;
};

export type PublishJob = {
  id: string;
  platform: Platform;
  publishMode?: PublishMode;
  facebookContentType?: FacebookContentType;
  publishTime?: string;
  status: string;
  retryCount: number;
  errorMessage?: string;
  useTikTokSource: boolean;
  response?: unknown;
};

export type Video = {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  status: string;
  createdAt: string;
  sourcePath?: string;
  outputPath?: string;
  tiktokPublishedUrl?: string;
  tiktokDownloadedPath?: string;
  jobs: TikTokJob[];
  publishJobs: PublishJob[];
};

export type VideoPage = {
  items: Video[];
  page: number;
  perPage: number;
  total: number;
};
