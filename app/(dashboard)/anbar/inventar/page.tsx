import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, CheckCircle2, Clock, ScanBarcode, Filter, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { EmptyState } from "@/components/ui/empty-state";
import { NewInventarDialog } from "@/features/anbar/inventar/components/new-inventar-dialog";
import { InventarFilters } from "@/features/anbar/inventar/components/inventar-filters";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "İnventar / Fiziki sayım" };

type SP = { status?: string; anbar?: string; from?: string; to?: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  aktiv: { label: "Davam edir", cls: "border-warning/30 text-warning bg-warning/10" },
  tamamlandi: { label: "Tamamlandı", cls: "border-success/30 text-success bg-success/10" },
  legv: { label: "Ləğv", cls: "border-muted text-muted-foreground" },
};

type InvFilter = { status?: string; anbarId?: number; from?: string; to?: string };

async function getInventories(filter: InvFilter = {}) {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.anbarId) where.anbar_id = filter.anbarId;
    if (filter.from || filter.to) {
      const r: Record<string, Date> = {};
      if (filter.from) r.gte = new Date(filter.from);
      if (filter.to) {
        const end = new Date(filter.to);
        end.setHours(23, 59, 59, 999);
        r.lte = end;
      }
      where.tarix = r;
    }
    return prisma.inventarizasiyalar.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 50,
      include: {
        anbarlar: { select: { ad: true } },
        istifadeciler_inventarizasiyalar_tamamlanan_idToistifadeciler: { select: { ad_soyad: true } },
        _count: { select: { inventar_satirlari: true } },
      },
    });
  });
}

async function getStats() {
  return withTenant(async () => {
    const [total, aktiv, tamamlandi] = await Promise.all([
      prisma.inventarizasiyalar.count(),
      prisma.inventarizasiyalar.count({ where: { status: "aktiv" } }),
      prisma.inventarizasiyalar.count({ where: { status: "tamamlandi" } }),
    ]);
    return { total, aktiv, tamamlandi };
  });
}

async function getAnbarOptions() {
  return withTenant(() =>
    prisma.anbarlar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    })
  );
}

async function getCountFilters() {
  return withTenant(async () => {
    const [kateqoriyalar, markalar, mehsullar] = await Promise.all([
      prisma.kateqoriyalar.findMany({ orderBy: { ad: "asc" }, select: { id: true, ad: true } }),
      prisma.markalar.findMany({ orderBy: { ad: "asc" }, select: { id: true, ad: true } }),
      prisma.mehsullar.findMany({
        where: { aktiv: true },
        orderBy: { ad: "asc" },
        take: 1000,
        select: { id: true, ad: true },
      }),
    ]);
    return { kateqoriyalar, markalar, mehsullar };
  });
}

export default async function InventarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const anbarId = sp.anbar ? Number(sp.anbar) : undefined;
  const [rows, stats, anbarlar, countFilters] = await Promise.all([
    getInventories({
      status: sp.status,
      anbarId: Number.isFinite(anbarId) ? anbarId : undefined,
      from: sp.from,
      to: sp.to,
    }),
    getStats(),
    getAnbarOptions(),
    getCountFilters(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <AnbarSubNav active="/anbar/inventar" />
      <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">İnventar / Fiziki sayım</h1>
          <p className="mt-1 text-sm text-muted-foreground">Anbar sayımı, sistem vs faktiki uyğunsuzluq.</p>
        </div>
        <NewInventarDialog
          anbarlar={anbarlar}
          kateqoriyalar={countFilters.kateqoriyalar}
          markalar={countFilters.markalar}
          mehsullar={countFilters.mehsullar}
        />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon={ClipboardCheck} label="Cəm sayım" value={String(stats.total)} subline="Bütün vaxt" />
        <KpiCard icon={Clock} label="Davam edir" value={String(stats.aktiv)} subline="Açıq sayım" tone={stats.aktiv > 0 ? "warning" : "neutral"} />
        <KpiCard icon={CheckCircle2} label="Tamamlanan" value={String(stats.tamamlandi)} subline="Yekunlaşmış" tone="success" />
      </section>

      {stats.total === 0 && !sp.status && !sp.anbar && !sp.from && !sp.to ? (
        <EmptyState
          icon={ClipboardCheck}
          tone="primary"
          title="Hələ sayım yoxdur"
          description="Sayım — anbarın faktiki vəziyyətini sistem qeydləri ilə müqayisə edib, fərq tapdıqda stok düzəltməyə imkan verir."
          help="3 sayım növü dəstəklənir: Tam (bütün məhsullar), Seçimli (kateqoriya/marka filtri ilə), Nöqtə (yalnız əl ilə seçilmiş məhsullar). Barkod skaner inteqrasiyası ilə sürətli sayım."
          examples={[
            { icon: Filter,      title: "Aylıq cycle count", desc: "Hər ay 1 kateqoriya seç və onu say — daimi sayım rotasiyası" },
            { icon: Target,      title: "Nöqtə sayım",       desc: "Bir məhsul ehtimal olunan oğurluq — yalnız onu say" },
            { icon: ScanBarcode, title: "Sürətli skan",      desc: "Barkod skaner ilə dəqiqədə 30+ məhsulu say" },
          ]}
        />
      ) : (
        <>
          <InventarFilters anbarlar={anbarlar} />
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <ClipboardCheck className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <h3 className="font-semibold">Filtrə uyğun sayım yoxdur</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Filterləri sıfırlayın və ya yeni sayım başladın.
              </p>
            </div>
          ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto" data-table-scroll>
              <table className="w-full text-sm" data-sticky-head>
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Nömrə / Tarix</th>
                    <th className="px-3 py-2.5">Anbar</th>
                    <th className="px-3 py-2.5 text-center">Sətr</th>
                    <th className="px-3 py-2.5">Tamamlayan</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = STATUS[r.status ?? "aktiv"] ?? STATUS.aktiv;
                    return (
                      <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/40">
                        <td className="px-3 py-2.5">
                          <Link href={`/anbar/inventar/${r.id}`} className="block hover:text-primary">
                            <div className="font-mono text-xs font-medium">{r.nomre}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(r.tarix)}</div>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">{r.anbarlar?.ad ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-xs">{r._count.inventar_satirlari}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {r.istifadeciler_inventarizasiyalar_tamamlanan_idToistifadeciler?.ad_soyad ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={s.cls + " text-[10px]"}>{s.label}</Badge>
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
        </>
      )}
      </div>
    </div>
  );
}
