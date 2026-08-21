"use client";
import { FormEvent, useMemo, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PlatformConfig {
  value: "TIKTOK" | "YOUTUBE" | "FACEBOOK";
  label: string;
  hint: string;
  colorClass: string;
}

const PLATFORM_OPTIONS: PlatformConfig[] = [
  {
    value: "TIKTOK",
    label: "TikTok",
    hint: "Đăng trước khi có nền tảng khác",
    colorClass: "platform-tiktok",
  },
  {
    value: "YOUTUBE",
    label: "YouTube",
    hint: "YouTube Studio / Playwright",
    colorClass: "platform-youtube",
  },
  {
    value: "FACEBOOK",
    label: "Facebook",
    hint: "Reel hoặc video post",
    colorClass: "platform-facebook",
  },
];

export function UploadForm() {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [loading, setLoading] = useState(false);
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

    setLoading(true);
    setMessageType("info");
    setMessage("Đang upload video và tạo lịch...");

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
      setMessage("🎉 Đã upload video và lên lịch đăng thành công!");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Upload thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="upload-form-wrapper">
      <form className="two-column-upload-form" onSubmit={submit}>
        {/* Cột Bên Trái: Thông tin video & File */}
        <div className="form-col-left">
          <label className="field">
            <span>Tiêu đề video</span>
            <input name="title" required maxLength={200} placeholder="Ví dụ: Bé học chữ say mê..." />
          </label>

          <label className="field">
            <span>Mô tả / Caption</span>
            <textarea name="description" maxLength={4000} placeholder="Nội dung caption cho bài đăng..." />
          </label>

          <label className="field">
            <span>Hashtags</span>
            <input
              name="hashtagsText"
              placeholder="beyeu, mebimsua, behoctienganh, nguoimoixaykenh"
            />
            <small>Phân cách bằng dấu phẩy (# không bắt buộc).</small>
          </label>

          <label className="field">
            <span>File Video (MP4 / MOV)</span>
            <input name="file" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" required />
          </label>

          <label className="field">
            <span>Thời gian xuất bản</span>
            <input name="publishAtLocal" type="datetime-local" defaultValue={defaultPublishAt} required />
          </label>
        </div>

        {/* Cột Bên Phải: Chọn nền tảng & Cấu hình xuất bản */}
        <div className="form-col-right">
          <div className="field">
            <span>Nền tảng xuất bản</span>
            <div className="platform-grid">
              {PLATFORM_OPTIONS.map(option => {
                const selected = platforms.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`platform-option ${selected ? `platform-option-selected ${option.colorClass}` : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="platforms"
                      value={option.value}
                      checked={selected}
                      onChange={event => togglePlatform(option.value, event.currentTarget.checked)}
                    />
                    <div className="platform-option-content">
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {hasTikTok && (
            <fieldset className="platform-settings">
              <legend>TikTok Config</legend>
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
                    <option value="DRAFT">Draft (Bản nháp)</option>
                    <option value="PUBLIC">Public (Công khai ngay)</option>
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
                    <option value="true">Có — tự chọn nhạc trên TikTok</option>
                    <option value="false">Không — giữ nguyên video gốc</option>
                  </select>
                </label>
              </div>

              <div className={`flow-note ${tiktokUseSound ? "flow-note-accent" : ""}`}>
                {hasDownstream ? (
                  tiktokUseSound ? (
                    <>
                      💡 <strong>Pipeline:</strong> TikTok Public → thêm nhạc → tải lại video hoàn chỉnh → FB/YT dùng bản đã tải.
                    </>
                  ) : (
                    <>
                      ℹ️ <strong>Pipeline:</strong> TikTok chạy trước → không chọn nhạc → FB/YT dùng thẳng video gốc.
                    </>
                  )
                ) : (
                  <>
                    ℹ️ <strong>TikTok only:</strong>{" "}
                    {tiktokUseSound ? "Thử chọn nhạc trending trên TikTok." : "Đăng video mà không thêm nhạc TikTok."}
                  </>
                )}
              </div>
            </fieldset>
          )}

          {platforms.includes("YOUTUBE") && (
            <fieldset className="platform-settings">
              <legend>YouTube Config</legend>
              <label className="field">
                <span>Chế độ đăng</span>
                <select name="youtubePublishMode" defaultValue="PUBLIC">
                  <option value="PUBLIC">Public (Công khai)</option>
                  <option value="DRAFT">Draft / Private (Riêng tư)</option>
                </select>
              </label>
            </fieldset>
          )}

          {platforms.includes("FACEBOOK") && (
            <fieldset className="platform-settings">
              <legend>Facebook Config</legend>
              <div className="settings-grid">
                <label className="field">
                  <span>Chế độ đăng</span>
                  <select name="facebookPublishMode" defaultValue="PUBLIC">
                    <option value="PUBLIC">Public (Công khai)</option>
                    <option value="DRAFT">Draft (Bản nháp)</option>
                  </select>
                </label>

                <label className="field">
                  <span>Loại bài đăng</span>
                  <select name="facebookContentType" defaultValue="REEL">
                    <option value="REEL">Reel</option>
                    <option value="VIDEO_POST">Video Feed</option>
                  </select>
                </label>
              </div>
            </fieldset>
          )}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "🚀 Upload và Tạo Lịch"}
            </button>
          </div>
        </div>
      </form>

      {message && <div className={`form-message form-message-${messageType}`}>{message}</div>}
    </div>
  );
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
