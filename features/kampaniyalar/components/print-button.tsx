"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-bold text-background hover:bg-foreground/90"
    >
      <Printer className="h-3 w-3" /> Çap et / PDF
    </button>
  );
}
