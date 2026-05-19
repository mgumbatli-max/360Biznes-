"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden as VisuallyHiddenPrimitive } from "radix-ui";

const VisuallyHidden = VisuallyHiddenPrimitive.Root;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Path to embed; `embed=1` will be appended automatically */
  src: string | null;
};

/**
 * Linear/Notion style full-screen modal that embeds an existing dashboard
 * page inside an iframe. The embedded page receives `?embed=1` and the
 * EmbedDetector adds `embed-mode` on <html> so the sidebar/topbar are
 * hidden, leaving only the form content.
 *
 * Embedded pages can dismiss the modal by posting:
 *   window.parent.postMessage({ type: "page-modal-close" }, "*")
 */
export function PageModal({ open, onOpenChange, title, src }: Props) {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e?.data) return;
      const t = (e.data as { type?: string }).type;
      if (t === "page-modal-close") onOpenChange(false);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onOpenChange]);

  if (!src) return null;
  const url = src.includes("?") ? `${src}&embed=1` : `${src}?embed=1`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[95vw] !w-[95vw] h-[92vh] p-0 overflow-hidden gap-0 sm:!max-w-[95vw]"
      >
        <VisuallyHidden>
          <DialogTitle>{title}</DialogTitle>
        </VisuallyHidden>
        <div className="flex h-12 items-center justify-between border-b border-border bg-secondary/40 px-4">
          <div className="text-sm font-semibold">{title}</div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
            aria-label="Bağla"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <iframe
          key={url}
          src={url}
          className="w-full"
          style={{ height: "calc(92vh - 48px)", border: 0 }}
          title={title}
        />
      </DialogContent>
    </Dialog>
  );
}
