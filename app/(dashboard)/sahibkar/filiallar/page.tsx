import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ArrowRight, TrendingUp, Users, Crown, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerBranches } from "@/features/sahibkar/owner-queries";
import { BranchDialog } from "@/features/sahibkar/components/branch-dialog";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Filiallar" };
export const dynamic = "force-dynamic";

export default async function SahibkarFiliallarPage() {
  await requireSahibkarSession();
  const rows = await getOwnerBranches();

  // Yığma KPI-lar
  const totalSales = rows.reduce((a, b) => a + b.month_sales, 0);
  const totalIsci = rows.reduce((a, b) => a + b.isci_count, 0);
  const totalOrders = rows.reduce((a, b) => a + b.month_orders, 0);
  const topPerformer = [...rows].sort((a, b) => b.month_sales - a.month_sales)[0];
  const sortedBySales = [...rows].sort((a, b) => b.month_sales - a.month_sales);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Filiallar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Şəbəkəni idarə et və performansı izlə.</p>
        </div>
        <BranchDialog />
      </header>

      <SectionExplainer
        icon={Building2}
        title="Filial idarəçiliyi"
        tone="emerald"
        description="Hər filialın bu ay satışı, sifariş sayı, işçi sayı və cavabdeh izlənir. Filialları yan-yana müqayisə etmək üçün /sahibkar/filial-muqayise bölməsindən istifadə edin."
        bullets={[
          { label: "Lider", text: topPerformer?.ad ?? "—" },
          { label: "Cəmi", text: `${formatNumber(rows.length, 0)} aktiv filial` },
        ]}
      />

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiPill icon={Building2} label="Aktiv filial" value={formatNumber(rows.length, 0)} tone="emerald" />
          <KpiPill icon={TrendingUp} label="Bu ay satış" value={formatMoney(totalSales)} tone="sky" />
          <KpiPill icon={Users} label="Cəmi işçi" value={formatNumber(totalIsci, 0)} tone="violet" />
          <KpiPill icon={Activity} label="Sifariş sayı" value={formatNumber(totalOrders, 0)} tone="amber" />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Filial yoxdur</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sortedBySales.map((b, idx) => {
            const isTop = idx === 0 && b.month_sales > 0;
            const sharePct = totalSales > 0 ? (b.month_sales / totalSales) * 100 : 0;
            return (
              <Card key={b.id} className={`glass relative overflow-hidden ${isTop ? "border-amber-500/40" : ""}`}>
                {isTop && (
                  <div className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <Crown className="h-2.5 w-2.5" /> Lider
                  </div>
                )}
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2 pr-12">
                    <div>
                      <div className="font-semibold">{b.ad}</div>
                      <div className="text-xs text-muted-foreground">{b.seh_r ?? "—"} {b.unvan ? `· ${b.unvan}` : ""}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{b.tip ?? "magaza"}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Bu ay satış</span>
                    <span className="font-semibold tabular-nums">{formatMoney(b.month_sales)}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.min(100, sharePct)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                    <span>{sharePct.toFixed(1)}% şəbəkə payı</span>
                    <span>{b.isci_count} işçi · {b.month_orders} sifariş</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-muted-foreground">{b.cavabdeh_ad ?? "Cavabdeh yox"}</span>
                    <Link href={`/sahibkar/filiallar/${b.id}`} className="inline-flex items-center gap-1 text-primary-light">
                      Detal <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiPill({ icon: Icon, label, value, tone }: { icon: typeof Building2; label: string; value: string; tone: "emerald" | "sky" | "violet" | "amber" }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className={`rounded-md border px-3 py-2 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}
