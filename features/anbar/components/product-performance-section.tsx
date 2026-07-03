import Link from "next/link";
import {
  TrendingUp, TrendingDown, RotateCcw, Calendar, Users, Layers, PiggyBank, ArrowRight,
  Monitor, Smartphone, Store, CreditCard, ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatNumber, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ProductPerformance } from "../performance-queries";

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pos: Monitor,
  marketplace: Store,
  manual: ShoppingCart,
  borc: CreditCard,
  online: Smartphone,
};

const CHANNEL_TONES: Record<string, string> = {
  pos: "bg-violet-500/15 text-violet-600",
  marketplace: "bg-orange-500/15 text-orange-600",
  manual: "bg-sky-500/15 text-sky-600",
  borc: "bg-amber-500/15 text-amber-600",
  online: "bg-emerald-500/15 text-emerald-600",
};

export function ProductPerformanceSection({ perf }: { perf: ProductPerformance }) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Performans
          <Badge variant="outline" className="ml-auto text-[10px]">son 30 gün</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini KPI grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniKpi
            icon={Calendar}
            label="Orta günlük satış"
            value={formatNumber(perf.orta_gunluk_satish, 2)}
            subline="vahid/gün"
            tone={perf.orta_gunluk_satish > 0 ? "info" : "neutral"}
          />
          <MiniKpi
            icon={Layers}
            label="Stok dövriyyə"
            value={perf.stok_dovriyye_gun > 0 ? `${perf.stok_dovriyye_gun} gün` : "—"}
            subline={
              perf.stok_dovriyye_gun > 0
                ? perf.stok_dovriyye_gun <= 7
                  ? "kritik: tezliklə bitir"
                  : perf.stok_dovriyye_gun <= 30
                    ? "qısa müddətli"
                    : "ehtiyatlıdır"
                : "satış yox"
            }
            tone={
              perf.stok_dovriyye_gun === 0
                ? "neutral"
                : perf.stok_dovriyye_gun <= 7
                  ? "danger"
                  : perf.stok_dovriyye_gun <= 30
                    ? "warning"
                    : "success"
            }
          />
          <MiniKpi
            icon={PiggyBank}
            label="Brüt marja"
            value={`${perf.brut_mar.toFixed(1)}%`}
            subline={formatMoney(perf.cemi_mar_azn) + " mənfəət"}
            tone={perf.brut_mar > 30 ? "success" : perf.brut_mar > 10 ? "info" : perf.brut_mar > 0 ? "warning" : "danger"}
          />
          <MiniKpi
            icon={RotateCcw}
            label="Qaytarma %"
            value={`${perf.qaytarma_pct.toFixed(1)}%`}
            subline={`${formatNumber(perf.qaytarma_qty, 0)} vahid qaytarıldı`}
            tone={perf.qaytarma_pct > 10 ? "danger" : perf.qaytarma_pct > 5 ? "warning" : "success"}
          />
        </div>

        {/* Top müştərilər və kanal bölgü — yan-yana */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Top müştərilər */}
          <div className="rounded-lg border border-border/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="h-3 w-3" /> Top 5 müştəri (12 ay)
            </div>
            {perf.top_customers.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Müştəri satışı yoxdur
              </div>
            ) : (
              <div className="space-y-1">
                {perf.top_customers.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/elaqe/musteriler/${c.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-secondary/30"
                  >
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.ad}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {c.sifaris_say} sifariş · {formatNumber(c.miqdar, 0)} vahid
                        {c.son_alis && (
                          <>
                            {" "}
                            · son: {formatDate(c.son_alis, { day: "2-digit", month: "short" })}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs font-mono font-semibold tabular-nums">
                      {formatMoney(c.mebleg)}
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Kanal bölgü */}
          <div className="rounded-lg border border-border/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              <Store className="h-3 w-3" /> Kanal bölgü (90 gün)
            </div>
            {perf.channels.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Kanal məlumatı yoxdur
              </div>
            ) : (
              <div className="space-y-2">
                {perf.channels.map((ch) => {
                  const Icon = CHANNEL_ICONS[ch.kanal] ?? ShoppingCart;
                  const tone = CHANNEL_TONES[ch.kanal] ?? "bg-secondary text-muted-foreground";
                  return (
                    <div key={ch.kanal} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={cn("grid h-6 w-6 place-items-center rounded-md", tone)}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <span className="font-medium">{ch.label}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatNumber(ch.qty, 0)} vahid · {formatMoney(ch.mebleg)}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums text-sm font-semibold">{ch.pct_qty.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary/50">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            ch.kanal === "pos" && "bg-violet-500",
                            ch.kanal === "marketplace" && "bg-orange-500",
                            ch.kanal === "manual" && "bg-sky-500",
                            ch.kanal === "borc" && "bg-amber-500",
                            ch.kanal === "online" && "bg-emerald-500",
                          )}
                          style={{ width: `${ch.pct_qty}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 12 aylıq trend mini chart */}
        {perf.aylar.length > 0 && (
          <div className="rounded-lg border border-border/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 12 aylıq trend</span>
              <span className="text-foreground/60">
                cəm: {formatNumber(perf.aylar.reduce((s, a) => s + a.qty, 0), 0)} vahid · {formatMoney(perf.aylar.reduce((s, a) => s + a.mebleg, 0))}
              </span>
            </div>
            <MonthlyTrendBars data={perf.aylar} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
  subline,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subline: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneCls =
    tone === "success" ? "border-emerald-500/40" :
    tone === "warning" ? "border-amber-500/40" :
    tone === "danger" ? "border-rose-500/40" :
    tone === "info" ? "border-sky-500/40" :
    "border-border/40";
  const iconCls =
    tone === "success" ? "text-emerald-600" :
    tone === "warning" ? "text-amber-600" :
    tone === "danger" ? "text-rose-600" :
    tone === "info" ? "text-sky-600" :
    "text-muted-foreground";
  return (
    <div className={cn("rounded-lg border bg-card/40 px-3 py-2", toneCls)}>
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3 w-3", iconCls)} /> {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10.5px] text-muted-foreground">{subline}</div>
    </div>
  );
}

function MonthlyTrendBars({ data }: { data: { ay: string; qty: number; mebleg: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.qty), 1);
  return (
    <div className="flex items-end gap-1">
      {data.map((d) => {
        const h = Math.max(4, (d.qty / max) * 60);
        const [y, m] = d.ay.split("-");
        return (
          <div key={d.ay} className="group relative flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-primary/60 transition group-hover:bg-primary"
              style={{ height: `${h}px` }}
              title={`${d.ay}: ${formatNumber(d.qty, 0)} vahid · ${formatMoney(d.mebleg)}`}
            />
            <div className="text-[9px] text-muted-foreground">
              {m}/{y.slice(2)}
            </div>
            <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background opacity-0 transition group-hover:opacity-100">
              {formatNumber(d.qty, 0)} · {formatMoney(d.mebleg)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
