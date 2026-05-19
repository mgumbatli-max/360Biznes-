"use client";

import { Printer } from "lucide-react";

export function PrintTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
    >
      <Printer className="h-3.5 w-3.5" /> Çap et
    </button>
  );
}
