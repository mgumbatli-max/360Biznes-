import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, ArrowRight, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerHesabatSummary } from "@/features/sahibkar/owner-queries";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Sahibkar hesabatı" };
export const dynamic = "force-dynamic";

export default async function SahibkarHesabatPage() {
  await requireSahibkarSession();
  const s = await getOwnerHesabatSummary();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sahibkar hesabatı</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aylıq, rüblük və illik xülasə + il-üstü il artımı.</p>
      </header>

      <SectionExplainer
        icon={BarChart3}
        title="Bu hesabat nəyə yarayır?"
        tone="indigo"
        description="Tam sahibkar görünüşü — biznesin müxtəlif zaman dilimlərində nə qədər gəlir etdiyi, sifariş sayı və il-üstü il (YoY) artımı. Strateji qərarlar üçün baza."
        bullets={[
          { label: "Ay", text: "cari ay vs keçən ay" },
          { label: "Rüb", text: "3 aylıq trend" },
          { label: "İl", text: "tam il + YoY %" },
        ]}
      />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SumCard title="Bu ay" revenue={s.month.revenue} orders={s.month.orders} />
        <SumCard title="Bu rüb" revenue={s.quarter.revenue} orders={s.quarter.orders} />
        <SumCard title="Bu il" revenue={s.year.revenue} orders={s.year.orders} trend={s.yoy_growth_pct} />
      </section>

      <Card className="glass">
        <CardContent className="py-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary-light" />
            <h3 className="text-sm font-semibold">Detallı hesabatlar</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <SubLink href="/hesabatlar/satis" label="Satış" />
            <SubLink href="/hesabatlar/stok" label="Stok" />
            <SubLink href="/hesabatlar/musteri" label="Müştəri" />
            <SubLink href="/hesabatlar/maliyye" label="Maliyyə" />
            <SubLink href="/hesabatlar/emekdas" label="Əməkdaş" />
            <SubLink href="/hesabatlar/pul" label="Pul axını" />
            <SubLink href="/hesabatlar/marja" label="Marja" />
            <SubLink href="/hesabatlar/mehsul" label="Məhsul" />
            <SubLink href="/hesabatlar/marketplace" label="Marketplace" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SumCard({ title, revenue, orders, trend }: { title: string; revenue: number; orders: number; trend?: number }) {
  return (
    <Card className="glass">
      <CardContent className="space-y-1.5 py-4">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold tabular-nums">{formatMoney(revenue)}</div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatNumber(orders)} sifariş</span>
          {trend !== undefined ? (
            <Badge variant="outline" className={trend >= 0 ? "text-success" : "text-danger"}>
              <TrendingUp className="h-3 w-3" /> {trend.toFixed(1)}% YoY
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SubLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm transition hover:border-primary/30">
      {label} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
