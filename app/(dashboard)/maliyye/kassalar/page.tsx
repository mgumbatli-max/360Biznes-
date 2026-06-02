import type { Metadata } from "next";
import Link from "next/link";
import { Coins, TrendingUp, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { KassalarTable } from "@/features/maliyye/components/kassalar-table";
import { getKassalar, getKassaStats } from "@/features/maliyye/kassa-queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Kassalar" };

export default async function KassalarPage() {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("kassa.oxu");

  const [rows, stats] = await Promise.all([getKassalar(), getKassaStats()]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kassalar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Açıq və bağlı kassa sessiyaları, gündəlik dövriyyə.</p>
        </div>
        <Button asChild size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Link href="/pos" target="_blank" rel="noopener">
            <Coins className="h-4 w-4" /> POS-da kassa aç
          </Link>
        </Button>
      </header>

      <MaliyyeSubNav active="/maliyye/kassalar" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Clock} label="Açıq kassalar" value={String(stats.acig)} subline="Aktiv sessiyalar" tone={stats.acig > 0 ? "success" : "neutral"} />
        <KpiCard icon={CheckCircle2} label="Bağlanmış" value={String(stats.bagli)} subline="Tarixçə" />
        <KpiCard icon={TrendingUp} label="Bugün dövriyyə" value={formatMoney(stats.bugun_dovriyye)} subline={`${stats.bugun_say} əməliyyat`} tone="success" />
        <KpiCard icon={TrendingUp} label="Bu ay dövriyyə" value={formatMoney(stats.bu_ay_dovriyye)} subline={`${stats.bu_ay_say} əməliyyat`} />
      </section>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Coins className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Kassa açılmayıb</h3>
          <p className="mt-1 text-sm text-muted-foreground">POS-da kassa açın və ya yeni sessiya yaradın.</p>
        </div>
      ) : (
        <>
        <KassalarTable items={rows} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((k) => {
            const isOpen = k.status === "acig";
            return (
              <Card key={k.id} className={`glass ${!isOpen && "opacity-80"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{k.ad}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {k.filial_ad && <span>{k.filial_ad}</span>}
                        <span>·</span>
                        <span>{k.acan_ad}</span>
                      </div>
                    </div>
                    {isOpen ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Açıq</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted text-muted-foreground">Bağlı</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Açılış</span>
                    <span>{k.acilis_tarixi ? formatDate(k.acilis_tarixi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Açılış qaliği</span>
                    <span className="tabular-nums">{formatMoney(k.acilis_qaligi)}</span>
                  </div>
                  {!isOpen && (
                    <>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Bağlanış</span>
                        <span>{k.baglanis_tarixi ? formatDate(k.baglanis_tarixi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gözlənilən</span>
                        <span className="tabular-nums">{k.hesablanan_qaliq != null ? formatMoney(k.hesablanan_qaliq) : "—"}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Faktiki sayım</span>
                        <span className="tabular-nums">{k.baglanis_qaligi != null ? formatMoney(k.baglanis_qaligi) : "—"}</span>
                      </div>
                      {k.fark != null && (
                        <div className={`flex justify-between border-t border-border/40 pt-2 font-semibold ${k.fark === 0 ? "text-success" : Math.abs(k.fark) < 1 ? "" : "text-danger"}`}>
                          <span>Fərq</span>
                          <span className="tabular-nums">{k.fark > 0 ? "+" : ""}{formatMoney(k.fark)}</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
