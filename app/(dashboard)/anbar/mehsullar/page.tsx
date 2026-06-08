import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { RecordStatusFilter } from "@/components/ui/record-status-filter";
import { ProductWizard } from "@/features/anbar/components/product-wizard";
import { ProductFilters } from "@/features/anbar/components/product-filters";
import { ProductTable } from "@/features/anbar/components/product-table";
import { ProductGrid } from "@/features/anbar/components/product-grid";
import { ViewModeToggle } from "@/features/anbar/components/view-mode-toggle";
import { TransferDialog } from "@/features/anbar/components/transfer-dialog";
import {
  getProducts,
  getCategoryOptions,
  getBrandOptions,
  getUnitOptions,
  type ProductFilter,
} from "@/features/anbar/queries";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export const metadata: Metadata = { title: "Məhsullar" };

type SearchParams = {
  q?: string;
  kateq?: string | string[];
  marka?: string | string[];
  stok_status?: string | string[];
  aktiv?: string;
  sekil?: string;
  barkod?: string;
  qmin?: string;
  qmax?: string;
  sirala?: string;
  anbar?: string;
  servis?: string;
  rezerv?: string;
  view?: string;
  page?: string;
};

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseBool(v: string | undefined): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

// Anbarlar nadir hallarda dəyişir — 2 dəq cross-request cache.
// Bu page hər navigation-da bu sorğunu DB-yə vurmasın.
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
      ["anbar-options", sahibkarId],
      { revalidate: 120, tags: [`ref:${sahibkarId}:anbarlar`] },
    );
    return cached();
  });
}

const PAGE_SIZE = 50;

async function ProblemPanelSection() {
  const { getProductProblemStats } = await import("@/features/anbar/problem-stats-queries");
  const { ProductProblemPanel } = await import("@/features/anbar/components/product-problem-panel");
  const stats = await getProductProblemStats();
  return <ProductProblemPanel stats={stats} />;
}

async function KpiHeroSection() {
  const { getAnbarKpis } = await import("@/features/anbar/queries");
  const { ProductKpiHero } = await import("@/features/anbar/components/product-kpi-hero");
  const kpis = await getAnbarKpis();
  return <ProductKpiHero kpis={kpis} />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md" />
      ))}
    </div>
  );
}

async function ProductListSection({
  filter,
  page,
  view,
  categoriesP,
  brandsP,
  anbarlarP,
  unitsP,
  canEdit,
  canDelete,
  canAdjustStock,
}: {
  filter: ProductFilter;
  page: number;
  view: string | undefined;
  categoriesP: ReturnType<typeof getCategoryOptions>;
  brandsP: ReturnType<typeof getBrandOptions>;
  anbarlarP: ReturnType<typeof getAnbarOptions>;
  unitsP: ReturnType<typeof getUnitOptions>;
  canEdit: boolean;
  canDelete: boolean;
  canAdjustStock: boolean;
}) {
  // Cache-də olan referans listələri (paralel resolve) + əsl məhsul sorğusu
  const [{ items, total }, categories, brands, anbarlar, units] = await Promise.all([
    getProducts(filter, page, PAGE_SIZE),
    categoriesP,
    brandsP,
    anbarlarP,
    unitsP,
  ]);

  return (
    <>
      <ProductFilters categories={categories} brands={brands} anbarlar={anbarlar} />

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {total} məhsul tapıldı
        </div>
        <ViewModeToggle />
      </div>

      {view === "grid" ? (
        <ProductGrid
          items={items}
          categories={categories}
          brands={brands}
          units={units}
          anbarlar={anbarlar}
          canEdit={canEdit}
          canDelete={canDelete}
          canAdjustStock={canAdjustStock}
        />
      ) : (
        <ProductTable
          items={items}
          total={total}
          categories={categories}
          brands={brands}
          units={units}
          anbarlar={anbarlar}
          canEdit={canEdit}
          canDelete={canDelete}
          canAdjustStock={canAdjustStock}
        />
      )}

      <Pagination total={total} pageSize={PAGE_SIZE} page={page} basePath="/anbar/mehsullar" />
    </>
  );
}

async function HeaderActions({
  categoriesP,
  brandsP,
  anbarlarP,
  unitsP,
}: {
  categoriesP: ReturnType<typeof getCategoryOptions>;
  brandsP: ReturnType<typeof getBrandOptions>;
  anbarlarP: ReturnType<typeof getAnbarOptions>;
  unitsP: ReturnType<typeof getUnitOptions>;
}) {
  const [categories, brands, anbarlar, units] = await Promise.all([
    categoriesP,
    brandsP,
    anbarlarP,
    unitsP,
  ]);
  return (
    <>
      {anbarlar.length >= 2 && <TransferDialog anbarlar={anbarlar} />}
      <ProductWizard categories={categories} brands={brands} units={units} />
    </>
  );
}

export default async function MehsullarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { requireAnbarPerm } = await import("@/features/anbar/access-guard");
  const { icazeler, isOwnerOrAdmin } = await requireAnbarPerm("mehsul.oxu");
  const canEdit =
    isOwnerOrAdmin || icazeler.includes("mehsul.duzelt") || icazeler.includes("mehsul.idare");
  const canDelete = isOwnerOrAdmin || icazeler.includes("mehsul.sil") || icazeler.includes("mehsul.idare");
  const canAdjustStock =
    isOwnerOrAdmin || icazeler.includes("stok.duzelis") || icazeler.includes("anbar.idare");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const { readRecordStatusFromSearch } = await import("@/lib/soft-delete/record-filter");
  const { filter: recordStatus, canSeeDeleted } = await readRecordStatusFromSearch(
    sp as Record<string, string | string[] | undefined>,
  );

  const filter: ProductFilter = {
    search: sp.q,
    kateqoriya_id: asArray(sp.kateq).map(Number).filter(Number.isFinite),
    marka_id: asArray(sp.marka).map(Number).filter(Number.isFinite),
    stok_status: asArray(sp.stok_status) as ProductFilter["stok_status"],
    aktiv_durum: (sp.aktiv as ProductFilter["aktiv_durum"]) ?? "aktiv",
    has_image: parseBool(sp.sekil),
    has_barcode: parseBool(sp.barkod),
    price_min: sp.qmin ? Number(sp.qmin) : undefined,
    price_max: sp.qmax ? Number(sp.qmax) : undefined,
    sirala: sp.sirala,
    anbar_id: sp.anbar ? Number(sp.anbar) : undefined,
    servisde_olmus: sp.servis === "1",
    rezervde: sp.rezerv === "1",
    recordStatus,
  };

  // Promise-ləri page-də başlat ki, paralel resolve olsunlar — Suspense
  // tərəfləri eyni promise-i await edir, double-fetch yox.
  const categoriesP = getCategoryOptions();
  const brandsP = getBrandOptions();
  const anbarlarP = getAnbarOptions();
  const unitsP = getUnitOptions();

  return (
    <div className="mx-auto max-w-7xl">
      <AnbarSubNav active="/anbar/mehsullar" />
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              Məhsullar və stok
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Katalog · qiymət · stok səviyyəsi · maya
            </p>
          </div>
          {/* Primary action — həmişə görünür, sağ üstə bağlıdır */}
          <div className="flex shrink-0 items-center gap-1.5">
            <RecordStatusFilter canSeeDeleted={canSeeDeleted} />
            <Link href="/ayarlar/inteqrasiya?key=mehsul" title="Excel idxal">
              <Button variant="outline" size="icon-sm" className="h-9 w-9">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/api/anbar/mehsullar/export" prefetch={false} title="Excel ixrac">
              <Button variant="outline" size="icon-sm" className="h-9 w-9">
                <FileDown className="h-4 w-4" />
              </Button>
            </Link>
            <Suspense fallback={<Skeleton className="h-9 w-32 rounded-md" />}>
              <HeaderActions
                categoriesP={categoriesP}
                brandsP={brandsP}
                anbarlarP={anbarlarP}
                unitsP={unitsP}
              />
            </Suspense>
          </div>
        </header>

        {/* Modern KPI hero — 5 ən vacib göstərici */}
        <Suspense
          fallback={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-2xl" />
              ))}
            </div>
          }
        >
          <KpiHeroSection />
        </Suspense>

        {/* Sürətli stok + problem filterləri — chip stilli */}
        <Suspense fallback={<Skeleton className="h-14 w-full rounded-xl" />}>
          <ProblemPanelSection />
        </Suspense>

        <Suspense fallback={<TableSkeleton />}>
          <ProductListSection
            filter={filter}
            page={page}
            view={sp.view}
            categoriesP={categoriesP}
            brandsP={brandsP}
            anbarlarP={anbarlarP}
            unitsP={unitsP}
            canEdit={canEdit}
            canDelete={canDelete}
            canAdjustStock={canAdjustStock}
          />
        </Suspense>
      </div>
    </div>
  );
}
