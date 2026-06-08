"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

export function PurchasePrintControls({ purchaseId }: { purchaseId: string }) {
  const sp = useSearchParams();
  const auto = sp.get("auto") === "1";

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/80 px-4 py-2 backdrop-blur print:hidden">
      <Link
        href={`/ticaret/alislar/${purchaseId}`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Geri
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white"
        style={{ background: "var(--brand-gradient)" }}
      >
        <Printer className="h-3.5 w-3.5" />
        Çap et / PDF saxla
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
      >
        Bağla
      </button>
    </div>
  );
}
