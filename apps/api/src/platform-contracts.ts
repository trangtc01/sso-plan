import { Platform } from "@prisma/client";
import { QUEUES } from "./constants.js";
import type { Publisher, Renderer, Storage, TtsProvider } from "./types.js";

export { QUEUES };
export type { TtsProvider, Renderer, Publisher, Storage };

export class PublisherRegistry {
  constructor(private readonly publishers: Publisher[]) {}
  for(platform: Platform): Publisher {
    const publisher = this.publishers.find(item => item.platform === platform);
    if (!publisher) throw new Error(`publisher not configured: ${platform}`);
    return publisher;
  }
}
