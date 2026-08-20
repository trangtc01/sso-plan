# Documentation Index

This is the documentation entry point for humans and AI agents.

## Read first

- `../AGENTS.md` — agent operating rules
- `context-pack/CURRENT_STATE.md` — what is actually implemented now
- `context-pack/ARCHITECTURE_MAP.md` — runtime/data flow
- `context-pack/DIRECTORY_MAP.md` — where code lives
- `context-pack/PLATFORM_REGISTRY.md` — TikTok/Facebook/YouTube behavior
- `context-pack/KNOWN_ISSUES.md` — known risks and unresolved items
- `context-pack/CURRENT_PRIORITIES.md` — recommended next work
- `DOCUMENT_AUDIT_REPORT.md` — document classification and audit notes

## Task router

### TikTok draft / TikTok automation
Read:
- `context-pack/PLATFORM_REGISTRY.md`
- `context-pack/CURRENT_STATE.md`
Then inspect:
- `src/cli.ts`
- `src/run-draft.ts`
- `src/tiktok-adapter.ts`
- `src/profile-lock.ts`
- `apps/worker/src/main.ts`

### Facebook upload/status/publish
Read:
- `context-pack/PLATFORM_REGISTRY.md`
- `context-pack/KNOWN_ISSUES.md`
Then inspect:
- `src/facebook/*` for direct CLI/status tools
- `src/social/facebook-publisher.ts` for scheduled worker publishing
- `apps/worker/src/main.ts`
- `apps/api/src/videos.service.ts`

### YouTube
Read:
- `context-pack/PLATFORM_REGISTRY.md`
Then inspect:
- `src/social/youtube-playwright-publisher.ts`
- `src/social/config.ts`
- `src/social/cli.ts`
- `apps/worker/src/main.ts`

### CMS / API / scheduler
Read:
- `context-pack/ARCHITECTURE_MAP.md`
- `context-pack/CURRENT_STATE.md`
Then inspect:
- `apps/admin/app/*`
- `apps/api/src/videos.controller.ts`
- `apps/api/src/videos.dto.ts`
- `apps/api/src/videos.service.ts`
- `apps/api/src/bulk-import.ts`
- `apps/worker/src/main.ts`
- `src/publish-queues.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*`

### Database changes
Read:
- `context-pack/ARCHITECTURE_MAP.md`
Then inspect:
- `prisma/schema.prisma`
- all relevant `prisma/migrations/*`
Do not assume schema and migration are synchronized without checking.

## Historical/reference documents

- `../README.md` — useful TikTok setup notes, but partially stale versus current multi-platform system.
- `architecture.md` — architecture sketch; useful but some scheduler wording is stale.
- `../tiktok-playwright-mvp-phase-1.md` — historical TikTok Phase 1 design.
- `../video-automation-platform-plan-v2.md` — broad historical product plan; not current implementation truth.
