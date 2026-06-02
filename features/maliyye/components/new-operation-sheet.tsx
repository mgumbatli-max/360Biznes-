"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { OperationForm } from "./operation-form";
import { OpPickerDialog } from "./op-picker-dialog";

type EntityOpt = { id: string; ad: string };

type Props = {
  hesablar: EntityOpt[];
  iscilier: EntityOpt[];
  kontragentler: EntityOpt[];
  triggerLabel?: string;
  triggerClassName?: string;
  /** External control of the picker dialog (lets parent reuse it without rendering its own trigger). */
  initialOpen?: boolean;
  /** Trigger düyməsini gizlədir — yalnız event/URL ilə açıla bilər (subnav-dakı düymə üçün). */
  hideTrigger?: boolean;
};

/**
 * Wraps the existing OperationForm in a right-side Sheet so "Yeni əməliyyat"
 * opens as an overlay drawer inside the same window — no navigation.
 *
 * Flow: trigger button → OpPickerDialog (pick op type) → Sheet (full form).
 */
export function NewOperationSheet({
  hesablar,
  iscilier,
  kontragentler,
  triggerLabel = "Yeni əməliyyat",
  triggerClassName,
  hideTrigger = false,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tip, setTip] = useState<string>("qaime");

  // Listen for a window event so other parts of the app can launch this
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ tip?: string }>;
      if (ce.detail?.tip) {
        setTip(ce.detail.tip);
        setSheetOpen(true);
      } else {
        setPickerOpen(true);
      }
    };
    window.addEventListener("maliyye:new-op", handler);
    return () => window.removeEventListener("maliyye:new-op", handler);
  }, []);

  // Auto-open when arriving with ?yeni=open (e.g. from a sub-page subnav button).
  // setState in effect is intentional — one-shot transition triggered by URL state.
  useEffect(() => {
    if (sp.get("yeni") === "open" && !pickerOpen && !sheetOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPickerOpen(true);
      // Strip the query so the dialog doesn't reopen on every refresh
      const next = new URLSearchParams(sp.toString());
      next.delete("yeni");
      const url = next.toString() ? `?${next.toString()}` : "/maliyye";
      router.replace(url, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const onPick = (kod: string) => {
    setPickerOpen(false);
    setTip(kod);
    setSheetOpen(true);
  };

  const closeAfterSave = () => {
    setSheetOpen(false);
    router.refresh();
  };

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={
            triggerClassName ??
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm hover:shadow"
          }
          style={!triggerClassName ? { background: "var(--brand-gradient)" } : undefined}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{triggerLabel}</span>
        </button>
      )}

      {/* Step 1: type picker — uses existing dialog but intercepts the choice */}
      <OpPickerOverlay open={pickerOpen} onOpenChange={setPickerOpen} onPick={onPick} />

      {/* Step 2: form sheet (slide-over from right) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-2 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
            <SheetTitle className="text-base">Yeni əməliyyat</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="p-5">
            <OperationForm
              initialTip={tip}
              hesablar={hesablar}
              iscilier={iscilier}
              kontragentler={kontragentler}
              onSaved={closeAfterSave}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Local wrapper that uses the existing OpPickerDialog but supplies a custom
 * pick handler — instead of navigating, it opens the form sheet.
 */
function OpPickerOverlay({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (kod: string) => void;
}) {
  // We render the OpPickerDialog but intercept its router push by listening
  // to a custom click on data-pick buttons. Simpler: re-use the OpPickerDialog
  // and overlay a click handler via window event.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("[data-op-pick]") as HTMLElement | null;
      if (!target) return;
      const kod = target.getAttribute("data-op-pick");
      if (!kod) return;
      e.preventDefault();
      e.stopPropagation();
      onPick(kod);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [open, onPick]);

  return <OpPickerDialog open={open} onOpenChange={onOpenChange} />;
}
