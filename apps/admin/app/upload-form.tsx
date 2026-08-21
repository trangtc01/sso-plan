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
  const [youtubePublishMode, setYoutubePublishMode] = useState<"PUBLIC" | "DRAFT">("PUBLIC");
  const [facebookPublishMode, setFacebookPublishMode] = useState<"PUBLIC" | "DRAFT">("PUBLIC");
  const [facebookContentType, setFacebookContentType] = useState<"REEL" | "VIDEO_POST">("REEL");

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
    form.set("tiktokPublishMode", tiktokPublishMode);
    form.set("tiktokUseSound", String(tiktokUseSound));
    if (platforms.includes("YOUTUBE")) form.set("youtubePublishMode", youtubePublishMode);
    if (platforms.includes("FACEBOOK")) {
      form.set("facebookPublishMode", facebookPublishMode);
      form.set("facebookContentType", facebookContentType);
    }

    try {
      const response = await fetch(`${api}/videos`, { method: "POST", body: form });
      const body = await response.text();
      if (!response.ok) throw new Error(body);

      event.currentTarget.reset();
      setPlatforms(["TIKTOK"]);
      setTiktokPublishMode("DRAFT");
      setTiktokUseSound(true);
      setYoutubePublishMode("PUBLIC");
      setFacebookPublishMode("PUBLIC");
      setFacebookContentType("REEL");
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
        {/* Cột Bên Trái: Thông tin video, File & Nút Submit */}
        <div className="form-col-left">
          <label className="field">
            <span>Tiêu đề video</span>
            <input type="text" name="title" required maxLength={200} placeholder="Ví dụ: Bé học chữ say mê..." />
          </label>

          <label className="field">
            <span>Mô tả / Caption</span>
            <textarea name="description" maxLength={4000} placeholder="Nội dung caption cho bài đăng..." />
          </label>

          <label className="field">
            <span>Hashtags</span>
            <input
              type="text"
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

          <div className="form-actions" style={{ marginTop: "12px" }}>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "🚀 Upload và Tạo Lịch"}
            </button>
          </div>
        </div>

        {/* Cột Bên Phải: Chọn nền tảng & Cấu hình xuất bản (Radio buttons) */}
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
                <div className="field">
                  <span>Chế độ đăng</span>
                  <div className="radio-group">
                    <label className={`radio-option ${tiktokPublishMode === "DRAFT" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="tiktokPublishMode"
                        value="DRAFT"
                        checked={tiktokPublishMode === "DRAFT"}
                        onChange={() => setTiktokPublishMode("DRAFT")}
                      />
                      <span>Draft (Bản nháp)</span>
                    </label>
                    <label className={`radio-option ${tiktokPublishMode === "PUBLIC" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="tiktokPublishMode"
                        value="PUBLIC"
                        checked={tiktokPublishMode === "PUBLIC"}
                        onChange={() => setTiktokPublishMode("PUBLIC")}
                      />
                      <span>Public (Công khai)</span>
                    </label>
                  </div>
                </div>

                <div className="field">
                  <span>Lấy nhạc từ TikTok</span>
                  <div className="radio-group">
                    <label className={`radio-option ${tiktokUseSound ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="tiktokUseSound"
                        value="true"
                        checked={tiktokUseSound}
                        onChange={() => {
                          setTiktokUseSound(true);
                          if (hasDownstream) setTiktokPublishMode("PUBLIC");
                        }}
                      />
                      <span>Có — tự chọn nhạc</span>
                    </label>
                    <label className={`radio-option ${!tiktokUseSound ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="tiktokUseSound"
                        value="false"
                        checked={!tiktokUseSound}
                        onChange={() => setTiktokUseSound(false)}
                      />
                      <span>Không — giữ video gốc</span>
                    </label>
                  </div>
                </div>
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
              <div className="field">
                <span>Chế độ đăng</span>
                <div className="radio-group">
                  <label className={`radio-option ${youtubePublishMode === "PUBLIC" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="youtubePublishMode"
                      value="PUBLIC"
                      checked={youtubePublishMode === "PUBLIC"}
                      onChange={() => setYoutubePublishMode("PUBLIC")}
                    />
                    <span>Public (Công khai)</span>
                  </label>
                  <label className={`radio-option ${youtubePublishMode === "DRAFT" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="youtubePublishMode"
                      value="DRAFT"
                      checked={youtubePublishMode === "DRAFT"}
                      onChange={() => setYoutubePublishMode("DRAFT")}
                    />
                    <span>Draft / Private (Riêng tư)</span>
                  </label>
                </div>
              </div>
            </fieldset>
          )}

          {platforms.includes("FACEBOOK") && (
            <fieldset className="platform-settings">
              <legend>Facebook Config</legend>
              <div className="settings-grid">
                <div className="field">
                  <span>Chế độ đăng</span>
                  <div className="radio-group">
                    <label className={`radio-option ${facebookPublishMode === "PUBLIC" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="facebookPublishMode"
                        value="PUBLIC"
                        checked={facebookPublishMode === "PUBLIC"}
                        onChange={() => setFacebookPublishMode("PUBLIC")}
                      />
                      <span>Public (Công khai)</span>
                    </label>
                    <label className={`radio-option ${facebookPublishMode === "DRAFT" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="facebookPublishMode"
                        value="DRAFT"
                        checked={facebookPublishMode === "DRAFT"}
                        onChange={() => setFacebookPublishMode("DRAFT")}
                      />
                      <span>Draft (Bản nháp)</span>
                    </label>
                  </div>
                </div>

                <div className="field">
                  <span>Loại bài đăng</span>
                  <div className="radio-group">
                    <label className={`radio-option ${facebookContentType === "REEL" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="facebookContentType"
                        value="REEL"
                        checked={facebookContentType === "REEL"}
                        onChange={() => setFacebookContentType("REEL")}
                      />
                      <span>Reel</span>
                    </label>
                    <label className={`radio-option ${facebookContentType === "VIDEO_POST" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="facebookContentType"
                        value="VIDEO_POST"
                        checked={facebookContentType === "VIDEO_POST"}
                        onChange={() => setFacebookContentType("VIDEO_POST")}
                      />
                      <span>Video Feed</span>
                    </label>
                  </div>
                </div>
              </div>
            </fieldset>
          )}
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
