# Current State

Baseline reviewed: `ec9271cdf5e231b1eccda5988cc86e9ae1bbfdf6`.

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
  - TikTok: Publish mode (`DRAFT` default / `PUBLIC` option)
- validation: When TikTok is selected together with Facebook/YouTube, TikTok publish mode must be `PUBLIC`
- datetime-local publish time
- bulk TXT import
- video/job list & rerun controls

### API / scheduling
- creates `Video` with `tiktokPublishedUrl` and `tiktokDownloadedPath` fields
- TikTok uses `UploadJob` with `publishTime` and `publishMode` (`DRAFT`/`PUBLIC`)
- Facebook/YouTube use `PublishJob` with `status: WAITING_SOURCE` when TikTok is included (or `SCHEDULED` if TikTok is not selected)
- when TikTok is selected with downstream platforms, downstream jobs are held in `WAITING_SOURCE` until TikTok is published and downloaded

### Worker
- TikTok worker handles `DRAFT` and `PUBLIC`
- On `PUBLIC` completion with downstream platforms waiting:
  1. Resolves published TikTok URL (`tiktokPublishedUrl`)
  2. Downloads TikTok video via `yt-dlp` (`tiktokDownloadedPath`)
  3. Updates `Video.outputPath` to downloaded TikTok file
  4. Releases downstream Facebook/YouTube jobs from `WAITING_SOURCE` -> `SCHEDULED` and enqueues to BullMQ
  5. If URL resolution or download fails, downstream jobs become `FAILED` (no silent fallback to original file)
- Facebook worker publishes using `video.outputPath ?? video.sourcePath`
- YouTube worker uses CDP mode with process cleanup (`SIGTERM` -> 3s -> `SIGKILL`) using `video.outputPath ?? video.sourcePath`

### Security & Credentials
- `.env.example` in repository has been sanitized with `FB_PAGE_ACCESS_TOKEN=""` and `FB_PAGE_ID=""`
- Historical Facebook credential exposure — rotation still required on Meta dashboard by owner

## Verified manually during recent work

Facebook test objects became `ready` with upload/processing/publishing phases complete.
Meta returned permalink paths under `/reel/{id}` for both a reel-endpoint object and a `/videos` object.

## Not proven by this documentation audit

This audit inspected repository source and commit history; it did not run the local database, Redis, browsers, or end-to-end CMS in the user's machine.

An agent starting implementation must run the relevant local build/tests/runtime smoke tests before treating current flows as fully healthy.
