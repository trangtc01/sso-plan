# Platform Registry

## TikTok

Mechanism:
- Playwright
- persistent Chrome profile
- saves draft rather than publishing public content

Key code:
- `src/run-draft.ts`
- `src/tiktok-adapter.ts`
- `src/profile-lock.ts`
- `apps/worker/src/main.ts`

Queue:
- `publish-tiktok`

Important:
- `AMBIGUOUS` must not be blindly retried after a possible Save Draft.
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
   - supports `publishMode` (`PUBLIC` / `DRAFT`) and `facebookContentType` (`REEL` via `/{page-id}/video_reels` or `VIDEO_POST` via `/{page-id}/videos`)

Observed runtime behavior from manual testing:
- Reel upload and `/videos` upload returned distinct object IDs.
- Facebook returned `/reel/{id}` permalinks for both object types.
- Therefore `--type both` performs two uploads and can create duplicate visible content.

Do not assume `/videos` means a separately displayed classic Facebook Video in current Facebook UI.

## YouTube

Mechanism:
- Playwright + persistent YouTube profile / YouTube Studio

Key code:
- `src/social/youtube-playwright-publisher.ts`
- `src/social/config.ts`
- `src/social/cli.ts`
- `apps/worker/src/main.ts`

Reason for this direction:
- project avoids relying on API upload behavior that may restrict visibility for unaudited API projects.

Current scheduled worker uses public visibility and `YOUTUBE_DEFAULT_MADE_FOR_KIDS`.

## Queue names

Source: `src/publish-queues.ts` / current service-worker integration.
Expected platform queues:
- `publish-tiktok`
- `publish-facebook`
- `publish-youtube`
