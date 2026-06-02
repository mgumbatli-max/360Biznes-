import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnbarSubNav } from "@/components/anbar-subnav";
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
}: {
  filter: ProductFilter;
  page: number;
  view: string | undefined;
  categoriesP: ReturnType<typeof getCategoryOptions>;
  brandsP: ReturnType<typeof getBrandOptions>;
  anbarlarP: ReturnType<typeof getAnbarOptions>;
  unitsP: ReturnType<typeof getUnitOptions>;
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
        <ProductGrid items={items} categories={categories} brands={brands} units={units} anbarlar={anbarlar} />
      ) : (
        <ProductTable items={items} total={total} categories={categories} brands={brands} units={units} anbarlar={anbarlar} />
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
  await requireAnbarPerm("mehsul.oxu");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

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
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Məhsullar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Katalog idarəetməsi — qiymət, stok səviyyəsi, kateqoriya və marka.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/ayarlar/inteqrasiya?key=mehsul">
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4" /> Excel idxal
              </Button>
            </Link>
            <Link href="/api/anbar/mehsullar/export" prefetch={false}>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4" /> Excel ixrac
              </Button>
            </Link>
            <Suspense fallback={<Skeleton className="h-9 w-28 rounded-md" />}>
              <HeaderActions
                categoriesP={categoriesP}
                brandsP={brandsP}
                anbarlarP={anbarlarP}
                unitsP={unitsP}
              />
            </Suspense>
          </div>
        </header>

        <Suspense fallback={<TableSkeleton />}>
          <ProductListSection
            filter={filter}
            page={page}
            view={sp.view}
            categoriesP={categoriesP}
            brandsP={brandsP}
            anbarlarP={anbarlarP}
            unitsP={unitsP}
          />
        </Suspense>
      </div>
    </div>
  );
}
