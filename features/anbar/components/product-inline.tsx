"use client";

import { useState } from "react";
import { Package, Inspect } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { QuickViewDialog } from "./quick-view-dialog";

/**
 * Standard product inline display used everywhere a product appears:
 *  [optional image] <name> 📋 (copy) 🔍 (quick view)
 *  optional subtext (code/barcode) with copy buttons
 *
 * Name itself is NOT clickable — only the icons interact.
 */
export function ProductInline({
  id,
  ad,
  kod,
  barkod,
  sekil_url,
  showImage = true,
  size = "sm",
}: {
  id: string;
  ad: string;
  kod?: string | null;
  barkod?: string | null;
  sekil_url?: string | null;
  showImage?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const img = size === "xs" ? "h-7 w-7" : size === "md" ? "h-10 w-10" : "h-9 w-9";

  return (
    <>
      <div className="flex items-start gap-2 min-w-0">
        {showImage && (
          sekil_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sekil_url} alt={ad} className={`${img} flex-shrink-0 rounded-md object-cover border border-border/40`} />
          ) : (
            <div className={`grid ${img} flex-shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground`}>
              <Package className="h-3.5 w-3.5" />
            </div>
          )
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-medium" title={ad}>{ad}</span>
            <CopyButton value={ad} title="Adı kopya et" size="xs" />
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-primary/15 hover:text-primary-light"
              title="Sürətli baxış"
              aria-label="Sürətli baxış"
            >
              <Inspect className="h-3 w-3" />
            </button>
          </div>
          {(kod || barkod) && (
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {kod && (
                <span className="inline-flex items-center gap-0.5">
                  <span className="font-mono">{kod}</span>
                  <CopyButton value={kod} title="Kodu kopya et" size="xs" />
                </span>
              )}
              {barkod && (
                <span className="inline-flex items-center gap-0.5">
                  <span className="font-mono text-[10px]">{barkod}</span>
                  <CopyButton value={barkod} title="Barkodu kopya et" size="xs" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {open && (
        <QuickViewDialog
          mehsulId={id}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
