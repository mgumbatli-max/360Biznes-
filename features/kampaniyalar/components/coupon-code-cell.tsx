"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CouponCodeCell({ kod, dim = false }: { kod: string; dim?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(kod);
      setCopied(true);
      toast.success("Kupon kod kopyalandı", { duration: 1500 });
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Kopyalanmadı");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-secondary/40 px-2 py-1 font-mono text-xs font-bold transition hover:border-primary/60 hover:bg-secondary",
        dim && "opacity-60",
      )}
      title="Kliklə kopyala"
    >
      <span>{kod}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground transition group-hover:text-primary" />
      )}
    </button>
  );
}
