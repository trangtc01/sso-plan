"use client";
import { FormEvent, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function BulkImportForm() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessageType("info");
    setMessage("Đang đọc và import danh sách video...");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${api}/videos/import`, { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ? JSON.stringify(body.message) : "Import thất bại");
      }

      setMessageType(body.failed ? "error" : "success");
      setMessage(`✨ Import hoàn tất: ${body.created}/${body.total} video thành công, ${body.failed} lỗi.`);
      event.currentTarget.reset();
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Import thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card import-card">
      <div className="section-heading">
        <span className="eyebrow">HÀNG LOẠT</span>
        <h2>Bulk Import TXT / CSV</h2>
        <p className="section-description">
          Tải lên danh sách hàng chục video cùng lúc với định dạng bảng chuẩn 6 hoặc 13 cột.
        </p>
      </div>

      <form className="import-form" onSubmit={submit}>
        <label className="field">
          <span>Chọn file TXT hoặc CSV</span>
          <input name="file" type="file" accept="text/plain,text/csv,.txt,.csv" required />
        </label>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Đang import..." : "📥 Import và Tạo Lịch Hàng Loạt"}
        </button>
      </form>

      <details className="format-guide">
        <summary>📑 Hướng dẫn cấu trúc file Import</summary>

        <div className="format-block">
          <strong>6 cột cơ bản (Bắt buộc)</strong>
          <code>video_path · title · description · hashtags · platforms · publish_at</code>
        </div>

        <div className="format-block">
          <strong>7 cột mở rộng (Tùy chọn)</strong>
          <code>tiktok_mode · tiktok_use_sound · facebook_mode · facebook_type · facebook_use_tiktok_source · youtube_mode · youtube_use_tiktok_source</code>
        </div>

        <div className="format-notes">
          <span><b>platforms:</b> TIKTOK,YOUTUBE,FACEBOOK</span>
          <span><b>tiktok_mode:</b> DRAFT | PUBLIC</span>
          <span><b>tiktok_use_sound:</b> true | false</span>
          <span><b>facebook_mode:</b> DRAFT | PUBLIC</span>
          <span><b>facebook_type:</b> REEL | VIDEO_POST</span>
          <span><b>facebook_use_tiktok_source:</b> true | false</span>
          <span><b>youtube_mode:</b> DRAFT | PUBLIC</span>
          <span><b>youtube_use_tiktok_source:</b> true | false</span>
          <span><b>publish_at:</b> 2026-08-21 09:00</span>
        </div>

        <div className="format-block">
          <strong>Mẫu TXT (Sử dụng phím TAB giữa các cột)</strong>
          <pre>{`/Users/media/clip1.mov\tBé học chữ\tClip vui cho bé\tbeyeu,mamnon\tTIKTOK,YOUTUBE,FACEBOOK\t2026-08-21 09:00\tPUBLIC\ttrue\tPUBLIC\tREEL\tPUBLIC`}</pre>
        </div>

        <div className="format-block">
          <strong>Mẫu CSV (Nếu nội dung có dấu phẩy hãy bọc trong ngoặc kép)</strong>
          <pre>{`video_path,title,description,hashtags,platforms,publish_at,tiktok_mode,tiktok_use_sound,facebook_mode,facebook_type,youtube_mode
"/Users/media/clip1.mov","Bé học chữ","Mô tả, có dấu phẩy","beyeu,mamnon","TIKTOK,YOUTUBE,FACEBOOK","2026-08-21 09:00",PUBLIC,true,PUBLIC,REEL,PUBLIC`}</pre>
        </div>

        <div className="flow-note flow-note-accent" style={{ marginTop: "14px" }}>
          💡 <strong>Quy tắc TikTok sound:</strong> <code>true</code> = tự động thêm nhạc TikTok và tải lại cho FB/YT; <code>false</code> = giữ nguyên file gốc.
        </div>
      </details>

      {message && <div className={`form-message form-message-${messageType}`}>{message}</div>}
    </section>
  );
}
