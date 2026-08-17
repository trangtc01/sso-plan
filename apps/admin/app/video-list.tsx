"use client";
import { useEffect, useState } from "react";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type Job = { id: string; status: string; retryCount: number; errorMessage?: string };
type Video = { id: string; title: string; description: string; hashtags: string[]; status: string; createdAt: string; jobs: Job[] };
type VideoPage = { items: Video[]; total: number };
export function VideoList() {
  const [videos, setVideos] = useState<Video[]>([]); const [error, setError] = useState("");
  const load = () => fetch(`${api}/videos`).then(response => response.ok ? response.json() : Promise.reject(new Error("Không tải được videos"))).then((page: VideoPage) => setVideos(page.items)).catch(e => setError(e.message));
  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, []);
  async function rerun(job: Job) { const confirmed = job.status !== "AMBIGUOUS" || window.confirm("Bạn đã kiểm tra TikTok và xác nhận draft chưa tồn tại? Rerun có thể tạo draft trùng."); if (!confirmed) return; const response = await fetch(`${api}/videos/jobs/${job.id}/rerun`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmNoDraft: job.status === "AMBIGUOUS" }) }); if (!response.ok) setError(await response.text()); else load(); }
  return <section><h2>Videos</h2>{error && <p className="error">{error}</p>}<table><thead><tr><th>Video</th><th>Metadata</th><th>Status</th><th>Action</th></tr></thead><tbody>{videos.map(video => { const job = video.jobs[0]; return <tr key={video.id}><td>{video.title}<small>{new Date(video.createdAt).toLocaleString()}</small></td><td>{video.description}<small>{video.hashtags.map(tag => `#${tag}`).join(" ")}</small></td><td><strong>{job?.status ?? video.status}</strong>{job?.errorMessage && <small className="error">{job.errorMessage}</small>}</td><td>{job && ["FAILED", "LOGIN_REQUIRED", "AMBIGUOUS"].includes(job.status) && <button onClick={() => rerun(job)}>Rerun</button>}</td></tr>; })}</tbody></table></section>;
}
