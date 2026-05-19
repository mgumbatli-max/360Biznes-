"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Drilldown = {
  topProducts: { ad: string; satilan: number; gelir: number }[];
  topCustomers: { ad: string; orders: number; cemi: number }[];
  daily: { tarix: string; cemi: number; sayi: number }[];
};

export function PlatformDrilldownTrigger({
  platform,
  from,
  to,
  children,
}: {
  platform: string;
  from: string;
  to: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Drilldown | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) return;
    setErr(null);
    startTransition(async () => {
      try {
        const u = new URL("/api/hesabatlar/marketplace/drilldown", window.location.origin);
        u.searchParams.set("platform", platform);
        u.searchParams.set("from", from);
        u.searchParams.set("to", to);
        const res = await fetch(u.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error("Yüklənmədi");
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Xəta");
      }
    });
  }, [open, platform, from, to, data]);

  const fmt = (n: number) => new Intl.NumberFormat("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[10.5px] font-semibold hover:bg-secondary"
        data-platform-drilldown-trigger={platform}
      >
        <Search className="h-3 w-3" /> {children ?? "Detallar"}
      </button>
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="capitalize">{platform} — detallar</DialogTitle>
        </DialogHeader>
        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...
          </p>
        )}
        {err && <p className="text-sm text-danger">{err}</p>}
        {!pending && data && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Section title="Ən çox satılan məhsullar">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 text-left text-[10px] uppercase text-muted-foreground">
                  <tr><th className="px-2 py-1.5">Məhsul</th><th className="px-2 py-1.5 text-right">Sayı</th><th className="px-2 py-1.5 text-right">Gəlir</th></tr>
                </thead>
                <tbody>
                  {data.topProducts.length === 0
                    ? <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Məlumat yoxdur</td></tr>
                    : data.topProducts.map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-2 py-1.5 truncate max-w-[200px]" title={r.ad}>{r.ad}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.satilan.toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(r.gelir)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Section>
            <Section title="Top müştərilər">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 text-left text-[10px] uppercase text-muted-foreground">
                  <tr><th className="px-2 py-1.5">Müştəri</th><th className="px-2 py-1.5 text-right">Sifariş</th><th className="px-2 py-1.5 text-right">Cəmi</th></tr>
                </thead>
                <tbody>
                  {data.topCustomers.length === 0
                    ? <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Məlumat yoxdur</td></tr>
                    : data.topCustomers.map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-2 py-1.5 truncate max-w-[200px]" title={r.ad}>{r.ad}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.orders}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(r.cemi)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Section>
            <Section title="Günlük trend" className="md:col-span-2">
              <table className="w-full text-xs">
                <thead className="border-b border-border/60 text-left text-[10px] uppercase text-muted-foreground">
                  <tr><th className="px-2 py-1.5">Tarix</th><th className="px-2 py-1.5 text-right">Sifariş</th><th className="px-2 py-1.5 text-right">Cəmi</th></tr>
                </thead>
                <tbody>
                  {data.daily.length === 0
                    ? <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Məlumat yoxdur</td></tr>
                    : data.daily.map((r) => (
                      <tr key={r.tarix} className="border-b border-border/30">
                        <td className="px-2 py-1.5 font-mono">{r.tarix}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.sayi}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(r.cemi)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-border bg-card/40 ${className ?? ""}`}>
      <div className="border-b border-border/40 px-3 py-2 text-xs font-semibold">{title}</div>
      <div className="max-h-64 overflow-y-auto">{children}</div>
    </div>
  );
}
