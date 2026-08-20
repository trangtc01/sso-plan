"use client";
import { FormEvent, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function BulkImportForm() {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Đang import...");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${api}/videos/import`, { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ? JSON.stringify(body.message) : "Import thất bại");
      setMessage(`Import xong: ${body.created}/${body.total} video, lỗi ${body.failed}.`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import thất bại");
    }
  }

  return (
    <section>
      <h2>Import hàng loạt từ TXT</h2>
      <form onSubmit={submit}>
        <label>File TXT<input name="file" type="file" accept="text/plain,.txt" required /></label>
        <small>Mỗi dòng dùng 6 cột cách nhau bằng TAB: video_path, title, description, hashtags, platforms, publish_at.</small>
        <button type="submit">Import và tạo lịch</button>
      </form>
      <p>{message}</p>
    </section>
  );
}
