# Architecture Map

## Current scheduling flow

```text
Next.js Admin
   |
   | POST /videos
   | title + description + hashtags + platforms + publishAt + file
   v
NestJS API
   |
   +--> persist Video
   |
   +--> TIKTOK selected
   |      create UploadJob(publishTime)
   |      enqueue publish-tiktok with BullMQ delay
   |
   +--> FACEBOOK selected
   |      create PublishJob(SCHEDULED, publishTime)
   |      enqueue publish-facebook with BullMQ delay
   |
   +--> YOUTUBE selected
          create PublishJob(SCHEDULED, publishTime)
          enqueue publish-youtube with BullMQ delay

Redis / BullMQ
   |
   +--> TikTok worker
   |      runDraft()
   |      Playwright -> TikTok draft
   |      UploadJob / UploadAttempt status
   |
   +--> Facebook worker
   |      FacebookReelsPublisher
   |      -> PublishJob PUBLISHING/PUBLISHED/FAILED
   |
   +--> YouTube worker
          YoutubePlaywrightPublisher
          -> PublishJob PUBLISHING/PUBLISHED/FAILED
```

## Admin presentation architecture

The CMS is intentionally organized by task priority rather than forcing unrelated tools into one desktop row:

```text
Hero / system status
   |
   v
Upload Video (primary, full width)
   |
   v
Bulk Import TXT / CSV (secondary, full width, guide collapsed by default)
   |
   v
Video Queue / Monitoring (full width, table scrolls safely when needed)
```

The upload form may use two internal columns on laptop/tablet widths, while smaller screens reflow dense form/settings sections to one column.

## Important implementation detail

There is no separate polling scheduler in the current implementation. The API calculates:

`delay = max(0, publishTime - now)`

and enqueues the BullMQ job immediately with that delay.

This differs from older architecture text that describes a scheduler scanning due `SCHEDULED` jobs.

## Data model

Core:
- `Video`
- `UploadJob` + `UploadAttempt` for TikTok draft workflow
- `PublishJob` for Facebook/YouTube public publishing
- `RenderJob` exists but is not the dominant path in the reviewed recent commits
- `PlatformAccount` and `Music` exist in schema

TikTok and public publishing intentionally use different job/status models.
