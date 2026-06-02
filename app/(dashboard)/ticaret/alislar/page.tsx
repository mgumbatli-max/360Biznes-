import type { Metadata } from "next";
import { Truck, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PurchaseDialog } from "@/features/ticaret/components/purchase-dialog";
import { PurchasesTable } from "@/features/ticaret/components/purchases-table";
import { PurchaseFilters } from "@/features/ticaret/components/purchase-filters";
import { getPurchases, getSuppliers, getProductsForPurchase, type PurchaseFilter } from "@/features/ticaret/alis-queries";
import { getDefaultAnbar } from "@/features/pos/sale-queries";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { SavedUrlFiltersChip } from "@/features/elaqe/components/saved-url-filters-chip";

export const metadata: Metadata = { title: "Alışlar" };

type SearchParams = {
  q?: string;
  status?: string | string[];
  techizatci?: string;
  anbar?: string;
  from?: string;
  to?: string;
};

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

async function getAnbarOptions() {
  return withTenant(async () =>
    prisma.anbarlar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    })
  );
}

export default async function AlislarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  await requireTicaretPerm("alis.oxu");

  const sp = await searchParams;
  const filter: PurchaseFilter = {
    search: sp.q,
    status: asArray(sp.status),
    techizatci_id: sp.techizatci || undefined,
    anbar_id: sp.anbar ? Number(sp.anbar) : undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
  };
  const [{ items, total }, suppliers, products, anbarlar, defaultAnbar] = await Promise.all([
    getPurchases(filter),
    getSuppliers(),
    getProductsForPurchase(),
    getAnbarOptions(),
    getDefaultAnbar(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alışlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Təchizatçıdan alınan məhsullar. Qəbul edildikdə avtomatik stok artır.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SavedUrlFiltersChip storageKey="alislar" basePath="/ticaret/alislar" />
          <Button asChild size="sm" variant="outline">
            <Link href="/api/ticaret/alis-export" target="_blank">
              <FileSpreadsheet className="h-4 w-4" />
              Excel ixrac
            </Link>
          </Button>
          <PurchaseDialog
            suppliers={suppliers.map((s) => ({ id: s.id, ad: s.ad, telefon: s.telefon }))}
            products={products}
            anbarlar={anbarlar.length ? anbarlar : defaultAnbar ? [defaultAnbar] : []}
          />
        </div>
      </header>

      <TicaretSubNav active="/ticaret/alislar" />

      <PurchaseFilters
        suppliers={suppliers.map((s) => ({ id: s.id, ad: s.ad }))}
        anbarlar={anbarlar}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
            <Truck className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Alış sifarişi yoxdur</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Yuxarıdakı «Yeni alış» düyməsi ilə başlayın.
          </p>
        </div>
      ) : (
        <PurchasesTable items={items} total={total} />
      )}

      <Link
        href="/elaqe"
        className="inline-flex items-center gap-1 text-xs text-primary-light hover:underline"
      >
        Təchizatçıları idarə et <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
