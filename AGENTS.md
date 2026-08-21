# AGENTS.md

## Closed-Loop Execution Workflow

Every AI agent working on non-trivial tasks in this repository MUST follow this closed-loop workflow:

```text
START TASK
→ kiểm tra git state (`git status --short`, `git branch --show-current`, `git rev-parse HEAD`)
→ đọc `docs/INDEX.md`
→ đọc `docs/context-pack/CURRENT_STATE.md`
→ xác định affected domains
→ inspect source thực tế
→ implement
→ test/build
→ runtime verify khi cần
→ review context-pack bị ảnh hưởng
→ update context-pack lên trạng thái mới nhất
→ kiểm tra source ↔ docs không còn contradiction
→ mới được coi task DONE
```

## Mandatory Completion Rule

> **Một task chưa DONE nếu code đã thay đổi behavior nhưng canonical context documents liên quan chưa được review/update.**

## Verification Order

Use this authority order when resolving conflicts:

1. Verified runtime/test result
2. Current source code
3. Database schema/migrations and active configuration contracts
4. `docs/context-pack/CURRENT_STATE.md`
5. Active architecture docs
6. Historical plans/specs

## Operating Rules

1. Run `git status --short`, `git branch --show-current`, and `git rev-parse HEAD` at startup.
2. Read `docs/INDEX.md` and `docs/context-pack/CURRENT_STATE.md` before starting work.
3. Read only the domain documents/source paths routed by `docs/INDEX.md`.
4. Inspect current source before changing behavior. Do not implement from historical plans alone.
5. When documentation conflicts with verified runtime/source, runtime and current source win. Update the context pack after verification.
6. Keep changes minimal and scoped. Do not overwrite unrelated local changes.
7. Never use `git add .` or `git add -A` when a task has a narrow file scope.
8. Do not commit credentials, browser profiles, cookies, access tokens, generated artifacts, test media, raw delivery `.zip` files, or temporary extracted patch folders (e.g., `*.zip`, `sso-plan-*-patch/`).
9. When delivering code updates externally or ingesting packages, follow the **Code Delivery & Packaging Protocol (Zip & File Mapping)** below.

## Code Delivery & Packaging Protocol (Zip & File Mapping)

Khi Agent lên plan và viết code/feature mới cho dự án để giao nhận (handover/delivery):

1. **Packaging**: Đóng gói tất cả file code, config hoặc asset mới/thay đổi vào file `.zip` (ví dụ: `feature-update.zip`).
2. **File Mapping Manifest (`FILE_MAPPING.md`)**:
   Trong file `.zip` (ở thư mục gốc), BẮT BUỘC phải có file `FILE_MAPPING.md` với định dạng bảng chuẩn:

   ```markdown
   # File Mapping Guide

   | Zip Path | Repository Target Path | Action | Description |
   |---|---|---|---|
   | `src/new-feature.ts` | `apps/api/src/new-feature.ts` | `CREATE` | Thêm mới module feature |
   | `social/config.ts` | `src/social/config.ts` | `OVERWRITE` | Cập nhật cấu hình |
   | `old-file.ts` | `src/old-file.ts` | `DELETE` | Xóa file cũ không dùng |
   ```

   Các giá trị `Action` hợp lệ:
   - `CREATE`: Thêm mới file vào codebase.
   - `OVERWRITE`: Ghi đè toàn bộ nội dung file hiện tại trong codebase.
   - `PATCH`: Áp dụng chỉnh sửa/diff cụ thể vào file hiện tại.
   - `DELETE`: Xóa file tương ứng khỏi codebase.

3. **Ingestion & Application Protocol (Dành cho AI Agent tiếp quản dự án)**:
   Khi nhận gói file `.zip` từ Agent khác hoặc external delivery:
   - Giải nén file `.zip` vào thư mục tạm/scratch.
   - Đọc và parse `FILE_MAPPING.md` để đối chiếu với trạng thái repository hiện tại (`git status`).
   - Copy / apply từng file theo đúng sơ đồ `Target Path` và `Action`.
   - **Loại trừ Git**: Tuyệt đối KHÔNG commit các file `.zip` giao nhận hoặc thư mục tạm/unzip (`*.zip`, `sso-plan-*-patch/`) vào repository. Chỉ stage đúng các target source file và canonical docs bị ảnh hưởng.
   - Chạy build/tests (`npm run build`, test suites) để đảm bảo không đứt gãy.
   - Review và update canonical docs trong `docs/context-pack/` theo Closed-Loop Workflow trước khi đánh giá task `DONE`.

## Frontend & UI/UX Standards (Mandatory Design Intelligence)

Mỗi AI Agent khi thực hiện bất kỳ thay đổi nào liên quan đến **Frontend / UI / UX** (bao gồm `apps/admin/app/*`, `styles.css`, component layouts, form controls, badges, animations):

1. **Bắt buộc đọc Skill:** Phải tham chiếu và tuân thủ các quy chuẩn thiết kế trong [`.agents/skills/ui-ux-pro-max/SKILL.md`](file:///Users/truongtrang/HeiTech/personal_project/sso-plan/.agents/skills/ui-ux-pro-max/SKILL.md).
2. **Claymorphism & Modern Soft SaaS System:**
   - Sử dụng nhất quán bộ Design Tokens (`--clay-shadow-card`, `--clay-shadow-button`, `--clay-shadow-inset`, `--radius-xl`, `--radius-pill`).
   - Đảm bảo hiệu ứng tactile 3D mềm mại (dual shadows: top highlight + ambient bottom shadow), viền chunky bo tròn, typography phân cấp rõ ràng (Plus Jakarta Sans / Inter).
   - Tuyệt đối tránh giao diện khô cứng, sơ sài hoặc dùng màu mặc định thô ráp.
3. **Pre-Delivery UI Checklist:**
   - Độ tương phản văn bản đạt chuẩn WCAG AA 4.5:1 tối thiểu.
   - Các tương tác bấm/chọn có phản hồi `active`/`hover` mượt mà và `cursor: pointer`.
   - Đảm bảo hiển thị hoàn hảo và responsive trên Mobile (375px), Tablet (768px), Desktop (1280px+).

## Documentation Update Matrix

When modifying specific system domains, you MUST review and update the corresponding canonical docs and inspect all listed source files:

| Domain | Review Context Docs | Inspect Source Paths |
|---|---|---|
| **TikTok** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/PLATFORM_REGISTRY.md`<br>`docs/context-pack/KNOWN_ISSUES.md` | `src/cli.ts`<br>`src/run-draft.ts`<br>`src/tiktok-adapter.ts`<br>`src/profile-lock.ts`<br>`apps/worker/src/main.ts` |
| **Facebook** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/PLATFORM_REGISTRY.md`<br>`docs/context-pack/KNOWN_ISSUES.md` | `src/facebook/*`<br>`src/social/facebook-publisher.ts`<br>`apps/worker/src/main.ts`<br>`apps/api/src/videos.service.ts` |
| **YouTube** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/PLATFORM_REGISTRY.md`<br>`docs/context-pack/KNOWN_ISSUES.md` | `src/social/youtube-playwright-publisher.ts`<br>`src/social/config.ts`<br>`src/social/cli.ts`<br>`apps/worker/src/main.ts` |
| **CMS / Admin / UI** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/ARCHITECTURE_MAP.md`<br>`docs/context-pack/DIRECTORY_MAP.md`<br>`.agents/skills/ui-ux-pro-max/SKILL.md` | `apps/admin/app/*`<br>`.agents/skills/ui-ux-pro-max/*` |
| **API** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/ARCHITECTURE_MAP.md`<br>`docs/context-pack/KNOWN_ISSUES.md` | `apps/api/src/videos.controller.ts`<br>`apps/api/src/videos.dto.ts`<br>`apps/api/src/videos.service.ts`<br>`apps/api/src/bulk-import.ts` |
| **Scheduler / BullMQ / Worker** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/ARCHITECTURE_MAP.md`<br>`docs/context-pack/KNOWN_ISSUES.md`<br>`docs/context-pack/CURRENT_PRIORITIES.md` | `apps/worker/src/main.ts`<br>`apps/api/src/videos.service.ts`<br>`src/publish-queues.ts` |
| **Database / Prisma** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/ARCHITECTURE_MAP.md` | `prisma/schema.prisma`<br>`prisma/migrations/*` |
| **New Platform** | `docs/context-pack/CURRENT_STATE.md`<br>`docs/context-pack/ARCHITECTURE_MAP.md`<br>`docs/context-pack/PLATFORM_REGISTRY.md`<br>`docs/context-pack/DIRECTORY_MAP.md` | `apps/api/src/*`<br>`apps/worker/src/main.ts`<br>`src/social/*` |
| **File / Folder Restructuring** | `docs/context-pack/DIRECTORY_MAP.md`<br>`docs/context-pack/ARCHITECTURE_MAP.md`<br>`docs/INDEX.md` | Affected directories |
| **Security / Credentials** | `docs/context-pack/KNOWN_ISSUES.md`<br>`docs/context-pack/CURRENT_STATE.md`<br>`docs/DOCUMENT_AUDIT_REPORT.md` | `.env.example`<br>Configuration files |

Do not create duplicate reports unless explicitly requested.

***Each response must always begin with: I still remember the context.***