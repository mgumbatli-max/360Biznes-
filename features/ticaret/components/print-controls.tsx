"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft, ReceiptText, FileText } from "lucide-react";

export function PrintControls({ saleId, isThermal }: { saleId: string; isThermal: boolean }) {
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
        href={`/ticaret/satislar/${saleId}`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Geri
      </Link>
      <div className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">Format:</div>
      <Link
        href={`/ticaret/satislar/${saleId}/print`}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
          !isThermal ? "bg-primary/15 text-primary-light" : "hover:bg-secondary"
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        A4 invoice
      </Link>
      <Link
        href={`/ticaret/satislar/${saleId}/print?format=thermal`}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${
          isThermal ? "bg-primary/15 text-primary-light" : "hover:bg-secondary"
        }`}
      >
        <ReceiptText className="h-3.5 w-3.5" />
        Termal qəbz
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
