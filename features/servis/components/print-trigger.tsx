"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

export function PrintTrigger() {
  const sp = useSearchParams();
  const auto = sp.get("auto") === "1";

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [auto]);

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
