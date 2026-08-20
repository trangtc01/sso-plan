# Documentation Audit Report

Audit baseline: commit `8b5857401fd652df1fb70e2c12d8cb8ac7525a26` (`add cms`), with history reviewed through:
- `6293baa96981ec44494b165559b3ffa94d4bbca8` — TikTok draft work
- `3d8aeb5b962f56969373bf13166884bf4fbfa6ef` — Facebook/YouTube integration work
- `8b5857401fd652df1fb70e2c12d8cb8ac7525a26` — CMS, multi-platform scheduling and workers

No source files were modified by this audit package.

## Classification

| Document | Status | Notes |
|---|---|---|
| `docs/INDEX.md` | ACTIVE | Canonical documentation router created by this audit. |
| `docs/context-pack/*` | ACTIVE | Canonical compact project context. |
| `docs/architecture.md` | NEEDS_REVIEW | Broad mapping is useful, but it describes a scheduler that dispatches due jobs while current implementation directly enqueues BullMQ jobs with delay. |
| `README.md` | STALE | Still presents the project primarily as a TikTok Draft CMS and says there is no publish flow; current source contains Facebook/YouTube workers and multi-platform scheduling. |
| `tiktok-playwright-mvp-phase-1.md` | ARCHIVE_CANDIDATE | Valuable historical rationale and safety behavior; Phase 1 scope is no longer current project scope. |
| `video-automation-platform-plan-v2.md` | NEEDS_REVIEW | Useful product direction, but several planned components differ from current implementation. Do not use as implementation source of truth. |

## Important code/document mismatches

1. Current CMS supports platform selection and publish datetime.
2. API creates delayed BullMQ jobs directly.
3. Facebook and YouTube workers exist.
4. TikTok remains a draft-generation flow rather than public publishing.
5. README statement "Không có luồng publish" is no longer correct for Facebook/YouTube.
6. `docs/architecture.md` says a scheduler dispatches due jobs; current code computes BullMQ delay at job creation/rerun time instead.

## Repository hygiene findings

The repository currently contains items that should be reviewed separately, not deleted automatically:
- `.DS_Store` files
- `.tmp_pptx_html/`
- root test media such as `IMG_8492.MOV`
- `source.html`

These are `ARCHIVE_CANDIDATE` / cleanup candidates until the owner confirms whether they are intentionally versioned.

## Critical security finding

A Facebook Page access credential was committed in `.env.example` in the reviewed history.

Required action:
1. Revoke/rotate the exposed Facebook Page access token in Meta.
2. Replace committed `.env.example` secret values with empty placeholders.
3. Verify no active credential remains in current files.
4. Consider history cleanup only as a separate, explicit operation. Do not rewrite Git history automatically.
5. Review whether any other committed sample credentials are real.

This report intentionally does not reproduce the credential value.
