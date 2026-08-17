# Video Automation Platform

## Updated Business Specification & Technical Design

> Version: 2.0 (Reviewed & Updated)

# 1. Product Goal

Build a platform that automates the entire lifecycle of short-form video
publishing:

-   Upload source video
-   Generate TTS from subtitle
-   Merge video, voice, subtitle and music
-   Schedule publishing
-   Publish automatically to Facebook, YouTube and TikTok
-   Retry failed jobs
-   Monitor processing status

## MVP Scope

Included: - Video management - TTS - FFmpeg rendering - Multi-platform
publishing - Scheduler - Retry - Logs

Excluded: - AI caption - AI thumbnail - Analytics - Team collaboration

# 2. Business Rules

-   A video must be rendered successfully before publishing.
-   One video can have multiple publish jobs.
-   Each platform maintains its own publish status.
-   Failed publishing can be retried independently.
-   Publish time must be in the future.

# 3. High-level Workflow

Upload → Generate Voice → Render → Ready → Schedule → Publish →
Completed

# 4. State Machine

Uploaded → VoiceGenerating → VoiceReady → Rendering → Ready → Scheduled
→ Publishing → Published

Failure from any processing state transitions to Failed with retry
support.

# 5. Architecture

    Next.js Admin
          │
     NestJS API
          │
     PostgreSQL
          │
     BullMQ
          │
     ├── Voice Queue
     ├── Render Queue
     ├── Publish Queue
     └── Cleanup Queue
          │
     Workers
          │
     Infrastructure
     ├── FFmpeg
     ├── TTS API
     ├── Cloudflare R2
     ├── Facebook API
     ├── YouTube API
     └── Playwright (TikTok)

# 6. Layered Design

-   Presentation (REST API)
-   Application (Use Cases)
-   Domain (Video, Render, Publish)
-   Infrastructure (BullMQ, FFmpeg, Playwright, Storage)

# 7. Core Modules

-   Auth
-   Video
-   Render
-   Publish
-   Account
-   Storage
-   Music
-   Scheduler
-   Monitoring

# 8. Database

## videos

-   id
-   title
-   status
-   source_path
-   subtitle_path
-   output_path
-   created_at

## render_jobs

-   id
-   video_id
-   status
-   voice_path
-   started_at
-   finished_at

## publish_jobs

-   id
-   video_id
-   platform
-   publish_time
-   status
-   retry_count
-   error_message
-   response

## platform_accounts

-   id
-   platform
-   credential (encrypted)
-   refresh_token
-   expire_time

# 9. Queues

-   voice
-   render
-   publish-facebook
-   publish-youtube
-   publish-tiktok
-   cleanup

# 10. Publisher Pattern

Use Strategy Pattern:

-   FacebookPublisher
-   YoutubePublisher
-   TikTokPublisher

Avoid switch(platform) logic.

# 11. Error Handling

Every task supports: - retry - exponential backoff - max retry -
dead-letter queue - notification

# 12. Monitoring

-   Bull Board
-   Pino
-   Health Check
-   Sentry
-   Metrics dashboard

# 13. Storage Layout

-   raw/
-   voice/
-   render/
-   thumbnail/
-   temp/
-   logs/

# 14. API

-   POST /videos
-   GET /videos
-   GET /videos/:id
-   POST /videos/:id/render
-   POST /videos/:id/publish
-   POST /publish/:id/retry

# 15. Roadmap

Phase 1 - Project setup - Authentication - CRUD - Upload

Phase 2 - TTS - Rendering - Storage

Phase 3 - Facebook - YouTube

Phase 4 - TikTok - Scheduler

Phase 5 - Dashboard - Monitoring - Retry

# 16. Future Enhancements

-   AI Caption
-   AI Hashtag
-   AI Thumbnail
-   Shorts Auto Crop
-   Multi-account Publishing
-   Analytics
-   A/B Testing
-   Product Roadmap
-   ERD
-   Sequence Diagrams
-   OpenAPI Contract
-   Coding Convention
-   Deployment Guide
