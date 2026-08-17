"use client";
import { FormEvent, useState } from "react";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export function UploadForm() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage("Đang upload..."); const form = new FormData(event.currentTarget); const hashtags = String(form.get("hashtagsText") ?? "").split(",").map(value => value.trim()).filter(Boolean); form.delete("hashtagsText"); form.set("hashtags", JSON.stringify(hashtags)); try { const response = await fetch(`${api}/videos`, { method: "POST", body: form }); if (!response.ok) throw new Error(await response.text()); event.currentTarget.reset(); setMessage("Đã tạo job upload draft."); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload thất bại"); } }
  return <section><h2>Video mới</h2><form onSubmit={submit}><label>Title<input name="title" required maxLength={200} /></label><label>Video MP4 hoặc MOV<input name="file" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" required /></label><label>Description<textarea name="description" maxLength={4000} /></label><label>Hashtags (phân cách bằng dấu phẩy)<input name="hashtagsText" /></label><button type="submit">Upload và tạo job</button></form><p>{message}</p></section>;
}
