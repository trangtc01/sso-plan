import { CreationSection } from "./creation-section";
import { VideoList } from "./video-list";

export default function Home() {
  return (
    <>
      <header className="hero hero-compact">
        <div className="hero-header-row">
          <div>
            <span className="eyebrow">✨ MULTI-PLATFORM AUTOMATION</span>
            <h1>Social Video Scheduler</h1>
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat-chip">
              <span className="dot"></span>
              <span>Worker Queues Active</span>
            </div>
          </div>
        </div>
      </header>

      <CreationSection />

      <VideoList />
    </>
  );
}
