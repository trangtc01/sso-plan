import { BulkImportForm } from "./bulk-import-form";
import { UploadForm } from "./upload-form";
import { VideoList } from "./video-list";

export default function Home() {
  return (
    <>
      <header className="hero">
        <div className="hero-header-row">
          <div>
            <span className="eyebrow">✨ MULTI-PLATFORM AUTOMATION</span>
            <h1>Social Video Scheduler</h1>
            <p className="hero-description">
              Tải lên một video hoặc import hàng loạt file TXT/CSV. Tự động đồng bộ pipeline
              thêm nhạc từ TikTok sang Facebook Reels và YouTube Shorts theo lịch trình.
            </p>
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat-chip">
              <span className="dot"></span>
              <span>Worker Queues Active</span>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <UploadForm />
        <BulkImportForm />
      </div>

      <VideoList />
    </>
  );
}
