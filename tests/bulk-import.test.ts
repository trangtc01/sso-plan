import assert from "node:assert/strict";
import test from "node:test";
import {
  FacebookContentType,
  Platform,
  PublishMode,
} from "@prisma/client";
import { parseBulkImportText } from "../apps/api/src/bulk-import.js";

test("bulk import keeps backward-compatible 6-column TSV", () => {
  const text = [
    "video_path\ttitle\tdescription\thashtags\tplatforms\tpublish_at",
    "/tmp/a.mp4\tHello\tDesc\tone,two\tTIKTOK,YOUTUBE\t2026-08-21 09:00",
  ].join("\n");

  const [row] = parseBulkImportText(text, {
    format: "tsv",
    timezoneOffset: "+07:00",
  });

  assert.equal(row.title, "Hello");
  assert.deepEqual(row.platforms, [Platform.TIKTOK, Platform.YOUTUBE]);
  assert.equal(row.tiktokUseSound, true);
  assert.equal(row.tiktokPublishMode, undefined);
});

test("bulk import parses extended CSV with quoted comma fields", () => {
  const text = [
    "video_path,title,description,hashtags,platforms,publish_at,tiktok_mode,tiktok_use_sound,facebook_mode,facebook_type,youtube_mode",
    '"/tmp/a.mov","Bé học","Mô tả, có dấu phẩy","beyeu,mebimsua","TIKTOK,YOUTUBE,FACEBOOK","2026-08-21 09:00",PUBLIC,false,PUBLIC,REEL,PUBLIC',
  ].join("\n");

  const [row] = parseBulkImportText(text, {
    format: "csv",
    timezoneOffset: "+07:00",
  });

  assert.equal(row.description, "Mô tả, có dấu phẩy");
  assert.equal(row.tiktokPublishMode, PublishMode.PUBLIC);
  assert.equal(row.tiktokUseSound, false);
  assert.equal(row.facebookPublishMode, PublishMode.PUBLIC);
  assert.equal(row.facebookContentType, FacebookContentType.REEL);
  assert.equal(row.youtubePublishMode, PublishMode.PUBLIC);
});
