import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, TrendingDown, AlertTriangle, ShoppingCart, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { ProductInline } from "@/features/anbar/components/product-inline";
import { AutoOrderButton } from "@/features/satinalma/components/auto-order-button";
import { RecomputeButton } from "@/features/satinalma/components/recompute-button";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Satınalma Planlama" };

async function getRecommendations(f: { techizatci?: string; kritiklik?: string; kateqoriya?: string; xeber?: string } = {}) {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (f.techizatci) {
      where.techizatci_id = f.techizatci;
    }
    if (f.kateqoriya) {
      const kid = Number(f.kateqoriya);
      if (!Number.isNaN(kid)) where.mehsullar = { kateqoriya_id: kid };
    }
    if (f.kritiklik === "kritik") where.bitme_gun = { lte: 7 };
    else if (f.kritiklik === "xeber") where.bitme_gun = { lte: 14, gt: 7 };
    else if (f.kritiklik === "normal") where.bitme_gun = { gt: 14 };
    if (f.xeber === "1") where.alis_yaradildi = false;

    const rows = await prisma.satinalma_tovsiye.findMany({
      where,
      orderBy: { bitme_gun: "asc" },
      take: 100,
      include: {
        mehsullar: { select: { id: true, ad: true, kod: true, barkod: true, min_stok: true } },
        kontragentler: { select: { id: true, ad: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      mehsul_id: r.mehsullar?.id ?? null,
      mehsul_ad: r.mehsullar?.ad ?? "—",
      mehsul_kod: r.mehsullar?.kod ?? null,
      mehsul_barkod: r.mehsullar?.barkod ?? null,
      cari_stok: Number(r.cari_stok ?? 0),
      son_7: Number(r.son_7_satish ?? 0),
      son_30: Number(r.son_30_satish ?? 0),
      orta_gunluk: Number(r.orta_gunluk ?? 0),
      bitme_gun: r.bitme_gun ?? 0,
      tovsiye_say: Number(r.tovsiye_say ?? 0),
      son_alish_qiy: r.son_alish_qiy ? Number(r.son_alish_qiy) : null,
      min_stok: r.mehsullar?.min_stok ? Number(r.mehsullar.min_stok) : null,
      alis_yaradildi: r.alis_yaradildi ?? false,
      techizatci_ad: r.kontragentler?.ad ?? null,
    }));
  });
}

type SearchParams = { techizatci?: string; kritiklik?: string; kateqoriya?: string; xeber?: string };

async function getFilterOptions() {
  return withTenant(async () => {
    const [techizatcilar, kateqoriyalar] = await Promise.all([
      prisma.kontragentler.findMany({
        where: { nov: { in: ["satici", "tedarukci", "tedarukcu"] } },
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
        take: 200,
      }).catch(() => []),
      prisma.kateqoriyalar.findMany({
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
        take: 200,
      }).catch(() => []),
    ]);
    return { techizatcilar, kateqoriyalar };
  });
}

export default async function SatinalmaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [rows, opts, lastComputed] = await Promise.all([
    getRecommendations(sp),
    getFilterOptions(),
    withTenant(() =>
      prisma.satinalma_tovsiye.findFirst({
        orderBy: { hesablandi: "desc" },
        select: { hesablandi: true },
      }),
    ),
  ]);
  const kritik = rows.filter((r) => r.bitme_gun <= 7).length;
  const tovsiyeMebleg = rows.reduce((s, r) => s + r.tovsiye_say * (r.son_alish_qiy ?? 0), 0);
  const pendingCount = rows.filter((r) => !r.alis_yaradildi && r.tovsiye_say > 0).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Satınalma Planlama</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stok, satış tempi və 7 günlük lead time əsasında avtomatik tövsiyələr.{" "}
            {lastComputed?.hesablandi && (
              <span className="text-foreground/80">
                Son hesablama:{" "}
                <span title={lastComputed.hesablandi.toLocaleString("az-AZ")}>
                  {lastComputed.hesablandi.toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </span>
            )}{" "}
            <span className="text-muted-foreground/70">· hər gecə 03:00 avtomatik yenilənir</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecomputeButton lastComputedAt={lastComputed?.hesablandi ?? null} />
          <Button asChild size="sm" variant="outline">
            <Link href="/ticaret/alislar">
              <ShoppingCart className="h-4 w-4" /> Alış sifarişləri
            </Link>
          </Button>
          <AutoOrderButton count={pendingCount} />
        </div>
      </header>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <select
          name="techizatci"
          defaultValue={sp.techizatci ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Hər təçhizatçı</option>
          {opts.techizatcilar.map((t) => (
            <option key={t.id} value={t.id}>{t.ad}</option>
          ))}
        </select>
        <select
          name="kateqoriya"
          defaultValue={sp.kateqoriya ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Hər kateqoriya</option>
          {opts.kateqoriyalar.map((k) => (
            <option key={k.id} value={k.id}>{k.ad}</option>
          ))}
        </select>
        <select
          name="kritiklik"
          defaultValue={sp.kritiklik ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Hər kritiklik</option>
          <option value="kritik">Kritik (≤7 gün)</option>
          <option value="xeber">Xəbərdarlıq (8-14 gün)</option>
          <option value="normal">Normal (&gt;14 gün)</option>
        </select>
        <label className="ml-1 inline-flex items-center gap-1.5 text-xs">
          <input type="checkbox" name="xeber" value="1" defaultChecked={sp.xeber === "1"} className="h-3.5 w-3.5" />
          Yalnız xəbərdarlıqlı
        </label>
        <button type="submit" className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium">Süz</button>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={ClipboardList} label="Cəm tövsiyə" value={String(rows.length)} subline="AI sxemləşdirib" />
        <KpiCard
          icon={AlertTriangle}
          label="Kritik (7 gün)"
          value={String(kritik)}
          subline="Tezliklə bitir"
          tone={kritik > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={Package}
          label="Tövsiyə miqdar"
          value={formatNumber(rows.reduce((s, r) => s + r.tovsiye_say, 0), 0)}
          subline="vahid"
        />
        <KpiCard icon={TrendingDown} label="Təxmini büdcə" value={formatMoney(tovsiyeMebleg)} subline="Alış üçün" />
      </section>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Tövsiyə yoxdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Avtomatlaşdırma engine satış tempini analiz edib tövsiyələr yaradacaq.
          </p>
        </div>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Məhsul</th>
                    <th className="px-3 py-2.5">Təchizatçı</th>
                    <th className="px-3 py-2.5 text-right">Cari stok</th>
                    <th className="px-3 py-2.5 text-right">Min stok</th>
                    <th className="px-3 py-2.5 text-right">Son 30 gün</th>
                    <th className="px-3 py-2.5 text-right">Orta günlük</th>
                    <th className="px-3 py-2.5 text-right">Bitmə</th>
                    <th className="px-3 py-2.5 text-right">Tövsiyə</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const urgent = r.bitme_gun <= 7;
                    const warn = r.bitme_gun > 7 && r.bitme_gun <= 14;
                    return (
                      <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/40">
                        <td className="px-3 py-2.5">
                          {r.mehsul_id ? (
                            <ProductInline
                              id={r.mehsul_id}
                              ad={r.mehsul_ad}
                              kod={r.mehsul_kod}
                              barkod={r.mehsul_barkod}
                              showImage={false}
                              size="sm"
                            />
                          ) : (
                            <>
                              <div className="font-medium">{r.mehsul_ad}</div>
                              {r.mehsul_kod && <div className="text-xs text-muted-foreground font-mono">{r.mehsul_kod}</div>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.techizatci_ad ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(r.cari_stok, 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[10.5px] text-muted-foreground">
                          {r.min_stok !== null ? formatNumber(r.min_stok, 0) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs">{formatNumber(r.son_30, 0)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                          {r.orta_gunluk.toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge
                            variant="outline"
                            className={urgent ? "border-danger/30 text-danger" : warn ? "border-warning/30 text-warning" : ""}
                          >
                            {r.bitme_gun} gün
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                          {formatNumber(r.tovsiye_say, 0)} əd
                          {r.son_alish_qiy && (
                            <div className="text-xs text-muted-foreground">{formatMoney(r.tovsiye_say * r.son_alish_qiy)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.alis_yaradildi ? (
                            <Badge variant="outline" className="border-success/30 text-success text-[10px]">Sifariş edildi</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Gözləyir</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
