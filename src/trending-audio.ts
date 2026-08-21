export interface TrendingAudioCandidate {
  videoUrl: string;
  videoId?: string;
  videoPlayCount: number;
  musicId: string;
  musicTitle: string;
  musicAuthor?: string;
  musicDuration: number;
  musicPlayUrl: string;
}

export function parseCompactCount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const normalized = value.trim().replace(/,/g, "");
  const match = normalized.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  const suffix = (match[2] ?? "").toUpperCase();
  const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
  return Math.round(amount * multiplier);
}

export function selectBestTrendingAudio(
  candidates: TrendingAudioCandidate[],
  videoDuration: number,
): TrendingAudioCandidate | undefined {
  if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
    throw new Error("videoDuration must be a positive number");
  }

  const bestByMusicId = new Map<string, TrendingAudioCandidate>();

  for (const candidate of candidates) {
    if (!candidate.musicId || !candidate.musicPlayUrl) continue;
    if (!Number.isFinite(candidate.musicDuration) || candidate.musicDuration < videoDuration) continue;
    if (!Number.isFinite(candidate.videoPlayCount) || candidate.videoPlayCount <= 0) continue;

    const existing = bestByMusicId.get(candidate.musicId);
    if (!existing || candidate.videoPlayCount > existing.videoPlayCount) {
      bestByMusicId.set(candidate.musicId, candidate);
    }
  }

  return [...bestByMusicId.values()].sort((a, b) => {
    if (b.videoPlayCount !== a.videoPlayCount) return b.videoPlayCount - a.videoPlayCount;
    return a.musicDuration - b.musicDuration;
  })[0];
}

export function findVideoItemInHydration(root: unknown): Record<string, unknown> | undefined {
  const seen = new Set<object>();
  const queue: unknown[] = [root];

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current as object)) continue;
    seen.add(current as object);

    if (looksLikeVideoItem(current)) return current as Record<string, unknown>;

    if (Array.isArray(current)) {
      queue.push(...current);
    } else {
      queue.push(...Object.values(current as Record<string, unknown>));
    }
  }

  return undefined;
}

function looksLikeVideoItem(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  const stats = obj.stats;
  const music = obj.music;
  if (!stats || typeof stats !== "object" || !music || typeof music !== "object") return false;

  const playCount = Number((stats as Record<string, unknown>).playCount ?? 0);
  const musicId = String((music as Record<string, unknown>).id ?? "");
  return playCount > 0 && musicId.length > 0;
}
