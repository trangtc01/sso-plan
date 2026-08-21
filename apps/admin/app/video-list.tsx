"use client";
import { useEffect, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type TikTokJob = {
  id: string;
  status: string;
  retryCount: number;
  errorMessage?: string;
  publishTime?: string;
  publishMode: "DRAFT" | "PUBLIC";
  useSound: boolean;
};

type PublishJob = {
  id: string;
  platform: "FACEBOOK" | "YOUTUBE" | "TIKTOK";
  publishTime?: string;
  status: string;
  retryCount: number;
  errorMessage?: string;
  useTikTokSource: boolean;
};

type Video = {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  status: string;
  createdAt: string;
  jobs: TikTokJob[];
  publishJobs: PublishJob[];
};

type VideoPage = { items: Video[]; total: number };

export function VideoList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
              <th>Chi Tiết / Lỗi</th>
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

                  <td>
                    {!tiktokJob?.errorMessage &&
                      !video.publishJobs.some(job => job.errorMessage) && (
                        <span className="muted">Bình thường</span>
                      )}

                    {tiktokJob?.errorMessage && (
                      <div className="error-box">
                        <strong>TikTok</strong>
                        <span>{tiktokJob.errorMessage}</span>
                      </div>
                    )}

                    {video.publishJobs.filter(job => job.errorMessage).map(job => (
                      <div className="error-box" key={job.id}>
                        <strong>{label(job.platform)}</strong>
                        <span>{job.errorMessage}</span>
                      </div>
                    ))}
                  </td>

                  <td>
                    <div className="action-stack">
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
    </section>
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
