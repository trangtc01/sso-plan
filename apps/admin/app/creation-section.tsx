"use client";
import { useState } from "react";
import { BulkImportForm } from "./bulk-import-form";
import { UploadForm } from "./upload-form";

export function CreationSection() {
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  return (
    <section className="card creation-card">
      <div className="creation-tab-header">
        <div className="tab-switcher">
          <button
            type="button"
            className={`tab-btn ${activeTab === "single" ? "active" : ""}`}
            onClick={() => setActiveTab("single")}
          >
            <span>📹 Upload Video Đơn</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "bulk" ? "active" : ""}`}
            onClick={() => setActiveTab("bulk")}
          >
            <span>📥 Bulk Import (TXT / CSV)</span>
          </button>
        </div>
      </div>

      {activeTab === "single" ? <UploadForm /> : <BulkImportForm />}
    </section>
  );
}
