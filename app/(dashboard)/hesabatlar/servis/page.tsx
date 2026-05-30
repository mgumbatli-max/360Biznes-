import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Wrench, CircleDollarSign, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { thisMonthRange } from "@/features/hesabatlar/shared";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Servis hesabatı" };

async function getServisOverview() {
  return withTenant(async () => {
    const range = thisMonthRange();
    const [total, monthAgg, byStatus] = await Promise.all([
      prisma.servis_qeydleri.count(),
      prisma.servis_qeydleri.aggregate({
        where: { yaradildi: { gte: range.from } },
        _sum: { musteriden_alinan: true, temir_xerci: true },
        _count: { _all: true },
      }),
      prisma.servis_qeydleri.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return {
      total,
      month_count: monthAgg._count._all,
      month_rev: Number(monthAgg._sum.musteriden_alinan ?? 0),
      month_cost: Number(monthAgg._sum.temir_xerci ?? 0),
      by_status: byStatus.map((s) => ({ status: s.status ?? "—", count: s._count._all })),
    };
  });
}

export default async function ServisHubPage() {
  const data = await getServisOverview();
  const profit = data.month_rev - data.month_cost;
  const openStatuses = ["qebul_edildi", "diaqnostika", "temirde", "hisse_gozleyir"];
  const open = data.by_status.filter((s) => openStatuses.includes(s.status)).reduce((s, x) => s + x.count, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Servis hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bu ayın xülasəsi. Geniş hesabat üçün aşağıdakı linkdən istifadə edin.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Wrench} label="Cəm sifariş" value={String(data.total)} subline={`${data.month_count} bu ay`} />
        <KpiCard icon={CircleDollarSign} label="Bu ay gəlir" value={formatMoney(data.month_rev)} tone="success" />
        <KpiCard icon={CheckCircle2} label="Mənfəət" value={formatMoney(profit)} subline={`Xərc: ${formatMoney(data.month_cost)}`} tone={profit >= 0 ? "success" : "danger"} />
        <KpiCard icon={Clock} label="Açıq sifariş" value={String(open)} subline="Davam edən" tone={open > 0 ? "warning" : "neutral"} />
      </section>

      <Card className="glass">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {data.by_status.map((s) => (
              <div key={s.status} className="rounded-md border border-border bg-secondary/30 p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground capitalize">
                  {s.status.replace(/_/g, " ")}
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums">{s.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Link href="/servis/hesabat">
        <Card className="glass transition hover:border-primary/30">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Geniş servis hesabatı</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Texniki performans, defekt analizi, qayıdan müştərilər və 6 aylıq trend.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary-light" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
