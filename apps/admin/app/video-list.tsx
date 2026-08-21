"use client";
import { useEffect, useState } from "react";
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
}: {
  video: Video | null;
  onClose: () => void;
  onPreviewPlaywright: (id: string, platform?: string) => void;
  previewing: boolean;
  onRerunTikTok: (job: TikTokJob) => void;
  onRerunPublish: (job: PublishJob) => void;
}) {
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
  const youtubeJob = video.publishJobs.find(j => j.platform === "YOUTUBE");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Chi Tiết Video & Tiến Trình</h3>
            <small style={{ color: "#64748b" }}>ID: {video.id}</small>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Section 1: Overview & Local Video Preview */}
          <div className="modal-section">
            <div className="modal-section-title">📌 THÔNG TIN TỔNG QUAN</div>
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
