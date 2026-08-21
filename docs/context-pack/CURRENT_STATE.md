# Current State

Baseline reviewed: `00685d431e50184754dcf92efb5f6d34d47af16f`.

## Implemented in current source

### CMS
- Modern Claymorphism & Soft SaaS tactile interface with dual-shadow cards, custom brand platform options, and glowing status badges
- compact tabbed creation workflow (`CreationSection`) switching between `📹 Upload Video Đơn` and `📥 Bulk Import (TXT/CSV)` to optimize screen real estate and eliminate unnecessary scrolling
- full-width 2-column form for single upload with compact input/select fields, fit above the fold on 14" MacBooks
- bulk import format instructions collapsed by default and expanded on demand

- single video upload with drag-and-drop styled input
- title
- description
- hashtags
- multi-select Facebook / YouTube / TikTok with branded option cards
- per-platform scheduling options:
  - Facebook: Publish mode (`PUBLIC` / `DRAFT`), Content type (`REEL` / `VIDEO_POST`)
  - YouTube: Publish mode (`PUBLIC` / `DRAFT` mapping to private)
  - TikTok: Publish mode (`DRAFT` default / `PUBLIC` option), Sound option (`useSound: true/false`, `--no-sound` in CLI)
- validation: When TikTok is selected with sound=true together with Facebook/YouTube, TikTok publish mode must be `PUBLIC`. If sound=false, original video is used downstream without requiring TikTok Public mode.
- datetime-local publish time
- bulk TXT (tab-separated) and CSV import supporting extended columns (`tiktok_mode`, `tiktok_use_sound`, `facebook_mode`, `facebook_type`, `youtube_mode`)
- video/job list & rerun controls with retry safety (`PublishJob.useTikTokSource`) and live status pulse indicators
- line-clamped error text column formatting (`word-break: break-word; overflow-wrap: anywhere`) preventing table layout breakage
- Claymorphism Video Detail Modal (`DetailModal`) displaying complete video metadata, per-platform execution status, full error traces, raw JSON responses, direct web links, and interactive Playwright video preview trigger (`POST /videos/:id/preview-playwright`)
- FFmpeg MP4 transcoding utility (`src/ffmpeg.ts`) ensuring all uploaded/staged non-MP4 videos (`.mov`, `.avi`, etc.) are automatically converted to standard H.264 / AAC MP4 format with faststart flags before social media distribution


### API / scheduling
- creates `Video` with `tiktokPublishedUrl` and `tiktokDownloadedPath` fields
- TikTok uses `UploadJob` with `publishTime`, `publishMode` (`DRAFT`/`PUBLIC`), and `useSound` (`Boolean`)
- robust `parseBoolean` module (`apps/api/src/parse-boolean.ts`) used across DTO transformers and `VideosService.create` to ensure string/array values (e.g. `"false"`) sent via multipart form data evaluate properly as boolean `false` instead of truthy strings

- Facebook/YouTube use `PublishJob` with `useTikTokSource` (`Boolean`) and `status: WAITING_SOURCE` when TikTok with sound is included (or `SCHEDULED` / `READY_TO_RUN` if TikTok is not selected or sound=false)
- `PublishStatus.READY_TO_RUN` added to Prisma schema enum and migration to support queue execution readiness states
- Modularized constants (`apps/api/src/constants.ts`) and types (`apps/api/src/types.ts`, `apps/admin/app/types.ts`) for strict type safety across NestJS API and Next.js Admin
- `VideosService.create` enqueues all `PublishJob`s in `SCHEDULED` status directly into BullMQ (regardless of whether `tiktokJob` exists), and worker automatically recovers/enqueues any orphaned `SCHEDULED` jobs on startup
- when TikTok with sound is selected with downstream platforms, downstream jobs are held in `WAITING_SOURCE` until TikTok is published and downloaded

### Worker & CLI
- TikTok worker handles `DRAFT` and `PUBLIC`
- Auto-handles TikTok copyright/pre-check modal (`Tiếp tục đăng?` / `Post anyway`) by clicking `Đăng ngay` during `publish()` and `verifyPublished()`
- CLI supports interactive `--pause` mode across TikTok (`tiktok:draft`, `tiktok:publish`, `tiktok:download`), YouTube (`upload:youtube`), and Facebook (`social:upload`)
- CLI automatically extracts and outputs published TikTok URL and pre-filled copy-paste download commands upon publish completion
- On `PUBLIC` completion with downstream platforms waiting:
  1. Resolves published TikTok URL (`tiktokPublishedUrl`)
  2. Downloads TikTok video via Playwright network/DOM media URL capture before context close (with `yt-dlp` fallback) to `tiktokDownloadedPath`
  3. Updates `Video.outputPath` to downloaded TikTok file
  4. Releases downstream Facebook/YouTube jobs from `WAITING_SOURCE` -> `SCHEDULED` and enqueues to BullMQ
  5. If URL resolution and all download methods fail, downstream jobs become `FAILED` (no silent fallback to original file)
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
