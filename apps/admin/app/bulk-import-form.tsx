"use client";
import { FormEvent, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function BulkImportForm() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageType("info");
    setMessage("Đang import...");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${api}/videos/import`, { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ? JSON.stringify(body.message) : "Import thất bại");
      }

      setMessageType(body.failed ? "error" : "success");
      setMessage(`Import xong: ${body.created}/${body.total} video, lỗi ${body.failed}.`);
      event.currentTarget.reset();
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Import thất bại");
    }
  }

  return (
    <section className="card import-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">BULK IMPORT</p>
          <h2>Import TXT / CSV</h2>
          <p className="section-description">
            Hỗ trợ format cũ 6 cột và format mở rộng 11 cột.
          </p>
        </div>
      </div>

      <form className="import-form" onSubmit={submit}>
        <label className="field">
          <span>File TXT hoặc CSV</span>
          <input name="file" type="file" accept="text/plain,text/csv,.txt,.csv" required />
        </label>
        <button className="primary-button" type="submit">Import và tạo lịch</button>
      </form>

      <details className="format-guide" open>
        <summary>Cấu trúc file import</summary>

        <div className="format-block">
          <strong>6 cột bắt buộc</strong>
          <code>video_path · title · description · hashtags · platforms · publish_at</code>
        </div>

        <div className="format-block">
          <strong>5 cột tùy chọn</strong>
          <code>tiktok_mode · tiktok_use_sound · facebook_mode · facebook_type · youtube_mode</code>
        </div>

        <div className="format-notes">
          <span><b>platforms:</b> TIKTOK,YOUTUBE,FACEBOOK</span>
          <span><b>tiktok_mode:</b> DRAFT hoặc PUBLIC</span>
          <span><b>tiktok_use_sound:</b> true / false</span>
          <span><b>facebook_mode:</b> DRAFT hoặc PUBLIC</span>
          <span><b>facebook_type:</b> REEL hoặc VIDEO_POST</span>
          <span><b>youtube_mode:</b> DRAFT hoặc PUBLIC</span>
          <span><b>publish_at:</b> 2026-08-21 09:00 hoặc ISO-8601</span>
        </div>

        <div className="format-block">
          <strong>TXT — dùng TAB giữa các cột</strong>
          <pre>{`video_path[TAB]title[TAB]description[TAB]hashtags[TAB]platforms[TAB]publish_at[TAB]tiktok_mode[TAB]tiktok_use_sound[TAB]facebook_mode[TAB]facebook_type[TAB]youtube_mode
/Users/me/video.mov[TAB]Bé học chữ[TAB]Mô tả video[TAB]beyeu,mebimsua[TAB]TIKTOK,YOUTUBE,FACEBOOK[TAB]2026-08-21 09:00[TAB]PUBLIC[TAB]true[TAB]PUBLIC[TAB]REEL[TAB]PUBLIC`}</pre>
        </div>

        <div className="format-block">
          <strong>CSV — nếu field có dấu phẩy thì đặt trong dấu ngoặc kép</strong>
          <pre>{`video_path,title,description,hashtags,platforms,publish_at,tiktok_mode,tiktok_use_sound,facebook_mode,facebook_type,youtube_mode
"/Users/me/video.mov","Bé học chữ","Mô tả, có dấu phẩy","beyeu,mebimsua","TIKTOK,YOUTUBE,FACEBOOK","2026-08-21 09:00",PUBLIC,true,PUBLIC,REEL,PUBLIC`}</pre>
        </div>

        <div className="flow-note">
          <strong>TikTok sound:</strong> true = thêm nhạc TikTok; nếu có Facebook/YouTube thì tải lại
          bản TikTok và dùng bản đó. false = bỏ bước thêm nhạc/download; nền tảng sau dùng video gốc.
        </div>
      </details>

      {message && <div className={`form-message form-message-${messageType}`}>{message}</div>}
    </section>
  );
}
