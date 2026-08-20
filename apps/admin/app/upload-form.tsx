"use client";
import { FormEvent, useMemo, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function UploadForm() {
  const [message, setMessage] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["TIKTOK"]);
  const [tiktokPublishMode, setTiktokPublishMode] = useState<"DRAFT" | "PUBLIC">("DRAFT");
  const defaultPublishAt = useMemo(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)), []);
  const tiktokHasDownstream =
    platforms.includes("TIKTOK") &&
    platforms.some(platform => platform !== "TIKTOK");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Đang upload và tạo lịch...");
    const form = new FormData(event.currentTarget);
    const hashtags = String(form.get("hashtagsText") ?? "")
      .split(",")
      .map(value => value.trim().replace(/^#/, ""))
      .filter(Boolean);
    const selectedPlatforms = form.getAll("platforms").map(String);
    const publishAtLocal = String(form.get("publishAtLocal") ?? "");
    const publishAt = new Date(publishAtLocal);

    form.delete("hashtagsText");
    form.delete("publishAtLocal");
    form.delete("platforms");
    form.set("hashtags", JSON.stringify(hashtags));
    form.set("platforms", JSON.stringify(selectedPlatforms));
    form.set("publishAt", publishAt.toISOString());

    try {
      const response = await fetch(`${api}/videos`, { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      event.currentTarget.reset();
      setPlatforms(["TIKTOK"]);
      setTiktokPublishMode("DRAFT");
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
          <select
            name="platforms"
            multiple
            size={3}
            value={platforms}
            required
            onChange={event => {
              const nextPlatforms = Array.from(event.currentTarget.selectedOptions).map(option => option.value);
              setPlatforms(nextPlatforms);

              const hasTikTok = nextPlatforms.includes("TIKTOK");
              const hasDownstream = nextPlatforms.some(platform => platform !== "TIKTOK");
              if (hasTikTok && hasDownstream) {
                setTiktokPublishMode("PUBLIC");
              }
            }}
          >
            <option value="FACEBOOK">Facebook</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="TIKTOK">TikTok</option>
          </select>
        </label>

        {platforms.includes("FACEBOOK") && (
          <fieldset>
            <legend>Facebook</legend>
            <label>
              Chế độ đăng
              <select name="facebookPublishMode" defaultValue="PUBLIC">
                <option value="PUBLIC">Public</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
            <label>
              Loại bài đăng
              <select name="facebookContentType" defaultValue="REEL">
                <option value="REEL">Reel</option>
                <option value="VIDEO_POST">Video bài viết bình thường</option>
              </select>
            </label>
          </fieldset>
        )}

        {platforms.includes("YOUTUBE") && (
          <fieldset>
            <legend>YouTube</legend>
            <label>
              Chế độ đăng
              <select name="youtubePublishMode" defaultValue="PUBLIC">
                <option value="PUBLIC">Public</option>
                <option value="DRAFT">Draft / Private</option>
              </select>
            </label>
          </fieldset>
        )}

        {platforms.includes("TIKTOK") && (
          <fieldset>
            <legend>TikTok</legend>
            <label>
              Chế độ đăng
              <select
                name="tiktokPublishMode"
                value={tiktokPublishMode}
                onChange={event => setTiktokPublishMode(event.currentTarget.value as "DRAFT" | "PUBLIC")}
              >
                <option value="DRAFT" disabled={tiktokHasDownstream}>
                  Draft
                </option>
                <option value="PUBLIC">Public</option>
              </select>
            </label>
            {tiktokHasDownstream ? (
              <small>
                TikTok được tự động chuyển sang Public vì Facebook/YouTube cần tải lại video sau khi TikTok đăng xong.
              </small>
            ) : (
              <small>
                Draft là mặc định khi chỉ đăng TikTok. Public sẽ tự bấm Post sau khi upload hoàn tất.
              </small>
            )}
          </fieldset>
        )}

        <label>
          Ngày + giờ chạy
          <input name="publishAtLocal" type="datetime-local" defaultValue={defaultPublishAt} required />
        </label>

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
