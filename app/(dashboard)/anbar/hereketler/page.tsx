import type { Metadata } from "next";
import {
  History, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { HereketFilters } from "@/features/anbar/components/hereket-filters";
import { HereketTable, type HereketRow } from "@/features/anbar/components/hereket-table";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export const metadata: Metadata = { title: "Stok hərəkətləri" };

const PAGE_SIZE = 50;

type SP = {
  page?: string;
  nov?: string;
  ref_nov?: string;
  anbar?: string;
  q?: string;
  from?: string;
  to?: string;
};

async function getMovements(page: number, filter: { nov?: string; ref_nov?: string; anbar?: number; search?: string; from?: Date; to?: Date }) {
  return withTenant(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter.nov) where.nov = filter.nov;
    if (filter.ref_nov) where.ref_nov = filter.ref_nov;
    if (filter.anbar) where.anbar_id = filter.anbar;
    if (filter.search?.trim()) {
      const q = filter.search.trim();
      where.mehsullar = {
        OR: [
          { ad: { contains: q, mode: "insensitive" } },
          { kod: { contains: q, mode: "insensitive" } },
          { barkod: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
          { markalar: { is: { ad: { contains: q, mode: "insensitive" } } } },
          { kateqoriyalar: { is: { ad: { contains: q, mode: "insensitive" } } } },
        ],
      };
    }
    if (filter.from || filter.to) {
      where.yaradildi = {};
      if (filter.from) where.yaradildi.gte = filter.from;
      if (filter.to) {
        const end = new Date(filter.to);
        end.setHours(23, 59, 59);
        where.yaradildi.lte = end;
      }
    }

    const [items, total, stats] = await Promise.all([
      prisma.anbar_hereketleri.findMany({
        where,
        orderBy: { yaradildi: "desc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        include: {
          mehsullar: {
            select: {
              id: true,
              ad: true,
              kod: true,
              barkod: true,
              sekil_url: true,
              aciqlamaq: true,
              qisaca_tesvir: true,
              aktiv: true,
              model: true,
              rang: true,
              istehsalci: true,
              valyuta: true,
              edv_status: true,
              zemanet_ay: true,
              kateqoriyalar: {
                select: {
                  ad: true,
                  kateqoriyalar: { select: { ad: true } },
                },
              },
              markalar: { select: { ad: true } },
              olcu_vahidleri: { select: { qisa_ad: true, ad: true } },
              _count: { select: { servis_qeydleri: true } },
            },
          },
          anbarlar: { select: { ad: true } },
          istifadeciler: { select: { ad_soyad: true } },
        },
      }),
      prisma.anbar_hereketleri.count({ where }),
      prisma.anbar_hereketleri.groupBy({
        by: ["nov"],
        _count: { _all: true },
      }),
    ]);

    const mapped: HereketRow[] = items.map((m) => ({
      id: m.id,
      tarix: m.yaradildi,
      nov: m.nov,
      mehsul_id: m.mehsullar?.id ?? null,
      mehsul_ad: m.mehsullar?.ad ?? "—",
      mehsul_kod: m.mehsullar?.kod ?? null,
      mehsul_barkod: m.mehsullar?.barkod ?? null,
      mehsul_sekil_url: m.mehsullar?.sekil_url ?? null,
      kateqoriya_ad: m.mehsullar?.kateqoriyalar?.ad ?? null,
      kateqoriya_ust_ad: m.mehsullar?.kateqoriyalar?.kateqoriyalar?.ad ?? null,
      marka_ad: m.mehsullar?.markalar?.ad ?? null,
      model: m.mehsullar?.model ?? null,
      rang: m.mehsullar?.rang ?? null,
      istehsalci: m.mehsullar?.istehsalci ?? null,
      olcu_ad: m.mehsullar?.olcu_vahidleri?.qisa_ad ?? m.mehsullar?.olcu_vahidleri?.ad ?? null,
      valyuta: m.mehsullar?.valyuta ?? "AZN",
      edv_status: m.mehsullar?.edv_status ?? null,
      zemanet_ay: Number(m.mehsullar?.zemanet_ay ?? 0),
      mehsul_aciqlamaq: m.mehsullar?.aciqlamaq ?? null,
      mehsul_qisaca_tesvir: m.mehsullar?.qisaca_tesvir ?? null,
      mehsul_servis_sayi: m.mehsullar?._count?.servis_qeydleri ?? 0,
      mehsul_aktiv: m.mehsullar?.aktiv ?? false,
      anbar_ad: m.anbarlar?.ad ?? "—",
      miqdar: Number(m.miqdar),
      qiymet: m.qiymet ? Number(m.qiymet) : null,
      edilen_ad: m.istifadeciler?.ad_soyad ?? null,
      qeyd: m.qeyd,
      ref_nov: m.ref_nov,
      ref_id: m.ref_id,
    }));

    return {
      items: mapped,
      total,
      stats: stats.map((s) => ({ nov: s.nov, count: s._count._all })),
    };
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

export default async function HereketlerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filter = {
    nov: sp.nov || undefined,
    ref_nov: sp.ref_nov || undefined,
    anbar: sp.anbar ? Number(sp.anbar) : undefined,
    search: sp.q || undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
  };
  const [{ items, total, stats }, anbarlar] = await Promise.all([
    getMovements(page, filter),
    getAnbarOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <AnbarSubNav active="/anbar/hereketler" />
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Anbar hərəkətləri</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bütün stok mədaxil, məxaric və transferlərin loqu.</p>
        </header>

        {(() => {
          const medaxilTotal = stats.filter((s) => ["medaxil", "transfer_giris", "qaytarma_giris"].includes(s.nov)).reduce((a, b) => a + b.count, 0);
          const mexaricTotal = stats.filter((s) => ["mexaric", "transfer_cixis", "qaytarma_cixis"].includes(s.nov)).reduce((a, b) => a + b.count, 0);
          const transferTotal = stats.filter((s) => s.nov.startsWith("transfer")).reduce((a, b) => a + b.count, 0);
          const cemTotal = stats.reduce((a, b) => a + b.count, 0);
          return (
            <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <KpiCard icon={ArrowDownToLine} label="Mədaxil" value={String(medaxilTotal)} subline="giriş əməliyyatları" tone="success" />
              <KpiCard icon={ArrowUpFromLine} label="Məxaric" value={String(mexaricTotal)} subline="çıxış əməliyyatları" tone="danger" />
              <KpiCard icon={ArrowLeftRight} label="Transfer" value={String(transferTotal)} subline="anbarlar arası" tone="info" />
              <KpiCard icon={History} label="Cəm əməliyyat" value={String(cemTotal)} subline="bütün hərəkətlər" />
            </section>
          );
        })()}

        <HereketFilters anbarlar={anbarlar} />

        <HereketTable items={items} />

        <Pagination total={total} pageSize={PAGE_SIZE} page={page} basePath="/anbar/hereketler" />
      </div>
    </div>
  );
}
