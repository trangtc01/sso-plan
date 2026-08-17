# TikTok Draft CMS MVP

CMS nội bộ để upload một MP4 hoặc MOV, description và hashtags; API lưu job vào PostgreSQL, worker Playwright lưu TikTok draft bằng dedicated Chrome profile. Không có luồng publish.

## Cài đặt

```bash
npm install
npx playwright install chromium
npm run db:generate
npm run db:migrate
npm run tiktok:bootstrap
```

Lệnh bootstrap mở profile đã cấu hình; đăng nhập thủ công, hoàn tất MFA/CAPTCHA nếu có, sau đó đóng browser bằng `Ctrl+C`. Không commit hoặc copy profile này.

`TIKTOK_PROFILE_DIR` có thể trỏ đến Chrome user-data directory và `TIKTOK_CHROME_PROFILE_DIRECTORY=Default` để dùng Chrome Default profile. Chỉ làm vậy khi đã đóng hoàn toàn Google Chrome; không chạy đồng thời với Chrome cá nhân.

Trước khi chạy automation, phải xác nhận bằng tay TikTok web thực sự có `Save draft` và draft còn tồn tại sau browser restart.

## Upload draft

```bash
npm run tiktok:draft -- --file /absolute/path/video.mp4
```

## Chạy CMS local

```bash
cp .env.example .env
# PostgreSQL và Redis phải chạy trực tiếp trên máy:
#   brew services start postgresql@17   # hoặc service PostgreSQL đang dùng
#   brew services start redis
# Nếu database chưa tồn tại:
createdb -h localhost -U truongtrang video_automation
npm run api:dev
npm run worker:dev
npm run admin:dev
```

Không dùng Docker. `.env.example` mặc định dùng PostgreSQL và Redis tại `localhost`; điều chỉnh `DATABASE_URL` nếu user/database PostgreSQL local của bạn khác.

Mở `http://localhost:3000`. Rerun tạo attempt mới. Với `AMBIGUOUS`, UI yêu cầu xác nhận đã kiểm tra draft thủ công trước khi enqueue lại.

Tuỳ chọn cấu hình:

- `TIKTOK_PROFILE_DIR`: profile path tuyệt đối (mặc định `.tiktok-automation/profile`).
- `TIKTOK_ARTIFACT_DIR`: nơi lưu journal, JSON log và screenshot.
- `TIKTOK_MAX_FILE_BYTES`: giới hạn MP4, mặc định `2 GiB`.
- `TIKTOK_UPLOAD_URL`: upload page đã xác nhận cho account, mặc định TikTok Studio upload.
- `TIKTOK_CHROME_EXECUTABLE`: đường dẫn Chrome nếu không dùng Chromium của Playwright.

Exit code: `0` draft đã verify; `2` input invalid; `3` cần login; `4` upload lỗi trước Save Draft; `5` kết quả save không xác định; `6` profile đang được dùng.

`AMBIGUOUS` tuyệt đối không được chạy retry tự động: kiểm tra draft thủ công trước.
