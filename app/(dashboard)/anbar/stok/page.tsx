import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Boxes, AlertTriangle, History, Package, ArrowLeftRight, ClipboardCheck, ArrowDownToLine, ArrowUpFromLine, XCircle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { StokFilters } from "@/features/anbar/components/stok-filters";
import { StokTable } from "@/features/anbar/components/stok-table";
import { QuickStockAction } from "@/features/anbar/components/quick-stock-action";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getStokKpis, getStokRows, getRecentMovements, type StokFilter } from "@/features/anbar/stok-queries";
import { formatDate, formatMoney, formatNumber, formatCompactMoney, formatCompactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Stok vəziyyəti" };
export const dynamic = "force-dynamic";

type SP = { q?: string; anbar?: string; status?: string };

async function getAnbarOptions() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      async () =>
        prismaUnscoped.anbarlar.findMany({
          where: { sahibkar_id: sahibkarId, aktiv: true },
          orderBy: { ad: "asc" },
          select: { id: true, ad: true },
        }),
      ["stok-anbar-options", sahibkarId],
      { revalidate: 120, tags: [`ref:${sahibkarId}:anbarlar`] },
    );
    return cached();
  });
}

async function getProductOptions() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const cached = unstable_cache(
      async () =>
        prismaUnscoped.mehsullar.findMany({
          where: { sahibkar_id: sahibkarId, aktiv: true },
          orderBy: { ad: "asc" },
          take: 1000,
          select: { id: true, ad: true, kod: true, barkod: true },
        }),
      ["stok-product-options", sahibkarId],
      { revalidate: 60, tags: [`ref:${sahibkarId}:mehsullar`] },
    );
    return cached();
  });
}

const MOV_META: Record<string, { label: string; icon: typeof History; cls: string; sign: "+" | "−" }> = {
  medaxil:        { label: "Mədaxil",         icon: ArrowDownToLine, cls: "text-success", sign: "+" },
  mexaric:        { label: "Məxaric",         icon: ArrowUpFromLine, cls: "text-danger",  sign: "−" },
  transfer_giris: { label: "Transfer giriş",  icon: ArrowLeftRight,  cls: "text-info",    sign: "+" },
  transfer_cixis: { label: "Transfer çıxış",  icon: ArrowLeftRight,  cls: "text-info",    sign: "−" },
  inventar:       { label: "Sayım düzəlişi",  icon: ClipboardCheck,  cls: "text-warning", sign: "+" },
  qaytarma_giris: { label: "Qaytarma giriş",  icon: ArrowDownToLine, cls: "text-warning", sign: "+" },
  qaytarma_cixis: { label: "Qaytarma çıxış",  icon: ArrowUpFromLine, cls: "text-warning", sign: "−" },
};

async function HeaderActions({
  productsP,
  anbarlarP,
}: {
  productsP: ReturnType<typeof getProductOptions>;
  anbarlarP: ReturnType<typeof getAnbarOptions>;
}) {
  const [products, anbarlar] = await Promise.all([productsP, anbarlarP]);
  return (
    <>
      <QuickStockAction nov="medaxil" products={products} anbarlar={anbarlar} />
      <QuickStockAction nov="mexaric" products={products} anbarlar={anbarlar} />
      <QuickStockAction nov="inventar" products={products} anbarlar={anbarlar} />
    </>
  );
}

async function KpisBlock() {
  const kpis = await getStokKpis();
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div className="col-span-2 rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Stok dəyəri</div>
          <Boxes className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400" title={formatMoney(kpis.deyer)}>
          {formatCompactMoney(kpis.deyer)}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          <span title={formatNumber(kpis.miqdar, 0)}>{formatCompactNumber(kpis.miqdar)}</span> ədəd ·{" "}
          <span title={String(kpis.nov)}>{formatCompactNumber(kpis.nov)}</span> məhsul növü
        </div>
      </div>
      <Stat label="Az stok" sub={kpis.az > 0 ? "kritik səviyyədə" : "hamı qaydadır"} value={formatCompactNumber(kpis.az)} icon={AlertTriangle} tone={kpis.az > 0 ? "warning" : "neutral"} fullValue={String(kpis.az)} />
      <Stat label="Stok yoxdur" sub={kpis.yox > 0 ? "tükənmiş" : "hamı stokda"} value={formatCompactNumber(kpis.yox)} icon={XCircle} tone={kpis.yox > 0 ? "danger" : "neutral"} fullValue={String(kpis.yox)} />
      <Stat label="Sağlamlıq %" sub="normal stok payı" value={`${kpis.saglamlik.toFixed(0)}%`} icon={Activity} tone={kpis.saglamlik >= 80 ? "success" : kpis.saglamlik >= 50 ? "warning" : "danger"} />
    </section>
  );
}

function KpisSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Skeleton className="col-span-2 h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </section>
  );
}

async function StokTableBlock({
  filter,
  sp,
  anbarlarP,
}: {
  filter: StokFilter;
  sp: SP;
  anbarlarP: ReturnType<typeof getAnbarOptions>;
}) {
  const [rows, anbarlar] = await Promise.all([getStokRows(filter), anbarlarP]);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card/40">
        <StokFilters anbarlar={anbarlar} />
      </div>
      <StokTable
        rows={rows}
        anbarlar={anbarlar}
        exportHref={`/api/anbar/stok/export?${new URLSearchParams({
          ...(sp.q ? { q: sp.q } : {}),
          ...(sp.anbar ? { anbar: sp.anbar } : {}),
          ...(sp.status ? { status: sp.status } : {}),
        }).toString()}`}
      />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

async function RecentMovementsBlock() {
  const recent = await getRecentMovements(12);
  return (
    <section className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-muted-foreground" /> Son hərəkətlər
        </h3>
        <Link href="/anbar/hereketler" className="text-[11px] text-primary hover:underline">
          Hamısını gör →
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Hələ hərəkət yoxdur</div>
      ) : (
        <ul className="divide-y divide-border/30">
          {recent.map((m) => {
            const meta = MOV_META[m.nov] ?? { label: m.nov, icon: History, cls: "", sign: "+" as const };
            const Icon = meta.icon;
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/20">
                <div className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-secondary/40 ${meta.cls}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] ${meta.cls}`}>{meta.label}</Badge>
                    {m.mehsul_id ? (
                      <Link href={`/anbar/mehsullar/${m.mehsul_id}`} className="truncate text-sm font-medium hover:text-primary">
                        {m.mehsul_ad}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium">{m.mehsul_ad}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span><Package className="inline h-2.5 w-2.5" /> {m.anbar_ad}</span>
                    {m.qeyd && <span className="truncate">· {m.qeyd}</span>}
                    {m.edilen_ad && <span>· {m.edilen_ad}</span>}
                  </div>
                </div>
                <div className={`shrink-0 tabular-nums text-sm font-bold ${meta.cls}`}>
                  {meta.sign} {formatNumber(m.miqdar, m.miqdar % 1 === 0 ? 0 : 2)}
                </div>
                <div className="shrink-0 text-[10.5px] text-muted-foreground whitespace-nowrap">
                  {m.tarix && formatDate(m.tarix, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function StokPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filter: StokFilter = {
    search: sp.q,
    anbar_id: sp.anbar ? Number(sp.anbar) : undefined,
    status: sp.status === "az" || sp.status === "ok" ? sp.status : undefined,
  };
  // Promise-ləri başlat — paralel resolve, hər Suspense eyni promise-ə qoşulur
  const anbarlarP = getAnbarOptions();
  const productsP = getProductOptions();

  return (
    <div className="mx-auto max-w-7xl">
      <AnbarSubNav active="/anbar/stok" />
      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stok vəziyyəti</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Anbar üzrə qalıq, rezerv, mövcud miqdar. Mədaxil/Məxaric əməliyyatları audit qeydi ilə.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Suspense fallback={<Skeleton className="h-9 w-72 rounded-md" />}>
              <HeaderActions productsP={productsP} anbarlarP={anbarlarP} />
            </Suspense>
            <Link href="/anbar/transfer">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeftRight className="h-4 w-4" /> Transfer
              </Button>
            </Link>
          </div>
        </header>

        <Suspense fallback={<KpisSkeleton />}>
          <KpisBlock />
        </Suspense>

        <Suspense fallback={<TableSkeleton />}>
          <StokTableBlock filter={filter} sp={sp} anbarlarP={anbarlarP} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <RecentMovementsBlock />
        </Suspense>
      </div>
    </div>
  );
}

function Stat({
  label, sub, value, icon: Icon, tone, fullValue,
}: {
  label: string;
  sub: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "warning" | "danger" | "neutral";
  fullValue?: string;
}) {
  const palette = {
    success: { wrap: "border-emerald-500/30 bg-emerald-500/5", value: "text-emerald-600 dark:text-emerald-400", icon: "text-emerald-500" },
    warning: { wrap: "border-amber-500/30 bg-amber-500/5",     value: "text-amber-600 dark:text-amber-400",     icon: "text-amber-500" },
    danger:  { wrap: "border-rose-500/30 bg-rose-500/5",       value: "text-rose-600 dark:text-rose-400",       icon: "text-rose-500" },
    neutral: { wrap: "border-border bg-card",                  value: "text-foreground",                        icon: "text-muted-foreground" },
  }[tone ?? "neutral"];
  return (
    <div className={`rounded-xl border p-4 ${palette.wrap}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${palette.value}`} title={fullValue}>{value}</div>
        </div>
        <Icon className={`h-5 w-5 ${palette.icon}`} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
