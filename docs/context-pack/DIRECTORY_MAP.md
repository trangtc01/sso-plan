# Directory Map

```text
.
├── apps/
│   ├── admin/              Next.js CMS
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── styles.css
│   │       ├── responsive-layout.css
│   │       ├── upload-form.tsx
│   │       ├── bulk-import-form.tsx
│   │       ├── video-list.tsx
│   │       ├── types.ts
│   │       └── page.tsx
│   ├── api/                NestJS API
│   │   └── src/
│   │       ├── videos.controller.ts
│   │       ├── videos.dto.ts
│   │       ├── videos.service.ts
│   │       ├── bulk-import.ts
│   │       ├── constants.ts
│   │       ├── types.ts
│   │       └── ...
│   └── worker/
│       └── src/main.ts     TikTok/Facebook/YouTube BullMQ workers
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── cli.ts              TikTok direct CLI
│   ├── run-draft.ts
│   ├── tiktok-adapter.ts
│   ├── profile-lock.ts
│   ├── publish-queues.ts
│   ├── ffmpeg.ts           FFmpeg MP4 transcoding utility
│   ├── facebook/           direct Facebook upload/status CLI implementation
│   └── social/
│       ├── facebook-publisher.ts
│       ├── youtube-playwright-publisher.ts
│       ├── config.ts
│       ├── cli.ts
│       └── ...
│
├── tests/
├── docs/
├── start.sh                One-click local startup script
└── package.json
```

## Admin styling split

- `apps/admin/app/styles.css`: canonical Claymorphism / component styling and existing design tokens.
- `apps/admin/app/responsive-layout.css`: viewport utilization and responsive layout overrides; loaded after `styles.css` from `layout.tsx`.

## Two Facebook code paths

Do not confuse:
- `src/facebook/*`: direct CLI tools (`facebook:upload`, `facebook:status`)
- `src/social/facebook-publisher.ts`: publisher used by scheduled worker

When changing Facebook behavior, inspect both and decide whether they must remain behaviorally aligned.
