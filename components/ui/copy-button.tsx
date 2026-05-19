"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  title = "Kopya et",
  className,
  size = "sm",
}: {
  value: string;
  title?: string;
  className?: string;
  size?: "xs" | "sm";
}) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Kopyalandı");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Kopyalanmadı");
    }
  }

  const sizeCls = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  const iconCls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={copy}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground",
        sizeCls,
        copied && "text-success",
        className
      )}
      aria-label={title}
    >
      {copied ? <Check className={iconCls} /> : <Copy className={iconCls} />}
    </button>
  );
}
