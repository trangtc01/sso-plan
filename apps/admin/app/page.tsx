import { BulkImportForm } from "./bulk-import-form";
import { UploadForm } from "./upload-form";
import { VideoList } from "./video-list";

export default function Home() {
  return (
    <>
      <header>
        <h1>Social Video Scheduler</h1>
        <p>Upload một video hoặc import TXT hàng loạt, chọn nhiều nền tảng và đặt lịch chạy.</p>
      </header>
      <UploadForm />
      <BulkImportForm />
      <VideoList />
    </>
  );
}
