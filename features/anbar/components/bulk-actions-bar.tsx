"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckSquare, Square, Trash2, Power, PowerOff, Tag, Layers, Printer, X, Percent, Wallet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { bulkUpdateProducts } from "../actions";

type Option = { id: number; ad: string };
type Mode = "kateqoriya" | "marka" | "qiymet_faiz" | "endirim_faiz" | "kritik_stok" | null;

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
  const [numericInput, setNumericInput] = useState("");

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
    startTransition(async () => {
      let input: Parameters<typeof bulkUpdateProducts>[0] | null = null;
      if (mode === "kateqoriya") {
        const id = Number(pickValue);
        if (!Number.isFinite(id) || id <= 0) return;
        input = { op: "kateqoriya", ids: selectedIds, kateqoriya_id: id };
      } else if (mode === "marka") {
        const id = Number(pickValue);
        if (!Number.isFinite(id) || id <= 0) return;
        input = { op: "marka", ids: selectedIds, marka_id: id };
      } else if (mode === "qiymet_faiz") {
        const pct = Number(numericInput);
        if (!Number.isFinite(pct) || pct < -50 || pct > 50) return;
        input = { op: "qiymet_faiz", ids: selectedIds, pct };
      } else if (mode === "endirim_faiz") {
        const pct = Number(numericInput);
        if (!Number.isFinite(pct) || pct < 0 || pct > 90) return;
        input = { op: "endirim_faiz", ids: selectedIds, pct };
      } else if (mode === "kritik_stok") {
        const n = Number(numericInput);
        if (!Number.isFinite(n) || n < 0) return;
        input = { op: "kritik_stok", ids: selectedIds, kritik_stok: n };
      }
      if (!input) return;
      const r = await bulkUpdateProducts(input);
      if (r.ok) {
        toast.success(`Yeniləndi (${r.data?.count ?? 0})`);
        setMode(null);
        setPickValue("");
        setNumericInput("");
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
          <Button size="sm" variant="ghost" onClick={() => setMode("qiymet_faiz")} disabled={pending}>
            <Wallet className="h-3.5 w-3.5" /> Qiymət ±%
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("endirim_faiz")} disabled={pending}>
            <Percent className="h-3.5 w-3.5" /> Endirim %
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("kritik_stok")} disabled={pending}>
            <AlertTriangle className="h-3.5 w-3.5" /> Kritik stok
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
              {mode === "kateqoriya" && "Kateqoriya dəyiş"}
              {mode === "marka" && "Marka dəyiş"}
              {mode === "qiymet_faiz" && "Qiymət ±% dəyiş"}
              {mode === "endirim_faiz" && "Endirim faizi təyin et"}
              {mode === "kritik_stok" && "Kritik stok təyin et"}
              {" — "}{selectedIds.length} məhsul
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(mode === "kateqoriya" || mode === "marka") && (
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
            )}
            {mode === "qiymet_faiz" && (
              <div className="space-y-1.5">
                <Label htmlFor="pct">Faiz (-50…+50). Misal: +10 = 10% artır, -15 = 15% azalt.</Label>
                <Input id="pct" type="number" min={-50} max={50} step={0.5} value={numericInput} onChange={(e) => setNumericInput(e.target.value)} placeholder="məs. 10" autoFocus />
                <p className="text-[10.5px] text-muted-foreground">Satış qiymətinə tətbiq olunur. Hesablama: satis_qiymeti × (1 + faiz/100), 2 onluq yuvarlama.</p>
              </div>
            )}
            {mode === "endirim_faiz" && (
              <div className="space-y-1.5">
                <Label htmlFor="endirim_pct">Endirim faizi (0…90)</Label>
                <Input id="endirim_pct" type="number" min={0} max={90} step={1} value={numericInput} onChange={(e) => setNumericInput(e.target.value)} placeholder="məs. 20" autoFocus />
                <p className="text-[10.5px] text-muted-foreground">endirimli_qiymet = satis_qiymeti × (1 − faiz/100).</p>
              </div>
            )}
            {mode === "kritik_stok" && (
              <div className="space-y-1.5">
                <Label htmlFor="krit">Kritik stok səviyyəsi (ədəd)</Label>
                <Input id="krit" type="number" min={0} step={1} value={numericInput} onChange={(e) => setNumericInput(e.target.value)} placeholder="məs. 5" autoFocus />
                <p className="text-[10.5px] text-muted-foreground">Bu səviyyədən aşağı düşəndə "kritik stok" xəbərdarlığı baş verir.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMode(null); setPickValue(""); setNumericInput(""); }}>Ləğv et</Button>
            <Button onClick={runChange} disabled={pending || ((mode === "kateqoriya" || mode === "marka") ? !pickValue : !numericInput)}>
              Tətbiq et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
