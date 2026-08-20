"use client";
import { useEffect, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type TikTokJob = {
  id: string;
  status: string;
  retryCount: number;
  errorMessage?: string;
  publishTime?: string;
};

type PublishJob = {
  id: string;
  platform: "FACEBOOK" | "YOUTUBE" | "TIKTOK";
  publishTime?: string;
  status: string;
  retryCount: number;
  errorMessage?: string;
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

  const load = () => fetch(`${api}/videos`)
    .then(response => response.ok ? response.json() : Promise.reject(new Error("Không tải được videos")))
    .then((page: VideoPage) => setVideos(page.items))
    .catch(e => setError(e.message));

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  async function rerunTikTok(job: TikTokJob) {
    const confirmed = job.status !== "AMBIGUOUS" || window.confirm(
      "Bạn đã kiểm tra TikTok và xác nhận draft chưa tồn tại? Rerun có thể tạo draft trùng.",
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
    const confirmed = window.confirm(`Hãy kiểm tra ${label(job.platform)} để chắc chắn bài chưa được đăng trước khi rerun. Tiếp tục?`);
    if (!confirmed) return;
    const response = await fetch(`${api}/videos/publish-jobs/${job.id}/rerun`, { method: "POST" });
    if (!response.ok) setError(await response.text()); else load();
  }

  return (
    <section>
      <h2>Videos</h2>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Video</th><th>Metadata</th><th>Lịch / nền tảng</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {videos.map(video => {
            const tiktokJob = video.jobs[0];
            return (
              <tr key={video.id}>
                <td>{video.title}<small>{new Date(video.createdAt).toLocaleString()}</small></td>
                <td>{video.description}<small>{video.hashtags.map(tag => `#${tag}`).join(" ")}</small></td>
                <td>
                  {tiktokJob && <JobLine name="TikTok draft" time={tiktokJob.publishTime} status={tiktokJob.status} />}
                  {video.publishJobs.map(job => <JobLine key={job.id} name={label(job.platform)} time={job.publishTime} status={job.status} />)}
                </td>
                <td>
                  {tiktokJob?.errorMessage && <small className="error">TikTok: {tiktokJob.errorMessage}</small>}
                  {video.publishJobs.filter(job => job.errorMessage).map(job => (
                    <small className="error" key={job.id}>{label(job.platform)}: {job.errorMessage}</small>
                  ))}
                </td>
                <td>
                  {tiktokJob && ["FAILED", "LOGIN_REQUIRED", "AMBIGUOUS"].includes(tiktokJob.status) && (
                    <button onClick={() => rerunTikTok(tiktokJob)}>Rerun TikTok</button>
                  )}
                  {video.publishJobs.filter(job => job.status === "FAILED").map(job => (
                    <button key={job.id} onClick={() => rerunPublish(job)}>Rerun {label(job.platform)}</button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function JobLine({ name, time, status }: { name: string; time?: string; status: string }) {
  return <small><strong>{name}</strong> · {time ? new Date(time).toLocaleString() : "ngay"} · {status}</small>;
}

function label(platform: PublishJob["platform"]): string {
  if (platform === "FACEBOOK") return "Facebook";
  if (platform === "YOUTUBE") return "YouTube";
  return "TikTok";
}
