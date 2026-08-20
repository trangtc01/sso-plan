"use client";
import { FormEvent, useMemo, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function UploadForm() {
  const [message, setMessage] = useState("");
  const defaultPublishAt = useMemo(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Đang upload và tạo lịch...");
    const form = new FormData(event.currentTarget);
    const hashtags = String(form.get("hashtagsText") ?? "")
      .split(",")
      .map(value => value.trim().replace(/^#/, ""))
      .filter(Boolean);
    const platforms = form.getAll("platforms").map(String);
    const publishAtLocal = String(form.get("publishAtLocal") ?? "");
    const publishAt = new Date(publishAtLocal);

    form.delete("hashtagsText");
    form.delete("publishAtLocal");
    form.delete("platforms");
    form.set("hashtags", JSON.stringify(hashtags));
    form.set("platforms", JSON.stringify(platforms));
    form.set("publishAt", publishAt.toISOString());

    try {
      const response = await fetch(`${api}/videos`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      event.currentTarget.reset();
      setMessage("Đã upload video và tạo lịch đăng.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload thất bại");
    }
  }

  return (
    <section>
      <h2>Video mới</h2>
      <form onSubmit={submit}>
        <label>Title<input name="title" required maxLength={200} /></label>
        <label>Video MP4 hoặc MOV<input name="file" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" required /></label>
        <label>Description<textarea name="description" maxLength={4000} /></label>
        <label>Hashtags (phân cách bằng dấu phẩy)<input name="hashtagsText" placeholder="danang, review, food" /></label>
        <label>
          Nền tảng (giữ Cmd/Ctrl để chọn nhiều)
          <select name="platforms" multiple size={3} defaultValue={["TIKTOK"]} required>
            <option value="FACEBOOK">Facebook</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="TIKTOK">TikTok</option>
          </select>
        </label>
        <label>
          Ngày + giờ chạy
          <input name="publishAtLocal" type="datetime-local" defaultValue={defaultPublishAt} required />
        </label>
        <small>TikTok hiện được tạo draft theo giờ đã chọn để bạn mở app thêm nhạc trending và Post thủ công.</small>
        <button type="submit">Upload và tạo lịch</button>
      </form>
      <p>{message}</p>
    </section>
  );
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
