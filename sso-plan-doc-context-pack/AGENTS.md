# AGENTS.md

## Mandatory startup for non-trivial tasks

1. Run `git status --short`, `git branch --show-current`, and `git rev-parse HEAD`.
2. Read `docs/INDEX.md`.
3. Read `docs/context-pack/CURRENT_STATE.md`.
4. Read only the domain documents/source paths routed by `docs/INDEX.md`.
5. Inspect current source before changing behavior. Do not implement from historical plans alone.
6. When documentation conflicts with verified runtime/source, runtime and current source win. Update the context pack after verification.
7. Keep changes minimal and scoped. Do not overwrite unrelated local changes.
8. Never use `git add .` or `git add -A` when a task has a narrow file scope.
9. Do not commit credentials, browser profiles, cookies, access tokens, generated artifacts, or test media.

## Verification order

Use this authority order when resolving conflicts:

1. Verified runtime/test result
2. Current source code
3. Database schema/migrations and active configuration contracts
4. `docs/context-pack/CURRENT_STATE.md`
5. Active architecture docs
6. Historical plans/specs

## Required finish for architecture-changing tasks

After tests/runtime verification, update only the context files materially affected by the change, normally:
- `docs/context-pack/CURRENT_STATE.md`
- `docs/context-pack/CURRENT_PRIORITIES.md`
- `docs/context-pack/PLATFORM_REGISTRY.md` when a platform integration changes

Do not create duplicate reports unless explicitly requested.
