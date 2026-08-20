# Current State

Baseline reviewed: `8b5857401fd652df1fb70e2c12d8cb8ac7525a26`.

## Implemented in current source

### CMS
- single video upload
- title
- description
- hashtags
- multi-select Facebook / YouTube / TikTok
- per-platform scheduling options:
  - Facebook: Publish mode (`PUBLIC` / `DRAFT`), Content type (`REEL` / `VIDEO_POST`)
  - YouTube: Publish mode (`PUBLIC` / `DRAFT` mapping to private)
  - TikTok: Draft-only note
- datetime-local publish time
- bulk TXT import (uses default PUBLIC modes)
- video/job list
- rerun controls

### API / scheduling
- creates `Video`
- TikTok uses `UploadJob` with `publishTime`
- Facebook/YouTube use `PublishJob` with persisted `publishMode` (`PUBLIC`/`DRAFT`) and `facebookContentType` (`REEL`/`VIDEO_POST`)
- `publishTime` is persisted
- BullMQ delayed jobs are created at request/import time
- per-platform queues are used
- failed publish jobs can be re-enqueued independently

### Worker
- TikTok worker creates draft with Playwright
- Facebook worker publishes using stored `publishMode` (`DRAFT`/`PUBLISHED`) and `facebookContentType` (`REEL` via `/video_reels`, `VIDEO_POST` via `/videos`)
### YouTube direct CLI / Worker
- `youtube:bootstrap` spawns real Google Chrome for initial manual Google login with dedicated profile directory
- `upload:youtube` / worker uses `YoutubePlaywrightPublisher` with Real Chrome + CDP mode (`--remote-debugging-port=9222` + `chromium.connectOverCDP()`), preventing Playwright `--enable-automation` flags from invalidating Google auth sessions
- 12-stage timestamped debug logging across execution lifecycle (`[Step 1/12]` to `[Step 12/12]`) with diagnostic artifacts (`failure.png` & `failure-body.txt`)
- supports `PUBLIC` and `DRAFT` (mapped to YouTube `private`)

### Security & Credentials
- `.env.example` in repository has been sanitized with `FB_PAGE_ACCESS_TOKEN=""` and `FB_PAGE_ID=""`
- Historical Facebook credential exposure — rotation still required on Meta dashboard by owner

## Verified manually during recent work

Facebook test objects became `ready` with upload/processing/publishing phases complete.
Meta returned permalink paths under `/reel/{id}` for both a reel-endpoint object and a `/videos` object.

## Not proven by this documentation audit

This audit inspected repository source and commit history; it did not run the local database, Redis, browsers, or end-to-end CMS in the user's machine.

An agent starting implementation must run the relevant local build/tests/runtime smoke tests before treating current flows as fully healthy.
