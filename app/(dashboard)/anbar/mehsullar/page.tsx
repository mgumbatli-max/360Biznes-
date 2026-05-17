import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, FileDown } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
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
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export const metadata: Metadata = { title: "Məhsullar" };
export const dynamic = "force-dynamic";

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

async function getAnbarOptions() {
  return withTenant(async () =>
    prisma.anbarlar.findMany({ where: { aktiv: true }, orderBy: { ad: "asc" }, select: { id: true, ad: true } })
  );
}

const PAGE_SIZE = 50;

export default async function MehsullarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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

  const [{ items, total }, categories, brands, anbarlar, units] = await Promise.all([
    getProducts(filter, page, PAGE_SIZE),
    getCategoryOptions(),
    getBrandOptions(),
    getAnbarOptions(),
    getUnitOptions(),
  ]);

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
          <Link href="/api/anbar/mehsullar/export" prefetch={false}>
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4" /> Excel ixrac
            </Button>
          </Link>
          <Link href="/anbar/mehsul-yukle">
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4" /> Excel yüklə
            </Button>
          </Link>
          {anbarlar.length >= 2 && <TransferDialog anbarlar={anbarlar} />}
          <ProductWizard categories={categories} brands={brands} units={units} />
        </div>
      </header>

      <ProductFilters categories={categories} brands={brands} anbarlar={anbarlar} />

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {total} məhsul tapıldı
        </div>
        <ViewModeToggle />
      </div>

      {sp.view === "grid" ? (
        <ProductGrid items={items} categories={categories} brands={brands} units={units} anbarlar={anbarlar} />
      ) : (
        <ProductTable items={items} total={total} categories={categories} brands={brands} units={units} anbarlar={anbarlar} />
      )}

      <Pagination total={total} pageSize={PAGE_SIZE} page={page} basePath="/anbar/mehsullar" />
      </div>
    </div>
  );
}
