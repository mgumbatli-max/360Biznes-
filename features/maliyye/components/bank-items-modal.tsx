"use client";

import { useState, useEffect, useTransition } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type StatementItem = {
  id: string;
  tarix: Date | string | null;
  meblegh: number;
  qarsi_teref: string | null;
  qeyd: string | null;
  status: string | null;
};

export function BankItemsModal({ statementId, satirSayi }: { statementId: string; satirSayi: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StatementItem[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items.length > 0) return;
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
  }, [open, statementId, items.length]);

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
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Çıxarış sətirləri</DialogTitle>
        </DialogHeader>
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
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      Sətir tapılmadı
                    </td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="px-3 py-2 text-xs">{r.tarix ? new Date(r.tarix).toLocaleDateString("az-AZ") : "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.qarsi_teref ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground line-clamp-1">{r.qeyd ?? "—"}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.meblegh >= 0 ? "text-success" : "text-danger"}`}>
                        {r.meblegh.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="rounded-md border border-border bg-secondary/30 px-1.5 py-0.5 text-[10px]">{r.status ?? "—"}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
