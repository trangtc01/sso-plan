# TikTok Playwright MVP — Phase 1

> Mục tiêu: nhận một video local và tự động upload video đó thành TikTok draft bằng Playwright.
>
> Đây là internal automation cho một tài khoản TikTok, không phải multi-user production system.

## 1. Overview

Phase 1 chỉ kiểm chứng một vertical slice:

```text
Local MP4
  → validate input
  → mở dedicated Chrome profile
  → truy cập TikTok upload page
  → upload video
  → Save Draft
  → verify draft tồn tại
```

Phase này không publish video và không sử dụng TikTok Content Posting API.

## 2. Feasibility Gate — Bắt buộc hoàn thành trước khi code automation

Playwright chỉ khả thi nếu TikTok web của account mục tiêu thực sự hỗ trợ lưu draft. Trước khi implement runner, thực hiện smoke test thủ công với chính dedicated Chrome profile:

1. Login TikTok bằng account mục tiêu.
2. Mở TikTok/TikTok Studio upload page.
3. Upload một MP4 test.
4. Xác nhận UI có action `Draft` hoặc `Save draft`.
5. Lưu draft.
6. Đóng hoàn toàn browser rồi mở lại cùng profile.
7. Xác nhận draft vẫn tồn tại và video chưa được publish.

### Tiêu chí pass

- Web UI có action lưu draft thật, không phải chỉ giữ form upload đang mở.
- Draft vẫn tồn tại sau khi đóng và mở lại browser với cùng profile.
- Không tạo public/private post ngoài ý muốn.

### Nếu gate fail

Dừng hướng Playwright web và chọn một trong các hướng sau, không tự đổi behavior:

- Android emulator/device automation để thao tác draft trong TikTok mobile app.
- TikTok Upload API với scope `video.upload` sau khi app được approve.
- Đổi requirement sang private `Only me` post — lưu ý đây không phải draft.

## 3. MVP Scope

### Included

- Một TikTok account.
- Một video mỗi lần chạy.
- Video lấy từ absolute local file path.
- Dedicated persistent Chrome profile.
- Manual login lần đầu và khi TikTok yêu cầu login/MFA/CAPTCHA lại.
- Upload video qua file input.
- Lưu draft.
- Verify kết quả.
- Structured log và screenshot phục vụ debug.
- Chặn hai runner thao tác cùng một profile tại cùng thời điểm.

### Excluded

- Publish public/private video.
- Caption, hashtag, music, cover và advanced editing, trừ khi UI bắt buộc.
- Scheduler.
- Retry tự động sau khi đã bấm Save Draft.
- Multi-account và concurrent upload.
- Next.js, NestJS, PostgreSQL, Redis/BullMQ và cloud storage.
- TTS, subtitle và FFmpeg rendering.
- CAPTCHA/MFA bypass hoặc anti-bot evasion.

## 4. Runtime Design

```text
CLI command
   │
   ├── Input Validator
   ├── Run Lock
   ├── Run Journal
   └── TikTok Draft Uploader
          │
          └── Playwright Persistent Context
                 │
                 └── Dedicated Chrome Profile
```

### CLI contract

Ví dụ interface dự kiến:

```bash
npm run tiktok:draft -- --file /absolute/path/video.mp4
```

Exit code:

- `0`: draft đã được verify.
- `2`: input không hợp lệ.
- `3`: TikTok session cần login lại.
- `4`: upload thất bại trước khi save draft.
- `5`: kết quả không xác định sau khi bấm save draft.
- `6`: profile đang được một runner khác sử dụng.

## 5. State Machine

```text
CREATED
  → VALIDATING
  → LAUNCHING_BROWSER
  → CHECKING_SESSION
  → OPENING_UPLOAD_PAGE
  → UPLOADING
  → READY_TO_SAVE
  → SAVING_DRAFT
  → VERIFYING
  → DRAFT_SAVED
```

Failure states:

- `INVALID_INPUT`
- `LOGIN_REQUIRED`
- `UPLOAD_FAILED`
- `SAVE_DRAFT_FAILED`
- `AMBIGUOUS`

`AMBIGUOUS` nghĩa là Playwright đã bấm Save Draft nhưng không đủ bằng chứng để kết luận draft đã được lưu. Trạng thái này không được auto-retry vì retry có thể tạo duplicate draft.

## 6. Implementation Plan

Các file/function cụ thể chỉ được chốt sau khi có repository implementation và đã tìm pattern gần nhất để clone. Phase 1 dự kiến có năm component logic sau.

### Step 1: Bootstrap dedicated TikTok profile

- Tạo một profile directory dành riêng cho automation.
- Launch headed persistent browser context.
- Cung cấp bootstrap command để người dùng login thủ công.
- Không export cookies sang source tree và không commit profile directory.
- Khi gặp CAPTCHA/MFA, dừng tại `LOGIN_REQUIRED`; không bypass challenge.

### Step 2: Validate input và acquire profile lock

- Chỉ chấp nhận absolute path trỏ tới regular file.
- Phase 1 chỉ nhận `.mp4` với MIME phù hợp.
- Kiểm tra file readable, non-empty và nằm dưới size limit cấu hình.
- Tính SHA-256 để định danh input trong run journal.
- Acquire exclusive lock trước khi mở browser để bảo đảm một runner/account.
- Release lock trong `finally`, kể cả khi browser crash.

### Step 3: Implement TikTok upload page adapter

- Tách toàn bộ locator và UI interaction khỏi CLI orchestration.
- Ưu tiên semantic locators như role, label và testable visible text.
- Không rải CSS/XPath selectors trong business flow.
- Không dùng fixed sleep để đoán upload đã xong.
- Chờ explicit UI conditions: file accepted, progress completed và Save Draft enabled.
- Chụp screenshot đã sanitize tại các transition quan trọng.

### Step 4: Save và verify draft

- Chỉ click Save Draft sau khi upload hoàn tất.
- Sau click, kiểm tra confirmation UI hoặc draft list/detail theo behavior đã xác nhận ở feasibility gate.
- Ghi `DRAFT_SAVED` chỉ khi có bằng chứng rõ ràng.
- Nếu browser timeout/navigation error sau click, ghi `AMBIGUOUS`.
- Không tự click lại Save Draft ở trạng thái `AMBIGUOUS`.

### Step 5: Run journal và diagnostics

Mỗi lần chạy tạo một journal không chứa credential:

```json
{
  "runId": "uuid",
  "fileHash": "sha256",
  "state": "DRAFT_SAVED",
  "startedAt": "ISO-8601",
  "finishedAt": "ISO-8601",
  "lastCompletedStep": "VERIFYING",
  "error": null
}
```

Artifacts:

- Structured JSON log.
- Screenshot trước Save Draft.
- Screenshot sau verify hoặc khi failure.
- Không lưu cookie, token, authorization header hoặc raw browser profile vào artifacts.

## 7. Error Handling

### Có thể retry bằng cách chạy lại

- Input validation failed sau khi người dùng sửa file/path.
- Browser chưa mở được.
- Session hết hạn sau khi login lại.
- Upload thất bại chắc chắn trước bước `SAVING_DRAFT`.

### Không auto-retry

- Timeout sau khi click Save Draft.
- Browser crash trong hoặc sau `SAVING_DRAFT`.
- UI không còn đủ thông tin để biết draft đã được tạo hay chưa.

Các case này phải chuyển sang `AMBIGUOUS` và kiểm tra draft thủ công trước khi chạy lại.

## 8. Test Plan

### Automated tests

- Input path không tồn tại.
- Input là directory thay vì regular file.
- File rỗng hoặc extension không hỗ trợ.
- Lock đã được runner khác giữ.
- Mapping state và exit code.
- Redaction credential khỏi logs.
- Adapter orchestration với mocked page contract.

### Manual smoke tests

- Login profile lần đầu.
- Upload và save một MP4 hợp lệ.
- Draft vẫn tồn tại sau browser restart.
- Session hết hạn trả về `LOGIN_REQUIRED`.
- Đóng browser trước Save Draft không tạo draft.
- Đóng browser ngay sau Save Draft dẫn tới verify hoặc `AMBIGUOUS`, không click lại tự động.
- Chạy hai command đồng thời: chỉ một runner được phép tiếp tục.

## 9. Definition of Done

Phase 1 hoàn tất khi đáp ứng toàn bộ điều kiện:

- Feasibility gate pass trên account mục tiêu.
- Một command nhận absolute path của một MP4 và kết thúc với `DRAFT_SAVED`.
- Draft được nhìn thấy lại sau khi restart browser với cùng dedicated profile.
- Video không bị publish public/private ngoài ý muốn.
- Chạy đồng thời không làm hỏng profile hoặc upload trùng.
- Session invalid được báo `LOGIN_REQUIRED`, không crash loop.
- Không retry mù sau Save Draft.
- Có journal và screenshot đủ để xác định step failure.
- Có ít nhất 5 lần chạy liên tiếp thành công trên video test hợp lệ.

## 10. Risks và Trade-offs

- TikTok đổi UI có thể làm locator hỏng; page adapter giảm phạm vi sửa nhưng không loại bỏ rủi ro.
- Draft có thể gắn với local browser/device state; mất profile directory có thể làm mất draft.
- TikTok có thể yêu cầu CAPTCHA/MFA bất kỳ lúc nào, nên Phase 1 không bảo đảm unattended 24/7.
- Headed browser trên dedicated machine ổn định hơn container headless nhưng tăng yêu cầu vận hành.
- Playwright giúp ra MVP nhanh, nhưng đường dài vẫn nên migrate sang official API khi app được approve.

## 11. Confirmation Required Before Implementation

- “Draft” phải là draft thật có thể mở lại, không phải form upload đang để dở và không phải `Only me` post.
- Phase 1 dùng CLI + local file, chưa cần web admin/API/database.
- Một dedicated TikTok account và một dedicated Chrome profile.
- Chấp nhận manual login/MFA/CAPTCHA recovery.
- Nếu TikTok web không hỗ trợ draft cho account này, dừng Playwright web thay vì tự chuyển sang private post.

## 12. Source of Plan

- Đã review `video-automation-platform-plan-v2.md`; plan đó rộng hơn mục tiêu Phase 1 nên không dùng làm implementation scope.
- Workspace hiện chưa có application code để tìm hoặc clone implementation pattern.
- TikTok public documentation xác nhận draft trên mobile có tính device-local; khả năng Save Draft trên web cần kiểm chứng trực tiếp với account mục tiêu.
- Tham khảo chính thức:
  - [TikTok — Saving a draft](https://support.tiktok.com/en/using-tiktok/creating-videos/editing-posting-and-deleting?invalid_lang=knowledge-base)
  - [TikTok Content Posting API — Upload without posting](https://developers.tiktok.com/doc/content-posting-api-reference-upload-video?enter_method=left_navigation)
- Không có phần code nào được tự tạo trong bước lập plan này.
