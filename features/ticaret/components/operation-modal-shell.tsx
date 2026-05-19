"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for native (non-iframe) "Yeni əməliyyat" modals.
 *
 * Layout:
 *  ┌──────────────────────────────────────────┐
 *  │  Title                              ✕    │  ← header (h-12)
 *  ├──────────────────────────────────────────┤
 *  │                                          │
 *  │   children (scroll, max-h-[70vh])        │
 *  │                                          │
 *  ├──────────────────────────────────────────┤
 *  │ footerHints           cancel + actions   │  ← footer
 *  └──────────────────────────────────────────┘
 */
export function OperationModalShell({
  open,
  onOpenChange,
  title,
  size = "2xl",
  children,
  footerHints,
  actions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  size?: "xl" | "2xl" | "3xl";
  children: ReactNode;
  /** Keyboard / hint strip on the left of the footer. */
  footerHints?: ReactNode;
  /** Right-aligned action buttons (Ləğv / Tamamla / ...). */
  actions: ReactNode;
}) {
  const sizeCls =
    size === "xl"
      ? "sm:max-w-xl"
      : size === "3xl"
      ? "sm:max-w-3xl"
      : "sm:max-w-2xl";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "gap-0 overflow-hidden rounded-xl p-0",
          sizeCls,
        )}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <DialogTitle className="text-base font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Bağla"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">{children}</div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/40 px-4 py-2 text-[10.5px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {footerHints}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small `<kbd>` style helper used in modal footer hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1 py-px text-[10px] font-medium text-foreground">
      {children}
    </kbd>
  );
}
