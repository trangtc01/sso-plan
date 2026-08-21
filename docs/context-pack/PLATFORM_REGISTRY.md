# Platform Registry

## TikTok

Mechanism:
- Playwright
- persistent Chrome profile
- supports both `DRAFT` (Save Draft) and `PUBLIC` (Post/Publish) via `UploadJob.publishMode`
- resolves `tiktokPublishedUrl` via `adapter.getPublishedUrl()` upon successful public post

Key code:
- `src/run-draft.ts`
- `src/tiktok-adapter.ts`
- `src/profile-lock.ts`
- `apps/worker/src/main.ts`

Queue:
- `publish-tiktok` (job name `tiktok-publish`)

- supports sound selection (`selectSound`) searching "Trending Tiktok" and selecting optimal trending audio track
- standalone trending-audio CLI: `npm run tiktok:trending-audio -- --duration <seconds>` reads public TikTok Discover video candidates, resolves video `playCount` and sound metadata, requires sound duration >= target duration, deduplicates by `musicId`, downloads the selected audio and trims it with FFmpeg. Ranking is by the source video's TikTok view count; it is not a claim about total sound usage count. Supports `--pause` / `--step` / `-p` checkpoints.
- **Per-Platform TikTok Source Configuration**: Supports `facebookUseTikTokSource` and `youtubeUseTikTokSource` flags to allow per-platform video source selection.
- **TikTok-First Multiplatform Flow**: When TikTok is selected together with Facebook/YouTube:
  - TikTok publish mode MUST be `PUBLIC`.
  - Downstream Facebook/YouTube jobs start in `WAITING_SOURCE` state.
  - After TikTok publishes successfully, the worker downloads the public TikTok video via Playwright network/DOM media capture before closing browser context (with `yt-dlp` fallback) to `Video.tiktokDownloadedPath`.
  - `Video.outputPath` is set to the downloaded TikTok video path.
  - Downstream Facebook/YouTube jobs are released (`WAITING_SOURCE` -> `SCHEDULED`) and enqueued.
  - If TikTok URL resolution and all download methods fail, downstream jobs become `FAILED` (no silent fallback).
- `AMBIGUOUS` must not be blindly retried after a possible Save Draft or Post/Publish.
- Manual login/MFA/CAPTCHA recovery is allowed; bypass is not.
- Profile concurrency must remain controlled.

## Facebook

There are two implementations/entry points:

1. Direct CLI: `src/facebook/*`
   - supports `reel`, `video`, `both`
   - supports draft/public behavior
   - `facebook:status` queries status plus best-effort permalink/source/thumbnail

2. Scheduled publisher: `src/social/facebook-publisher.ts`
   - used by Facebook BullMQ worker
   - supports `publishMode` (`PUBLIC` / `DRAFT`) and `facebookContentType` (`REEL` via `/{page-id}/video_reels` or `VIDEO_POST` via `graph-video.facebook.com/{page-id}/videos`)
   - `VIDEO_POST` uploads pass explicit filename with valid extension (`.mp4` / `.mov`) and MIME type (`video/mp4` / `video/quicktime`) to prevent Meta API error 352 (subcode 1363024)

Observed runtime behavior from manual testing:
- Reel upload and `/videos` upload returned distinct object IDs.
- Facebook returned `/reel/{id}` permalinks for both object types.
- Therefore `--type both` performs two uploads and can create duplicate visible content.

Do not assume `/videos` means a separately displayed classic Facebook Video in current Facebook UI.

## YouTube

Mechanism:
- Real Google Chrome launched with `--remote-debugging-port` + Playwright `connectOverCDP` to YouTube Studio
- Native Chrome bootstrap via `youtube-profile-bootstrap.ts` for manual Google account login

Key code:
- `src/social/youtube-playwright-publisher.ts`
- `src/social/youtube-profile-bootstrap.ts`
- `src/social/config.ts`
- `src/social/cli.ts`
- `apps/worker/src/main.ts`

Reason for this direction:
- project avoids relying on API upload behavior that may restrict visibility for unaudited API projects.
- CDP mode spawns real Google Chrome directly, bypassing Playwright-injected `--enable-automation` flags and eliminating Google auth session resets.

Important:
- `youtube:bootstrap` spawns real Google Chrome with a dedicated profile (`YOUTUBE_PROFILE_DIR`) for initial login.
- `publish()` spawns real Chrome on `YOUTUBE_CDP_PORT` (default 9222) with the same dedicated profile and connects via `chromium.connectOverCDP()`.
- 12-stage timestamped debug logs (`[Step 1/12]` to `[Step 12/12]`) track every operation: CDP launch, Studio navigation, Auth check, Upload dialog, File attachment, Metadata filling, URL extraction, Wizard navigation, Privacy selection, Publish button click, and Completion confirmation.
- Dedicated profile directory (`./.social-automation/youtube-profile` or `~/.sso-plan/youtube-profile`) must be used instead of the system Chrome directory to prevent `SingletonLock` collisions.

Current scheduled worker supports `PUBLIC` / `DRAFT` (mapped to YouTube `private`) and `YOUTUBE_DEFAULT_MADE_FOR_KIDS`. Upon completion, jobs with `publishMode === DRAFT` (or YouTube private) set job status to `DRAFT_SAVED`, matching TikTok draft behavior, while `PUBLIC` jobs set status to `PUBLISHED`.

## Queue names

Source: `src/publish-queues.ts` / current service-worker integration.
Expected platform queues:
- `publish-tiktok`
- `publish-facebook`
- `publish-youtube`
