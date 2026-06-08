"use client";

import { useState, useEffect, useTransition } from "react";
import { ListChecks, Loader2, Sparkles, Link2Off, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { autoMatchStatement, unmatchBankItem } from "../bank-reconcile-actions";

type StatementItem = {
  id: string | number;
  tarix: Date | string | null;
  meblegh: number;
  qarsi_teref: string | null;
  qeyd: string | null;
  status: string | null;
  matched_op_id?: string | null;
  match_confidence?: number | null;
};

export function BankItemsModal({ statementId, satirSayi }: { statementId: string; satirSayi: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StatementItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [matchPending, startMatchTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/maliyye/bank/${statementId}/items`, { cache: "no-store" });
        if (!res.ok) throw new Error("Sətirlər alınmadı");
        const json = await res.json();
        setItems(Array.isArray(json?.items) ? json.items : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Xəta");
      }
    });
  }, [open, statementId, refreshKey]);

  function onAutoMatch() {
    const numericId = Number(statementId);
    if (Number.isNaN(numericId)) {
      toast.error("Statement ID yanlışdır");
      return;
    }
    startMatchTransition(async () => {
      const r = await autoMatchStatement(numericId);
      if (r.ok) {
        toast.success(`Auto-match: ${r.data?.matched ?? 0} sətir bağlandı, ${r.data?.ambiguous ?? 0} ikili`);
        setRefreshKey((k) => k + 1);
      } else {
        toast.error(r.error);
      }
    });
  }

  function onUnmatch(itemId: string | number) {
    startMatchTransition(async () => {
      const r = await unmatchBankItem(Number(itemId));
      if (r.ok) {
        toast.success("Match ləğv edildi");
        setRefreshKey((k) => k + 1);
      } else {
        toast.error(r.error);
      }
    });
  }

  const unmatchedCount = items.filter((i) => i.status === "eslesmiyib" || !i.status).length;
  const matchedCount = items.filter((i) => i.status === "eslesdi").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-bank-items-trigger="1"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10.5px] font-semibold hover:bg-secondary"
        >
          <ListChecks className="h-3 w-3" /> Sətirlərə bax ({satirSayi})
        </button>
      </DialogTrigger>
      <DialogContent className="md:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Çıxarış sətirləri</span>
            {items.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-normal">
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-700">
                  Eşləşmiş: {matchedCount}
                </span>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-700">
                  Eşləşməmiş: {unmatchedCount}
                </span>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {unmatchedCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-50/60 p-2.5">
            <div className="text-xs text-sky-700">
              ⓘ Auto-match tarix ±3 gün və məbləğ ±1 qəpik uyğunluğu ilə bağlayır
            </div>
            <button
              type="button"
              onClick={onAutoMatch}
              disabled={matchPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {matchPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Auto-match çalışdır
            </button>
          </div>
        )}

        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {!pending && !error && (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card/40">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border/60 bg-card text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Tarix</th>
                  <th className="px-3 py-2">Qarşı tərəf</th>
                  <th className="px-3 py-2">Qeyd</th>
                  <th className="px-3 py-2 text-right">Məbləğ</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Əməl</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Sətir tapılmadı
                    </td>
                  </tr>
                ) : (
                  items.map((r) => {
                    const matched = r.status === "eslesdi";
                    return (
                      <tr key={r.id} className={`border-b border-border/30 ${matched ? "bg-emerald-50/30" : ""}`}>
                        <td className="px-3 py-2 text-xs">{r.tarix ? new Date(r.tarix).toLocaleDateString("az-AZ") : "—"}</td>
                        <td className="px-3 py-2 text-xs">{r.qarsi_teref ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground line-clamp-1">{r.qeyd ?? "—"}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.meblegh >= 0 ? "text-success" : "text-danger"}`}>
                          {r.meblegh.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {matched ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Eşləşdi{r.match_confidence ? ` (${r.match_confidence}%)` : ""}
                            </span>
                          ) : (
                            <span className="rounded-md border border-amber-500/30 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                              Eşləşməmiş
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {matched && (
                            <button
                              type="button"
                              onClick={() => onUnmatch(r.id)}
                              disabled={matchPending}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                            >
                              <Link2Off className="h-2.5 w-2.5" /> Ləğv
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
