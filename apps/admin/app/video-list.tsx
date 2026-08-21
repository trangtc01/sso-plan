"use client";
import { FormEvent, useEffect, useState } from "react";
import type { PublishJob, TikTokJob, Video, VideoPage } from "./types.js";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function VideoList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = () => fetch(`${api}/videos`)
    .then(response => response.ok ? response.json() : Promise.reject(new Error("Không tải được dữ liệu danh sách video")))
    .then((page: VideoPage) => {
      setVideos(page.items);
      setError("");
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedVideoId) {
      setSelectedVideo(null);
      return;
    }
    fetch(`${api}/videos/${selectedVideoId}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error("Không tải được chi tiết video")))
      .then(data => setSelectedVideo(data))
      .catch(e => setError(e.message));
  }, [selectedVideoId]);

  async function rerunTikTok(job: TikTokJob) {
    const confirmed = job.status !== "AMBIGUOUS" || window.confirm(
      "Bạn đã kiểm tra TikTok và xác nhận draft/post chưa tồn tại? Rerun có thể tạo nội dung trùng.",
    );
    if (!confirmed) return;

    const response = await fetch(`${api}/videos/jobs/${job.id}/rerun`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmNoDraft: job.status === "AMBIGUOUS" }),
    });
    if (!response.ok) setError(await response.text()); else load();
  }

  async function rerunPublish(job: PublishJob) {
    const confirmed = window.confirm(
      `Hãy kiểm tra ${label(job.platform)} để chắc chắn bài chưa được đăng trước khi rerun. Tiếp tục?`,
    );
    if (!confirmed) return;

    const response = await fetch(`${api}/videos/publish-jobs/${job.id}/rerun`, { method: "POST" });
    if (!response.ok) setError(await response.text()); else load();
  }

  async function triggerPlaywrightPreview(videoId: string, platform?: string) {
    setPreviewing(true);
    try {
      const url = platform ? `${api}/videos/${videoId}/preview-playwright?platform=${platform}` : `${api}/videos/${videoId}/preview-playwright`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        alert(`Không thể mở preview Playwright: ${text}`);
      } else {
        const platformLabel = platform === "tiktok" ? "TikTok" : platform === "youtube" ? "YouTube Studio" : "File Video";
        alert(`Đã khởi chạy Playwright browser (${platformLabel}) để xem video!`);
      }
    } catch (err) {
      alert(`Lỗi kết nối API: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <section className="card videos-card">
      <div className="section-heading section-heading-row">
        <div>
          <span className="eyebrow">QUEUE & MONITORING</span>
          <h2>Danh Sách Video & Trạng Thái</h2>
          <p className="section-description">Hệ thống tự động cập nhật tiến trình mỗi 5 giây.</p>
        </div>
        <span className="count-badge">Tổng số: {videos.length} video</span>
      </div>

      {error && <div className="form-message form-message-error">{error}</div>}

      <div className="table-scroll">
        <table className="videos-table">
          <thead>
            <tr>
              <th>Thông Tin Video</th>
              <th>Mô Tả & Tags</th>
              <th>Tiến Trình Theo Nền Tảng</th>
              <th style={{ minWidth: "240px", maxWidth: "280px" }}>Chi Tiết / Lỗi</th>
              <th>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {videos.map(video => {
              const tiktokJob = video.jobs[0];
              return (
                <tr key={video.id}>
                  <td style={{ minWidth: "220px" }}>
                    <strong className="video-title">{video.title || "(Chưa đặt tiêu đề)"}</strong>
                    <small style={{ display: "block", marginBottom: "6px" }}>
                      📅 {new Date(video.createdAt).toLocaleString()}
                    </small>
                    <StatusBadge status={video.status} />
                  </td>

                  <td>
                    <div className="metadata-description">{video.description || "—"}</div>
                    {video.hashtags.length > 0 && (
                      <span className="hashtags">
                        {video.hashtags.map(tag => `#${tag}`).join(" ")}
                      </span>
                    )}
                  </td>

                  <td style={{ minWidth: "260px" }}>
                    {tiktokJob && (
                      <JobLine
                        name={`TikTok ${tiktokJob.publishMode}`}
                        time={tiktokJob.publishTime}
                        status={tiktokJob.status}
                        detail={tiktokJob.useSound ? "có nhạc" : "gốc"}
                      />
                    )}

                    {video.publishJobs.map(job => (
                      <JobLine
                        key={job.id}
                        name={label(job.platform)}
                        time={job.publishTime}
                        status={job.status}
                        detail={job.useTikTokSource ? "nguồn TikTok" : "video gốc"}
                      />
                    ))}
                  </td>

                  <td style={{ minWidth: "240px", maxWidth: "280px" }}>
                    {!tiktokJob?.errorMessage &&
                      !video.publishJobs.some(job => job.errorMessage) && (
                        <span className="muted">Bình thường</span>
                      )}

                    {tiktokJob?.errorMessage && (
                      <div className="error-box" title={tiktokJob.errorMessage}>
                        <strong>TikTok</strong>
                        <span>{tiktokJob.errorMessage}</span>
                      </div>
                    )}

                    {video.publishJobs.filter(job => job.errorMessage).map(job => (
                      <div className="error-box" key={job.id} title={job.errorMessage}>
                        <strong>{label(job.platform)}</strong>
                        <span>{job.errorMessage}</span>
                      </div>
                    ))}
                  </td>

                  <td>
                    <div className="action-stack">
                      <button
                        className="secondary-button"
                        style={{ background: "#f8fafc", borderColor: "#cbd5e1" }}
                        onClick={() => setSelectedVideoId(video.id)}
                      >
                        🔍 Chi Tiết
                      </button>

                      {video.tiktokPublishedUrl && (
                        <a
                          href={video.tiktokPublishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button"
                          style={{ textDecoration: "none", textAlign: "center", color: "#0284c7" }}
                        >
                          🌐 Xem TikTok
                        </a>
                      )}

                      {tiktokJob && ["FAILED", "LOGIN_REQUIRED", "AMBIGUOUS"].includes(tiktokJob.status) && (
                        <button className="secondary-button" onClick={() => rerunTikTok(tiktokJob)}>
                          🔄 Rerun TikTok
                        </button>
                      )}
                      {video.publishJobs.filter(job => job.status === "FAILED").map(job => (
                        <button
                          className="secondary-button"
                          key={job.id}
                          onClick={() => rerunPublish(job)}
                        >
                          🔄 Rerun {label(job.platform)}
                        </button>
                      ))}

                      {(!video.jobs.some(j => ["UPLOADING", "SETTING_SOUND", "PUBLISHING", "DOWNLOADING", "PUBLISHED"].includes(j.status)) &&
                        !video.publishJobs.some(j => ["UPLOADING", "SETTING_SOUND", "PUBLISHING", "DOWNLOADING", "PUBLISHED"].includes(j.status))) && (
                        <button
                          className="secondary-button"
                          style={{ borderColor: "#fca5a5", color: "#dc2626" }}
                          title="Xóa video khỏi hàng chờ"
                          onClick={() => deleteVideo(video.id)}
                        >
                          🗑️ Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!videos.length && (
              <tr>
                <td colSpan={5} className="empty-state">
                  {loading ? "Đang tải dữ liệu..." : "Chưa có video nào trong hàng đợi."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedVideoId && (
        <DetailModal
          video={selectedVideo}
          onClose={() => {
            setSelectedVideoId(null);
            setSelectedVideo(null);
          }}
          onPreviewPlaywright={triggerPlaywrightPreview}
          previewing={previewing}
          onRerunTikTok={rerunTikTok}
          onRerunPublish={rerunPublish}
          onVideoUpdated={() => {
            load();
            if (selectedVideoId) {
              fetch(`${api}/videos/${selectedVideoId}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => data && setSelectedVideo(data));
            }
          }}
          onDeleteVideo={(id) => deleteVideo(id)}
        />
      )}
    </section>
  );
}

function DetailModal({
  video,
  onClose,
  onPreviewPlaywright,
  previewing,
  onRerunTikTok,
  onRerunPublish,
  onVideoUpdated,
  onDeleteVideo,
}: {
  video: Video | null;
  onClose: () => void;
  onPreviewPlaywright: (id: string, platform?: string) => void;
  previewing: boolean;
  onRerunTikTok: (job: TikTokJob) => void;
  onRerunPublish: (job: PublishJob) => void;
  onVideoUpdated?: () => void;
  onDeleteVideo?: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  if (!video) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Đang tải chi tiết video...</h3>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body" style={{ padding: "40px", textAlign: "center" }}>
            <span className="muted">Vui lòng chờ giây lát...</span>
          </div>
        </div>
      </div>
    );
  }

  const tiktokJob = video.jobs[0];
  const facebookJob = video.publishJobs.find(j => j.platform === "FACEBOOK");
  const youtubeJob = video.publishJobs.find(j => j.platform === "YOUTUBE");

  const BUSY_STATUSES = ["UPLOADING", "SETTING_SOUND", "PUBLISHING", "DOWNLOADING", "PUBLISHED"];
  const isEditable =
    !video.jobs.some(j => BUSY_STATUSES.includes(j.status)) &&
    !video.publishJobs.some(j => BUSY_STATUSES.includes(j.status));

  const defaultPublishTime = tiktokJob?.publishTime || facebookJob?.publishTime || youtubeJob?.publishTime || video.createdAt;

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!video) return;
    setSaving(true);
    setEditError("");
    setEditSuccess("");

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const hashtagsText = String(form.get("hashtagsText") ?? "");
    const hashtags = hashtagsText.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    const publishAtLocal = String(form.get("publishAtLocal") ?? "");
    const publishAt = publishAtLocal ? new Date(publishAtLocal).toISOString() : undefined;

    const payload: Record<string, unknown> = { title, description, hashtags, publishAt };

    if (tiktokJob) {
      payload.tiktokPublishMode = form.get("tiktokPublishMode");
      payload.tiktokUseSound = form.get("tiktokUseSound") === "true";
    }

    if (facebookJob) {
      payload.facebookPublishMode = form.get("facebookPublishMode");
      payload.facebookContentType = form.get("facebookContentType");
      payload.facebookUseTikTokSource = form.get("facebookUseTikTokSource") === "true";
    }

    if (youtubeJob) {
      payload.youtubePublishMode = form.get("youtubePublishMode");
      payload.youtubeUseTikTokSource = form.get("youtubeUseTikTokSource") === "true";
    }

    try {
      const res = await fetch(`${api}/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = body?.message ? (Array.isArray(body.message) ? body.message.join(", ") : body.message) : "Cập nhật thất bại";
        throw new Error(msg);
      }

      setEditSuccess("✨ Cập nhật thông tin và lên lại lịch thành công!");
      setIsEditing(false);
      onVideoUpdated?.();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{isEditing ? "✏️ Chỉnh Sửa Video & Lịch Đăng" : "Chi Tiết Video & Tiến Trình"}</h3>
            <small style={{ color: "#64748b" }}>ID: {video.id}</small>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {editSuccess && <div className="form-message form-message-success" style={{ margin: "12px 20px 0" }}>{editSuccess}</div>}

        {isEditing ? (
          <form className="modal-body" onSubmit={handleSaveEdit}>
            {editError && <div className="form-message form-message-error">{editError}</div>}

            <div className="modal-section">
              <div className="modal-section-title">📌 THÔNG TIN VIDEO GỐC</div>
              <div className="form-col-left" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label className="field">
                  <span>Tiêu đề video</span>
                  <input name="title" type="text" defaultValue={video.title} required maxLength={200} />
                </label>
                <label className="field">
                  <span>Mô tả / Caption</span>
                  <textarea name="description" defaultValue={video.description} maxLength={4000} />
                </label>
                <label className="field">
                  <span>Hashtags (phân cách bằng dấu phẩy)</span>
                  <input name="hashtagsText" type="text" defaultValue={video.hashtags.join(", ")} />
                </label>
                <label className="field">
                  <span>Thời gian xuất bản</span>
                  <input name="publishAtLocal" type="datetime-local" defaultValue={toLocalInputValue(defaultPublishTime)} required />
                </label>
              </div>
            </div>

            {tiktokJob && (
              <fieldset className="platform-settings" style={{ marginTop: "12px" }}>
                <legend>🎵 TikTok Config</legend>
                <div className="settings-grid">
                  <div className="field">
                    <span>Chế độ đăng</span>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="tiktokPublishMode" value="DRAFT" defaultChecked={tiktokJob.publishMode === "DRAFT"} />
                        <span>Draft (Nháp)</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="tiktokPublishMode" value="PUBLIC" defaultChecked={tiktokJob.publishMode === "PUBLIC"} />
                        <span>Public</span>
                      </label>
                    </div>
                  </div>
                  <div className="field">
                    <span>Lấy nhạc từ TikTok</span>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="tiktokUseSound" value="true" defaultChecked={tiktokJob.useSound === true} />
                        <span>Có (chọn nhạc)</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="tiktokUseSound" value="false" defaultChecked={tiktokJob.useSound === false} />
                        <span>Không (video gốc)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            {facebookJob && (
              <fieldset className="platform-settings" style={{ marginTop: "12px" }}>
                <legend>📘 Facebook Config</legend>
                <div className="settings-grid">
                  <div className="field">
                    <span>Chế độ đăng</span>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="facebookPublishMode" value="PUBLIC" defaultChecked={(facebookJob.publishMode ?? "PUBLIC") === "PUBLIC"} />
                        <span>Public</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="facebookPublishMode" value="DRAFT" defaultChecked={facebookJob.publishMode === "DRAFT"} />
                        <span>Draft (Nháp)</span>
                      </label>
                    </div>
                  </div>
                  <div className="field">
                    <span>Định dạng</span>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="facebookContentType" value="REEL" defaultChecked={(facebookJob.facebookContentType ?? "REEL") === "REEL"} />
                        <span>Reel</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="facebookContentType" value="VIDEO_POST" defaultChecked={facebookJob.facebookContentType === "VIDEO_POST"} />
                        <span>Video Feed</span>
                      </label>
                    </div>
                  </div>
                  <div className="field">
                    <span>Nguồn video</span>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="facebookUseTikTokSource" value="false" defaultChecked={!facebookJob.useTikTokSource} />
                        <span>Video gốc</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="facebookUseTikTokSource" value="true" defaultChecked={facebookJob.useTikTokSource} />
                        <span>Video từ TikTok</span>
                      </label>
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            {youtubeJob && (
              <fieldset className="platform-settings" style={{ marginTop: "12px" }}>
                <legend>🔴 YouTube Config</legend>
                <div className="settings-grid">
                  <div className="field">
                    <span>Chế độ đăng</span>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="youtubePublishMode" value="PUBLIC" defaultChecked={(youtubeJob.publishMode ?? "PUBLIC") === "PUBLIC"} />
                        <span>Public</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="youtubePublishMode" value="DRAFT" defaultChecked={youtubeJob.publishMode === "DRAFT"} />
                        <span>Private (Riêng tư)</span>
                      </label>
                    </div>
                  </div>
                  <div className="field">
                    <span>Nguồn video</span>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="youtubeUseTikTokSource" value="false" defaultChecked={!youtubeJob.useTikTokSource} />
                        <span>Video gốc</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="youtubeUseTikTokSource" value="true" defaultChecked={youtubeJob.useTikTokSource} />
                        <span>Video từ TikTok</span>
                      </label>
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "💾 Lưu Cập Nhật"}
              </button>
              <button className="secondary-button" type="button" onClick={() => setIsEditing(false)} disabled={saving}>
                ✕ Hủy
              </button>
            </div>
          </form>
        ) : (
          <div className="modal-body">
            {/* Section 1: Overview & Local Video Preview */}
            <div className="modal-section">
              <div className="modal-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📌 THÔNG TIN TỔNG QUAN</span>
                {isEditable ? (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="secondary-button"
                      style={{ fontSize: "11px", padding: "4px 10px" }}
                      onClick={() => setIsEditing(true)}
                    >
                      ✏️ Sửa
                    </button>
                    <button
                      className="secondary-button"
                      style={{ fontSize: "11px", padding: "4px 10px", borderColor: "#fca5a5", color: "#dc2626" }}
                      onClick={() => onDeleteVideo?.(video.id)}
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: "11px", textTransform: "none", fontWeight: 400 }}>
                    🔒 Không thể sửa/xóa (Đang/Đã đăng)
                  </span>
                )}
              </div>
              <div className="modal-grid">
              <div className="modal-field">
                <label>Tiêu đề</label>
                <span><strong>{video.title || "(Chưa đặt)"}</strong></span>
              </div>
              <div className="modal-field">
                <label>Trạng thái Video</label>
                <div><StatusBadge status={video.status} /></div>
              </div>
              <div className="modal-field" style={{ gridColumn: "span 2" }}>
                <label>Mô tả</label>
                <span>{video.description || "—"}</span>
              </div>
              <div className="modal-field" style={{ gridColumn: "span 2" }}>
                <label>Hashtags</label>
                <span>{video.hashtags.length ? video.hashtags.map(t => `#${t}`).join(" ") : "—"}</span>
              </div>
              <div className="modal-field" style={{ gridColumn: "span 2" }}>
                <label>File nguồn (sourcePath)</label>
                <code>{video.sourcePath || "—"}</code>
              </div>
              {video.tiktokDownloadedPath && (
                <div className="modal-field" style={{ gridColumn: "span 2" }}>
                  <label>File TikTok đã tải (tiktokDownloadedPath)</label>
                  <code>{video.tiktokDownloadedPath}</code>
                </div>
              )}
            </div>

            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                  🎬 Xem Trực Tiếp Video Gốc / Output (Trình Duyệt)
                </label>
                {(video.outputPath || video.sourcePath) && (
                  <a
                    href={`${api}/videos/${video.id}/stream`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "12px", color: "#4f46e5", fontWeight: 600, wordBreak: "break-all" }}
                    title={`Stream API: ${api}/videos/${video.id}/stream`}
                  >
                    📁 {video.outputPath || video.sourcePath}
                  </a>
                )}
              </div>
              <video
                src={`${api}/videos/${video.id}/stream`}
                controls
                preload="metadata"
                style={{
                  width: "100%",
                  maxHeight: "320px",
                  borderRadius: "12px",
                  background: "#000000",
                  display: "block",
                }}
              />
            </div>
          </div>

          {/* Section 2: TikTok Job & TikTok Preview Actions */}
          {tiktokJob && (
            <div className="modal-section" style={{ borderLeft: "4px solid #000000" }}>
              <div className="modal-section-title" style={{ color: "#000000" }}>🎵 TIKTOK JOB</div>
              <div className="modal-grid">
                <div className="modal-field">
                  <label>Trạng thái Job</label>
                  <div><StatusBadge status={tiktokJob.status} /></div>
                </div>
                <div className="modal-field">
                  <label>Chế độ Đăng (Mode)</label>
                  <span><strong>{tiktokJob.publishMode}</strong></span>
                </div>
                <div className="modal-field">
                  <label>Tùy chọn Audio / Nhạc</label>
                  <span>{tiktokJob.useSound ? "🎵 Add nhạc TikTok (useSound: true)" : "🔈 Video gốc (no sound)"}</span>
                </div>
                <div className="modal-field">
                  <label>Lịch Đăng bài</label>
                  <span>{tiktokJob.publishTime ? new Date(tiktokJob.publishTime).toLocaleString() : "⚡ Đăng ngay"}</span>
                </div>
                <div className="modal-field">
                  <label>Số lần thử (Retry Count)</label>
                  <span>{tiktokJob.retryCount} lần</span>
                </div>
              </div>

              {tiktokJob.errorMessage && (
                <div style={{ marginTop: "12px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>
                    Chi tiết lỗi đụng phải (Error Trace)
                  </label>
                  <div className="modal-full-error">{tiktokJob.errorMessage}</div>
                  {["FAILED", "LOGIN_REQUIRED", "AMBIGUOUS"].includes(tiktokJob.status) && (
                    <button
                      className="secondary-button"
                      style={{ marginTop: "8px" }}
                      onClick={() => onRerunTikTok(tiktokJob)}
                    >
                      🔄 Rerun TikTok Job
                    </button>
                  )}
                </div>
              )}

              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <a
                  href={video.tiktokPublishedUrl || "https://www.tiktok.com/tiktokstudio/content?tab=draft"}
                  target="_blank"
                  rel="noreferrer"
                  className="secondary-button"
                  style={{ background: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  🎵 Mở Web TikTok {video.tiktokPublishedUrl ? "(Video Online)" : "Drafts Studio"} (Trình Duyệt)
                </a>
              </div>
            </div>
          )}

          {/* Section 3: Downstream Publish Jobs (Facebook / YouTube) */}
          {video.publishJobs.map(job => {
            const isFb = job.platform === "FACEBOOK";
            const isYt = job.platform === "YOUTUBE";
            return (
              <div
                className="modal-section"
                key={job.id}
                style={{ borderLeft: `4px solid ${isFb ? "#1877f2" : "#ff0000"}` }}
              >
                <div className="modal-section-title" style={{ color: isFb ? "#1877f2" : "#dc2626" }}>
                  {isFb ? "📘 FACEBOOK JOB" : "🔴 YOUTUBE JOB"}
                </div>
                <div className="modal-grid">
                  <div className="modal-field">
                    <label>Trạng thái Job</label>
                    <div><StatusBadge status={job.status} /></div>
                  </div>
                  <div className="modal-field">
                    <label>Chế độ Đăng (Mode)</label>
                    <span>
                      <strong>
                        {isYt
                          ? (job.publishMode === "DRAFT" ? "DRAFT (Private)" : "PUBLIC")
                          : (job.publishMode ?? "PUBLIC")}
                      </strong>
                    </span>
                  </div>
                  {isFb && (
                    <div className="modal-field">
                      <label>Định dạng Video (Format)</label>
                      <span><strong>{job.facebookContentType ?? "REEL"}</strong></span>
                    </div>
                  )}
                  <div className="modal-field">
                    <label>Nguồn Video / Audio</label>
                    <span>{job.useTikTokSource ? "🎵 Tải từ TikTok (có nhạc)" : "📹 Video gốc"}</span>
                  </div>
                  <div className="modal-field">
                    <label>Lịch Đăng bài</label>
                    <span>{job.publishTime ? new Date(job.publishTime).toLocaleString() : "⚡ Đăng ngay"}</span>
                  </div>
                  <div className="modal-field">
                    <label>Số lần thử</label>
                    <span>{job.retryCount} lần</span>
                  </div>
                </div>

                {job.errorMessage && (
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>
                      Chi tiết lỗi (Error Trace)
                    </label>
                    <div className="modal-full-error">{job.errorMessage}</div>
                    {job.status === "FAILED" && (
                      <button
                        className="secondary-button"
                        style={{ marginTop: "8px" }}
                        onClick={() => onRerunPublish(job)}
                      >
                        🔄 Rerun {label(job.platform)} Job
                      </button>
                    )}
                  </div>
                )}

                {Boolean(job.response) && (
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                      Phản hồi nền tảng (Raw Response)
                    </label>
                    <pre style={{
                      background: "#f1f5f9",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      overflowX: "auto",
                    }}>
                      {JSON.stringify(job.response, null, 2)}
                    </pre>
                  </div>
                )}

                {isFb && (job.status === "PUBLISHED" || job.status === "DRAFT_SAVED" || Boolean(job.response)) && (
                  <FacebookPreview job={job} />
                )}

                {isYt && (
                  <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                    <a
                      href="https://studio.youtube.com"
                      target="_blank"
                      rel="noreferrer"
                      className="secondary-button"
                      style={{ background: "#ffffff", color: "#dc2626", borderColor: "#fca5a5", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                    >
                      🔴 Mở YouTube Studio (Trình Duyệt)
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}

        <div className="modal-footer">
          <button className="primary-button" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function JobLine({
  name,
  time,
  status,
  detail,
}: {
  name: string;
  time?: string;
  status: string;
  detail?: string;
}) {
  return (
    <div className="job-line">
      <div>
        <strong>{name}</strong>
        {detail && <span className="job-detail"> · {detail}</span>}
      </div>
      <small>{time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Ngay"}</small>
      <StatusBadge status={status} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replaceAll("_", "-");
  return <span className={`status-badge status-${normalized}`}>{status}</span>;
}

function label(platform: PublishJob["platform"]): string {
  if (platform === "FACEBOOK") return "Facebook";
  if (platform === "YOUTUBE") return "YouTube";
  return "TikTok";
}

function FacebookPreview({ job }: { job: PublishJob }) {
  const response = asRecord(job.response);
  const raw = asRecord(response?.raw);
  const rawResp = asRecord(raw?.response);
  const externalId =
    (typeof response?.externalId === "string" && response.externalId) ||
    (typeof rawResp?.id === "string" && rawResp.id) ||
    (typeof raw?.id === "string" && raw.id) ||
    undefined;

  const permalinkUrl = typeof raw?.permalinkUrl === "string" && raw.permalinkUrl
    ? raw.permalinkUrl
    : externalId
      ? `https://www.facebook.com/reel/${encodeURIComponent(externalId)}`
      : undefined;
  const thumbnailUrl = typeof raw?.thumbnailUrl === "string" ? raw.thumbnailUrl : undefined;

  if (!permalinkUrl && !thumbnailUrl) return null;

  return (
    <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
      <label style={{ fontSize: "11px", fontWeight: 700, color: "#1877f2", textTransform: "uppercase" }}>
        Facebook Preview
      </label>
      {thumbnailUrl && (
        <a href={permalinkUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: "8px" }}>
          <img src={thumbnailUrl} alt="Facebook video preview"
            style={{ display: "block", maxWidth: "320px", width: "100%", borderRadius: "10px", border: "1px solid #e2e8f0" }} />
        </a>
      )}
      {permalinkUrl && (
        <a href={permalinkUrl} target="_blank" rel="noreferrer" className="secondary-button"
          style={{ display: "inline-block", marginTop: "10px", textDecoration: "none", color: "#1877f2", background: "#fff", borderColor: "#bfdbfe" }}>
          Mở video Facebook trong trình duyệt ↗
        </a>
      )}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function toLocalInputValue(dateInput?: string | Date): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
