"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckSquare, Square, Trash2, Power, PowerOff, Tag, Layers, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { bulkUpdateProducts } from "../actions";

type Option = { id: number; ad: string };
type Mode = "kateqoriya" | "marka" | null;

type Props = {
  selectedIds: string[];
  total: number;
  onClear: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
  categories: Option[];
  brands: Option[];
};

/**
 * Bulk operations toolbar — visible only when at least one product is
 * selected via the row checkbox. Renders a sticky bottom bar with delete,
 * activate, deactivate, change category, change brand and label print
 * actions. Uses bulkUpdateProducts() server action (tenant-scoped).
 */
export function BulkActionsBar({
  selectedIds,
  total,
  onClear,
  onSelectAll,
  allSelected,
  categories,
  brands,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [pickValue, setPickValue] = useState("");

  if (selectedIds.length === 0) return null;

  function run(op: "sil" | "aktiv" | "passiv") {
    const msg =
      op === "sil"
        ? `${selectedIds.length} məhsul deaktivləşdirilsin (silinsin)?`
        : op === "aktiv"
        ? `${selectedIds.length} məhsul aktiv edilsin?`
        : `${selectedIds.length} məhsul passiv edilsin?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await bulkUpdateProducts({ op, ids: selectedIds });
      if (r.ok) {
        toast.success(`Yeniləndi (${r.data?.count ?? 0})`);
        onClear();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function runChange() {
    if (!pickValue) return;
    const id = Number(pickValue);
    if (!Number.isFinite(id)) return;
    startTransition(async () => {
      const input =
        mode === "kateqoriya"
          ? { op: "kateqoriya" as const, ids: selectedIds, kateqoriya_id: id }
          : { op: "marka" as const, ids: selectedIds, marka_id: id };
      const r = await bulkUpdateProducts(input);
      if (r.ok) {
        toast.success(`Yeniləndi (${r.data?.count ?? 0})`);
        setMode(null);
        setPickValue("");
        onClear();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function printLabels() {
    const url = `/anbar/etiket-cap?ids=${selectedIds.join(",")}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? onClear : onSelectAll}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs font-medium"
            title={allSelected ? "Hamısını ləğv et" : "Bütün cədvəli seç"}
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            <span>
              <strong className="tabular-nums">{selectedIds.length}</strong>
              <span className="text-muted-foreground"> / {total}</span>
            </span>
          </button>

          <span className="h-4 w-px bg-border/60" />

          <Button size="sm" variant="ghost" onClick={() => run("aktiv")} disabled={pending}>
            <Power className="h-3.5 w-3.5" /> Aktiv et
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run("passiv")} disabled={pending}>
            <PowerOff className="h-3.5 w-3.5" /> Passiv et
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("kateqoriya")} disabled={pending}>
            <Layers className="h-3.5 w-3.5" /> Kateqoriya
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("marka")} disabled={pending}>
            <Tag className="h-3.5 w-3.5" /> Marka
          </Button>
          <Button size="sm" variant="ghost" onClick={printLabels} disabled={pending}>
            <Printer className="h-3.5 w-3.5" /> Etiket çap
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run("sil")} disabled={pending} className="text-danger hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" /> Sil
          </Button>

          <span className="h-4 w-px bg-border/60" />

          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            title="Seçimi ləğv et"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "kateqoriya" ? "Kateqoriya dəyiş" : "Marka dəyiş"} — {selectedIds.length} məhsul
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Combobox
              options={
                mode === "kateqoriya"
                  ? categories.map((c) => ({ value: String(c.id), label: c.ad }))
                  : brands.map((b) => ({ value: String(b.id), label: b.ad }))
              }
              value={pickValue}
              onChange={setPickValue}
              placeholder={mode === "kateqoriya" ? "Kateqoriya seçin..." : "Marka seçin..."}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Ləğv et</Button>
            <Button onClick={runChange} disabled={!pickValue || pending}>
              Tətbiq et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
