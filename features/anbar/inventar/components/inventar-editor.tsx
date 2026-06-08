"use client";

import { useRef, useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, XCircle, Loader2, ScanBarcode, AlertTriangle, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber, cn } from "@/lib/utils";
import { BarcodeScannerButton } from "@/components/ui/barcode-scanner";
import {
  bulkUpdateInventarRows,
  completeInventar,
  cancelInventar,
  setInventarRowReasons,
} from "../actions";
import {
  VARIANCE_REASONS,
  parseVarianceQeyd,
  reasonMeta,
  type VarianceReason,
} from "../variance-reasons";

export type InventarLine = {
  id: number;
  mehsul_id: string;
  mehsul_ad: string;
  kod: string | null;
  barkod?: string | null;
  sistemde_olan: number;
  fakti_miqdar: number | null;
  qeyd?: string | null;
  qiymet?: number;
};

export function InventarEditor({ inventarId, rows, status }: { inventarId: string; rows: InventarLine[]; status: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    rows.forEach((r) => {
      init[r.id] = r.fakti_miqdar != null ? String(r.fakti_miqdar) : "";
    });
    return init;
  });
  const [saving, startSaving] = useTransition();
  const [finalizing, startFinalizing] = useTransition();
  const [cancelling, startCancelling] = useTransition();
  const [scan, setScan] = useState("");
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [viewFilter, setViewFilter] = useState<"all" | "variance" | "uncounted">("all");

  const aktiv = status === "aktiv";

  const counts = useMemo(() => {
    let counted = 0;
    let variance = 0;
    rows.forEach((r) => {
      const v = values[r.id];
      const fakti = v === "" ? r.fakti_miqdar : Number(v);
      if (fakti != null && !Number.isNaN(fakti)) counted++;
      if (fakti != null && !Number.isNaN(fakti) && fakti !== r.sistemde_olan) variance++;
    });
    return { counted, variance, total: rows.length, uncounted: rows.length - counted };
  }, [rows, values]);

  const visibleRows = useMemo(() => {
    if (viewFilter === "all") return rows;
    return rows.filter((r) => {
      const v = values[r.id];
      const fakti = v === "" ? r.fakti_miqdar : Number(v);
      if (viewFilter === "uncounted") return fakti == null || Number.isNaN(fakti);
      if (viewFilter === "variance") {
        if (fakti == null || Number.isNaN(fakti)) return false;
        return fakti !== r.sistemde_olan;
      }
      return true;
    });
  }, [rows, values, viewFilter]);

  /**
   * Barkod scan: barkod skaner adətən Enter ilə bitirir.
   * 1) Barkod və ya kod uyğun gələn sətiri tap
   * 2) İnputuna fokuslan və 1 vahid artır (kumulyativ sayım)
   */
  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = scan.trim();
    if (!q) return;
    const found = rows.find((r) =>
      (r.barkod ?? "").toLowerCase() === q.toLowerCase() ||
      (r.kod ?? "").toLowerCase() === q.toLowerCase(),
    );
    if (!found) {
      toast.error(`"${q}" cədvəldə tapılmadı`);
      setScan("");
      return;
    }
    const cur = Number(values[found.id] || 0);
    const next = (Number.isNaN(cur) ? 0 : cur) + 1;
    setValues((p) => ({ ...p, [found.id]: String(next) }));
    setScan("");
    setTimeout(() => {
      inputRefs.current[found.id]?.focus();
      inputRefs.current[found.id]?.select();
    }, 30);
  }

  /** Kameradan barkod aşkarlandı — onScan eyni məntiqi tətbiq et. */
  function onCameraBarcode(code: string) {
    const found = rows.find((r) =>
      (r.barkod ?? "").toLowerCase() === code.toLowerCase() ||
      (r.kod ?? "").toLowerCase() === code.toLowerCase(),
    );
    if (!found) {
      toast.error(`"${code}" cədvəldə tapılmadı`);
      return;
    }
    const cur = Number(values[found.id] || 0);
    const next = (Number.isNaN(cur) ? 0 : cur) + 1;
    setValues((p) => ({ ...p, [found.id]: String(next) }));
    toast.success(`+1: ${found.mehsul_ad} (cəmi ${next})`);
  }

  function dirtyRows() {
    return rows
      .filter((r) => {
        const v = values[r.id];
        if (v === "") return r.fakti_miqdar != null;
        return Number(v) !== r.fakti_miqdar;
      })
      .map((r) => ({ satir_id: r.id, fakti_miqdar: Number(values[r.id] || 0) }));
  }

  function save() {
    const d = dirtyRows();
    if (d.length === 0) {
      toast.info("Dəyişiklik yoxdur");
      return;
    }
    startSaving(async () => {
      const r = await bulkUpdateInventarRows(d);
      if (r.ok) {
        toast.success(`${d.length} sətir yadda saxlandı`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Səbəb modalı state
  const [reasonModal, setReasonModal] = useState<null | { rows: InventarLine[] }>(null);

  // Fərqi olan və hələ səbəbi olmayan sətrlər
  const varianceWithoutReason = useMemo(() => {
    return rows.filter((r) => {
      const v = values[r.id];
      const fakti = v === "" ? r.fakti_miqdar : Number(v);
      if (fakti == null) return false;
      if (fakti === r.sistemde_olan) return false;
      const { sebeb } = parseVarianceQeyd(r.qeyd ?? null);
      return !sebeb;
    });
  }, [rows, values]);

  async function performComplete() {
    const d = dirtyRows();
    if (d.length) await bulkUpdateInventarRows(d);
    const r = await completeInventar(inventarId);
    if (r.ok) {
      toast.success("İnventarlaşma tamamlandı");
      router.refresh();
    } else {
      toast.error(r.error);
      // Səbəbsiz fərqlər tapıldı → modal aç
      if (r.missingReasonCount && r.missingReasonCount > 0) {
        setReasonModal({ rows: varianceWithoutReason });
      }
    }
  }

  function complete() {
    // Əvvəlcə yaddaşda olanları saxla — sonra səbəb yoxla
    if (varianceWithoutReason.length > 0) {
      setReasonModal({ rows: varianceWithoutReason });
      return;
    }
    if (!window.confirm("Tamamlamaq stoku faktiki miqdara dəyişəcək. Davam edək?")) return;
    startFinalizing(performComplete);
  }

  function cancel() {
    if (!window.confirm("İnventarlaşmanı ləğv etməyə əminsiniz?")) return;
    startCancelling(async () => {
      const r = await cancelInventar(inventarId);
      if (r.ok) {
        toast.success("Ləğv edildi");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {aktiv && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} variant="outline">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Saxla
            </Button>
            <Button onClick={complete} disabled={finalizing} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Tamamla və stok düzəlt
            </Button>
            <Button onClick={cancel} disabled={cancelling} variant="destructive" className="ml-auto">
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Ləğv et
            </Button>
          </div>
          {/* Barkod skaner — Enter ilə uyğun məhsulu tap və +1 et + mobil kamera */}
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <ScanBarcode className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-primary">Barkod skaner</div>
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={onScan}
                placeholder="Barkodu skanla və ya yaz (Enter ilə əlavə et) — hər skan +1"
                className="mt-0.5 h-7 w-full rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
            </div>
            <BarcodeScannerButton
              onDetected={onCameraBarcode}
              continuous
              trigger={
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                  title="Telefon/tablet kamerası ilə skanla"
                >
                  <Camera className="h-4 w-4" />
                </button>
              }
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold tabular-nums">{counts.counted}</span>
          <span className="text-muted-foreground">/ {counts.total} sayıldı</span>
        </div>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${counts.total ? (counts.counted / counts.total) * 100 : 0}%` }}
          />
        </div>
        {counts.variance > 0 && (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
            {counts.variance} fərq
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {[
            { v: "all" as const, l: `Hamısı (${counts.total})` },
            { v: "variance" as const, l: `Fərqlər (${counts.variance})` },
            { v: "uncounted" as const, l: `Sayılmayan (${counts.uncounted})` },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setViewFilter(o.v)}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium transition",
                viewFilter === o.v
                  ? "border-primary/40 bg-primary/15 text-primary-light"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm" data-sticky-head>
            <thead className="sticky top-0 border-b border-border/40 bg-secondary/60 backdrop-blur text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Məhsul</th>
                <th className="px-3 py-2 text-right">Sistemdə</th>
                <th className="px-3 py-2 text-right w-[140px]">Faktiki</th>
                <th className="px-3 py-2 text-right">Fərq</th>
                <th className="px-3 py-2">Səbəb</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "Sətir yoxdur" : "Bu filterə uyğun sətir yoxdur"}
                </td></tr>
              )}
              {visibleRows.map((r) => {
                const v = values[r.id];
                const fakti = v === "" ? null : Number(v);
                const ferq = fakti != null ? fakti - r.sistemde_olan : null;
                const cls = ferq == null ? "text-muted-foreground" : ferq > 0 ? "text-success" : ferq < 0 ? "text-danger" : "text-muted-foreground";
                const { sebeb } = parseVarianceQeyd(r.qeyd ?? null);
                const meta = reasonMeta(sebeb);
                const showReason = ferq != null && ferq !== 0;
                return (
                  <tr key={r.id} className={cn(
                    "border-b border-border/20 hover:bg-secondary/30",
                    showReason && !meta && "bg-rose-500/[0.04]",
                  )}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.mehsul_ad}</div>
                      {r.kod && <div className="text-[10.5px] font-mono text-muted-foreground">{r.kod}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.sistemde_olan, 2)}</td>
                    <td className="px-3 py-2 text-right">
                      {aktiv ? (
                        <input
                          ref={(el) => { inputRefs.current[r.id] = el; }}
                          type="number"
                          step="0.01"
                          min={0}
                          value={values[r.id] ?? ""}
                          onChange={(e) => setValues((p) => ({ ...p, [r.id]: e.target.value }))}
                          placeholder="?"
                          className="h-7 w-full max-w-[110px] rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums ml-auto"
                        />
                      ) : (
                        <span className="tabular-nums">{r.fakti_miqdar != null ? formatNumber(r.fakti_miqdar, 2) : "—"}</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${cls}`}>
                      {ferq != null ? (ferq > 0 ? "+" : "") + formatNumber(ferq, 2) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {!showReason ? (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      ) : meta ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            meta.tone === "danger" && "border-rose-500/40 bg-rose-500/10 text-rose-600",
                            meta.tone === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-600",
                            meta.tone === "info" && "border-sky-500/40 bg-sky-500/10 text-sky-600",
                            meta.tone === "success" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
                          )}
                        >
                          {meta.label}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-500/60 bg-rose-500/15 text-[10px] font-bold text-rose-700">
                          <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                          Səbəb tələb olunur
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {reasonModal && (
        <ReasonModal
          rows={reasonModal.rows}
          values={values}
          onClose={() => setReasonModal(null)}
          onSaved={async () => {
            setReasonModal(null);
            if (!window.confirm("Tamamlamaq stoku faktiki miqdara dəyişəcək. Davam edək?")) return;
            startFinalizing(performComplete);
          }}
        />
      )}
    </div>
  );
}

function ReasonModal({
  rows,
  values,
  onClose,
  onSaved,
}: {
  rows: InventarLine[];
  values: Record<number, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reasons, setReasons] = useState<Record<number, { sebeb: VarianceReason | ""; aciqlama: string }>>(() => {
    const init: Record<number, { sebeb: VarianceReason | ""; aciqlama: string }> = {};
    rows.forEach((r) => (init[r.id] = { sebeb: "", aciqlama: "" }));
    return init;
  });
  const [pending, startTransition] = useTransition();

  const allFilled = rows.every((r) => reasons[r.id]?.sebeb);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allFilled) {
      toast.error("Hər sətrə səbəb seçilməlidir");
      return;
    }
    startTransition(async () => {
      const payload = rows.map((r) => ({
        satir_id: r.id,
        sebeb: reasons[r.id].sebeb || null,
        aciqlama: reasons[r.id].aciqlama,
      }));
      const r = await setInventarRowReasons(payload);
      if (r.ok) {
        toast.success(`${payload.length} sətir üçün səbəb yazıldı`);
        onSaved();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Fərq səbəblərini göstərin
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">{rows.length} məhsulda fərq tapıldı.</strong>{" "}
            Hər biri üçün səbəb göstərməlisiniz — bu məlumat maliyyə hesabatına (sayım zərəri) keçəcək və auditdə qalacaq.
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {rows.map((r) => {
              const v = values[r.id];
              const fakti = v === "" ? null : Number(v);
              const ferq = fakti != null ? fakti - r.sistemde_olan : null;
              const current = reasons[r.id] ?? { sebeb: "" as const, aciqlama: "" };
              return (
                <div key={r.id} className="rounded-md border border-border/40 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{r.mehsul_ad}</div>
                      {r.kod && <div className="text-[10.5px] font-mono text-muted-foreground">{r.kod}</div>}
                    </div>
                    <div className={cn(
                      "shrink-0 font-mono text-sm font-bold tabular-nums",
                      ferq != null && ferq < 0 && "text-rose-500",
                      ferq != null && ferq > 0 && "text-emerald-500",
                    )}>
                      {ferq != null ? (ferq > 0 ? "+" : "") + formatNumber(ferq, 2) : "—"}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={current.sebeb}
                      onChange={(e) =>
                        setReasons((p) => ({ ...p, [r.id]: { ...current, sebeb: e.target.value as VarianceReason | "" } }))
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">— Səbəb seç —</option>
                      {VARIANCE_REASONS
                        .filter((opt) => ferq == null || (ferq > 0 ? opt.value === "muveffeqiyyetli_artim" || opt.value === "manual" || opt.value === "diger" || opt.value === "sistem_sehv" : opt.value !== "muveffeqiyyetli_artim"))
                        .map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Əlavə açıqlama (opsional)"
                      value={current.aciqlama}
                      onChange={(e) =>
                        setReasons((p) => ({ ...p, [r.id]: { ...current, aciqlama: e.target.value } }))
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Ləğv et
            </Button>
            <Button type="submit" disabled={!allFilled || pending}>
              {pending ? "Yazılır..." : "Səbəbləri saxla və tamamla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
