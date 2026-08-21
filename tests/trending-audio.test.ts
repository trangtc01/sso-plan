import test from "node:test";
import assert from "node:assert/strict";
import { parseCompactCount, selectBestTrendingAudio, type TrendingAudioCandidate } from "../src/trending-audio.js";

test("parseCompactCount parses K/M/B suffixes", () => {
  assert.equal(parseCompactCount("157.1K"), 157_100);
  assert.equal(parseCompactCount("2.5M"), 2_500_000);
  assert.equal(parseCompactCount("1.2B"), 1_200_000_000);
  assert.equal(parseCompactCount("987"), 987);
});

test("selectBestTrendingAudio filters by duration and picks highest play count", () => {
  const candidates: TrendingAudioCandidate[] = [
    {
      videoUrl: "https://www.tiktok.com/@a/video/1",
      videoPlayCount: 8_000_000,
      musicId: "short",
      musicTitle: "Short",
      musicDuration: 20,
      musicPlayUrl: "https://example.com/short.mp3",
    },
    {
      videoUrl: "https://www.tiktok.com/@b/video/2",
      videoPlayCount: 4_000_000,
      musicId: "valid",
      musicTitle: "Valid",
      musicDuration: 45,
      musicPlayUrl: "https://example.com/valid.mp3",
    },
    {
      videoUrl: "https://www.tiktok.com/@c/video/3",
      videoPlayCount: 6_000_000,
      musicId: "other",
      musicTitle: "Other",
      musicDuration: 60,
      musicPlayUrl: "https://example.com/other.mp3",
    },
  ];

  assert.equal(selectBestTrendingAudio(candidates, 30)?.musicId, "other");
});

test("selectBestTrendingAudio deduplicates the same sound by musicId", () => {
  const candidates: TrendingAudioCandidate[] = [
    {
      videoUrl: "https://www.tiktok.com/@a/video/1",
      videoPlayCount: 1_000,
      musicId: "same",
      musicTitle: "Same",
      musicDuration: 60,
      musicPlayUrl: "https://example.com/a.mp3",
    },
    {
      videoUrl: "https://www.tiktok.com/@b/video/2",
      videoPlayCount: 9_000,
      musicId: "same",
      musicTitle: "Same",
      musicDuration: 60,
      musicPlayUrl: "https://example.com/b.mp3",
    },
  ];

  assert.equal(selectBestTrendingAudio(candidates, 30)?.videoPlayCount, 9_000);
});
