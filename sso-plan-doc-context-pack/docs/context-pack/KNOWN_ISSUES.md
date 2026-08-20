# Known Issues

## P0 — exposed Facebook credential

A real-looking Facebook Page access token was committed in `.env.example` history.

Action:
- rotate/revoke immediately
- replace current example with placeholder
- audit other secrets
- history rewrite only with explicit owner approval

## P1 — duplicate Facebook implementations

Facebook logic exists in:
- `src/facebook/*`
- `src/social/facebook-publisher.ts`

Risk:
- fixes/features may be applied to one path but not the other.

Recommended:
- define a shared Facebook publishing/status core or explicitly document intentional differences.

## P1 — `--type both` duplicate risk

The direct Facebook CLI uploads twice:
- `/video_reels`
- `/videos`

Manual result showed both may render as Reels in Facebook.
Do not retry `both` blindly after partial success.

## P1 — documentation drift

`README.md` is stale and still describes a TikTok-only/no-publish system.
`docs/architecture.md` describes a separate due-job scheduler unlike the delayed BullMQ design currently implemented.

## P2 — repository hygiene

Review:
- committed `.DS_Store`
- `.tmp_pptx_html/`
- `IMG_8492.MOV`
- `source.html`

Do not delete automatically.

## P2 — verification coverage

Existing tests visible in `tests/` focus largely on TikTok/input/job helpers.
Multi-platform API/worker scheduling deserves targeted tests, especially:
- delayed job creation
- platform fan-out
- independent retry
- Facebook/YouTube worker status transitions
- bulk import validation
