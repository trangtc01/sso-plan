"use client";
import { FormEvent, useMemo, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PLATFORM_OPTIONS = [
  { value: "TIKTOK", label: "TikTok", hint: "Đăng trước khi có nền tảng khác" },
  { value: "YOUTUBE", label: "YouTube", hint: "YouTube Studio / Playwright" },
  { value: "FACEBOOK", label: "Facebook", hint: "Reel hoặc video post" },
] as const;

export function UploadForm() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [platforms, setPlatforms] = useState<string[]>(["TIKTOK"]);
  const [tiktokPublishMode, setTiktokPublishMode] = useState<"DRAFT" | "PUBLIC">("DRAFT");
  const [tiktokUseSound, setTiktokUseSound] = useState(true);
  const defaultPublishAt = useMemo(
    () => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    [],
  );

  const hasTikTok = platforms.includes("TIKTOK");
  const hasDownstream = platforms.some(platform => platform !== "TIKTOK");
  const requiresTikTokDownloadedSource = hasTikTok && hasDownstream && tiktokUseSound;

  function togglePlatform(platform: string, checked: boolean) {
    setPlatforms(current => {
      const next = checked
        ? [...new Set([...current, platform])]
        : current.filter(item => item !== platform);

      const nextHasTikTok = next.includes("TIKTOK");
      const nextHasDownstream = next.some(item => item !== "TIKTOK");
      if (nextHasTikTok && nextHasDownstream && tiktokUseSound) {
        setTiktokPublishMode("PUBLIC");
      }
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!platforms.length) {
      setMessageType("error");
      setMessage("Hãy chọn ít nhất một nền tảng.");
      return;
    }

    if (requiresTikTokDownloadedSource && tiktokPublishMode !== "PUBLIC") {
      setMessageType("error");
      setMessage(
        "Khi TikTok có lấy nhạc và còn đăng Facebook/YouTube, TikTok phải là Public để hệ thống tải lại bản đã có nhạc. Hoặc chọn “Không lấy nhạc” để các nền tảng khác dùng video gốc.",
      );
      return;
    }

    setMessageType("info");
    setMessage("Đang upload file và tạo lịch...");

    const form = new FormData(event.currentTarget);
    const hashtags = String(form.get("hashtagsText") ?? "")
      .split(",")
      .map(value => value.trim().replace(/^#/, ""))
      .filter(Boolean);
    const publishAtLocal = String(form.get("publishAtLocal") ?? "");
    const publishAt = new Date(publishAtLocal);

    form.delete("hashtagsText");
    form.delete("publishAtLocal");
    form.delete("platforms");
    form.set("hashtags", JSON.stringify(hashtags));
    form.set("platforms", JSON.stringify(platforms));
    form.set("publishAt", publishAt.toISOString());
    form.set("tiktokUseSound", String(tiktokUseSound));

    try {
      const response = await fetch(`${api}/videos`, { method: "POST", body: form });
      const body = await response.text();
      if (!response.ok) throw new Error(body);

      event.currentTarget.reset();
      setPlatforms(["TIKTOK"]);
      setTiktokPublishMode("DRAFT");
      setTiktokUseSound(true);
      setMessageType("success");
      setMessage("Đã upload video và tạo lịch đăng.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Upload thất bại");
    }
  }

  return (
    <section className="card upload-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">TẠO LỊCH MỚI</p>
          <h2>Upload video</h2>
          <p className="section-description">
            Một video có thể chọn nhiều nền tảng. Nếu có TikTok, TikTok luôn chạy trước.
          </p>
        </div>
      </div>

      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span>Tiêu đề</span>
          <input name="title" required maxLength={200} placeholder="Ví dụ: Bé học chữ say mê" />
        </label>

        <label className="field">
          <span>Video MP4 hoặc MOV</span>
          <input name="file" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" required />
        </label>

        <label className="field field-full">
          <span>Mô tả</span>
          <textarea name="description" maxLength={4000} placeholder="Nội dung caption / description..." />
        </label>

        <label className="field field-full">
          <span>Hashtags</span>
          <input
            name="hashtagsText"
            placeholder="beyeu, mebimsua, behoctienganh, nguoimoixaykenh, boloc24h"
          />
          <small>Phân cách bằng dấu phẩy. Có hoặc không có dấu # đều được.</small>
        </label>

        <div className="field field-full">
          <span>Nền tảng</span>
          <div className="platform-grid">
            {PLATFORM_OPTIONS.map(option => {
              const selected = platforms.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`platform-option ${selected ? "platform-option-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={option.value}
                    checked={selected}
                    onChange={event => togglePlatform(option.value, event.currentTarget.checked)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {hasTikTok && (
          <fieldset className="platform-settings field-full">
            <legend>TikTok</legend>
            <div className="settings-grid">
              <label className="field">
                <span>Chế độ đăng</span>
                <select
                  name="tiktokPublishMode"
                  value={tiktokPublishMode}
                  onChange={event => setTiktokPublishMode(
                    event.currentTarget.value as "DRAFT" | "PUBLIC",
                  )}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </label>

              <label className="field">
                <span>Lấy nhạc từ TikTok</span>
                <select
                  name="tiktokUseSound"
                  value={String(tiktokUseSound)}
                  onChange={event => {
                    const next = event.currentTarget.value === "true";
                    setTiktokUseSound(next);
                    if (next && hasDownstream) setTiktokPublishMode("PUBLIC");
                  }}
                >
                  <option value="true">Có — tự chọn nhạc TikTok</option>
                  <option value="false">Không — giữ video gốc</option>
                </select>
              </label>
            </div>

            <div className={`flow-note ${tiktokUseSound ? "flow-note-accent" : ""}`}>
              {hasDownstream ? (
                tiktokUseSound ? (
                  <>
                    <strong>Flow:</strong> TikTok Public → thêm nhạc → tải lại bản TikTok bằng
                    Playwright → Facebook/YouTube dùng bản đã tải.
                  </>
                ) : (
                  <>
                    <strong>Flow:</strong> TikTok chạy trước → không thêm nhạc, không download
                    TikTok → Facebook/YouTube dùng video gốc.
                  </>
                )
              ) : (
                <>
                  <strong>TikTok only:</strong>{" "}
                  {tiktokUseSound ? "hệ thống sẽ thử chọn nhạc TikTok." : "không thêm nhạc TikTok."}
                </>
              )}
            </div>
          </fieldset>
        )}

        {platforms.includes("YOUTUBE") && (
          <fieldset className="platform-settings">
            <legend>YouTube</legend>
            <label className="field">
              <span>Chế độ đăng</span>
              <select name="youtubePublishMode" defaultValue="PUBLIC">
                <option value="PUBLIC">Public</option>
                <option value="DRAFT">Draft / Private</option>
              </select>
            </label>
          </fieldset>
        )}

        {platforms.includes("FACEBOOK") && (
          <fieldset className="platform-settings">
            <legend>Facebook</legend>
            <div className="settings-grid">
              <label className="field">
                <span>Chế độ đăng</span>
                <select name="facebookPublishMode" defaultValue="PUBLIC">
                  <option value="PUBLIC">Public</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </label>

              <label className="field">
                <span>Loại bài đăng</span>
                <select name="facebookContentType" defaultValue="REEL">
                  <option value="REEL">Reel</option>
                  <option value="VIDEO_POST">Video bài viết bình thường</option>
                </select>
              </label>
            </div>
          </fieldset>
        )}

        <label className="field">
          <span>Ngày + giờ chạy</span>
          <input name="publishAtLocal" type="datetime-local" defaultValue={defaultPublishAt} required />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">Upload và tạo lịch</button>
        </div>
      </form>

      {message && <div className={`form-message form-message-${messageType}`}>{message}</div>}
    </section>
  );
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
