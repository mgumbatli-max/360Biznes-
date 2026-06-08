"use client";

import { FileText } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
    >
      <FileText className="h-3.5 w-3.5" /> Çap
    </button>
  );
}
