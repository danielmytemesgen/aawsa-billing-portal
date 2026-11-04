"use client";

import * as React from "react";
import { ReadingCorrectionsReportView } from "@/features/reports/reading-corrections-report-view";

export default function AdminReadingCorrectionsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <ReadingCorrectionsReportView isAdmin={true} isEmbedded={false} />
    </div>
  );
}

