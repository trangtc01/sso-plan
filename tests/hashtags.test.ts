import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHashtags } from "../apps/api/src/hashtags.js";

test("normalizeHashtags accepts multipart JSON string and removes duplicates", () => {
  assert.deepEqual(normalizeHashtags('["#cms", "tiktok", "cms"]'), ["cms", "tiktok"]);
});

test("normalizeHashtags accepts array and comma-separated direct API input", () => {
  assert.deepEqual(normalizeHashtags(["#video", "draft"]), ["video", "draft"]);
  assert.deepEqual(normalizeHashtags("#video, draft"), ["video", "draft"]);
});
