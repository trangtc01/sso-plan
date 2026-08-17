import { Platform } from "@prisma/client";

export const QUEUES = { voice: "voice", render: "render", facebook: "publish-facebook", youtube: "publish-youtube", tiktok: "publish-tiktok", cleanup: "cleanup" } as const;
export interface TtsProvider { synthesize(input: { text: string; outputPath: string }): Promise<{ path: string }>; }
export interface Renderer { render(input: { sourcePath: string; voicePath?: string; subtitlePath?: string; musicPath?: string; outputPath: string }): Promise<{ path: string }>; }
export interface Publisher { readonly platform: Platform; publish(input: { outputPath: string; title: string; description: string; hashtags: string[]; scheduledAt?: Date }): Promise<{ externalId: string; response: Record<string, unknown> }>; }
export interface Storage { put(input: { localPath: string; key: string }): Promise<{ key: string; url?: string }>; remove(key: string): Promise<void>; }
export class PublisherRegistry {
  constructor(private readonly publishers: Publisher[]) {}
  for(platform: Platform): Publisher { const publisher = this.publishers.find(item => item.platform === platform); if (!publisher) throw new Error(`publisher not configured: ${platform}`); return publisher; }
}
