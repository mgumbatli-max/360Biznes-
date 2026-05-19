"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, XCircle, Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { bulkUpdateInventarRows, completeInventar, cancelInventar } from "../actions";

export type InventarLine = {
  id: number;
  mehsul_id: string;
  mehsul_ad: string;
  kod: string | null;
  barkod?: string | null;
  sistemde_olan: number;
  fakti_miqdar: number | null;
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

  const aktiv = status === "aktiv";

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

  function complete() {
    if (!window.confirm("Tamamlamaq stoku faktiki miqdara dəyişəcək. Davam edək?")) return;
    startFinalizing(async () => {
      const d = dirtyRows();
      if (d.length) await bulkUpdateInventarRows(d);
      const r = await completeInventar(inventarId);
      if (r.ok) {
        toast.success("İnventarlaşma tamamlandı");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
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
          {/* Barkod skaner — Enter ilə uyğun məhsulu tap və +1 et */}
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
          </div>
        </>
      )}

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm" data-sticky-head>
            <thead className="sticky top-0 border-b border-border/40 bg-secondary/60 backdrop-blur text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Məhsul</th>
                <th className="px-3 py-2 text-right">Sistemdə</th>
                <th className="px-3 py-2 text-right w-[140px]">Faktiki</th>
                <th className="px-3 py-2 text-right">Fərq</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">Sətir yoxdur</td></tr>
              )}
              {rows.map((r) => {
                const v = values[r.id];
                const fakti = v === "" ? null : Number(v);
                const ferq = fakti != null ? fakti - r.sistemde_olan : null;
                const cls = ferq == null ? "text-muted-foreground" : ferq > 0 ? "text-success" : ferq < 0 ? "text-danger" : "text-muted-foreground";
                return (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-secondary/30">
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
