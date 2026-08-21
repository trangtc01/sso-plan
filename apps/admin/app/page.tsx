import { BulkImportForm } from "./bulk-import-form";
import { UploadForm } from "./upload-form";
import { VideoList } from "./video-list";

export default function Home() {
  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">SOCIAL AUTOMATION</p>
          <h1>Social Video Scheduler</h1>
          <p>
            Upload một video hoặc import hàng loạt, chọn nhiều nền tảng và theo dõi toàn bộ
            pipeline TikTok → Facebook / YouTube.
          </p>
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
