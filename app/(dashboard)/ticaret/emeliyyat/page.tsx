import type { Metadata } from "next";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { RefreshButton } from "@/components/refresh-button";
import { RecordStatusFilter } from "@/components/ui/record-status-filter";
import { OperationsTable } from "@/features/ticaret/components/operations-table";
import { OperationsFilters } from "@/features/ticaret/components/operations-filters";
import {
  getTradeOperations,
  getOperationFilterOptions,
  type OperationKind,
} from "@/features/ticaret/emeliyyat-queries";

export const metadata: Metadata = { title: "Əməliyyatlar" };

type SearchParams = {
  nov?: string;
  q?: string;
  from?: string;
  to?: string;
  anbar?: string;
  kontragent?: string;
  status?: string;
};

export default async function TicaretEmeliyyatPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { requireTicaretPerm } = await import("@/features/ticaret/access-guard");
  const { icazeler, isOwnerOrAdmin } = await requireTicaretPerm();
  const canPaySale = isOwnerOrAdmin || icazeler.includes("satis.odenis") || icazeler.includes("satis.idare");
  const canCancelSale = isOwnerOrAdmin || icazeler.includes("satis.legv") || icazeler.includes("satis.idare");
  const canReceivePurchase = isOwnerOrAdmin || icazeler.includes("alis.qebul") || icazeler.includes("alis.idare");
  const canCancelPurchase = isOwnerOrAdmin || icazeler.includes("alis.legv") || icazeler.includes("alis.idare");

  const sp = await searchParams;
  const novlar = (sp.nov ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as OperationKind[];

  // SOFT-DELETE STANDARTI (#13): standartda silinmiş/ləğv görünmür; icazə ilə "Hamısı"
  const { readRecordStatusFromSearch } = await import("@/lib/soft-delete/record-filter");
  const { filter: recordStatus, canSeeDeleted } = await readRecordStatusFromSearch(
    sp as Record<string, string | string[] | undefined>,
  );

  const [items, opts] = await Promise.all([
    getTradeOperations({
      novlar: novlar.length ? novlar : undefined,
      search: sp.q,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
      anbar_id: sp.anbar ? Number(sp.anbar) : undefined,
      kontragent_id: sp.kontragent || undefined,
      status: sp.status ? sp.status.split(",") : undefined,
      recordStatus,
    }),
    getOperationFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Əməliyyatlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bütün ticarət əməliyyatları bir yerdə: satış, alış, qaytarma, transfer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* «Yeni əməliyyat» düyməsi indi TicaretSubNav-da sabit görünür */}
          <RecordStatusFilter canSeeDeleted={canSeeDeleted} />
          <RefreshButton />
        </div>
      </div>

      <TicaretSubNav active="/ticaret/emeliyyat" />

      <OperationsFilters
        anbarlar={opts.anbarlar}
        musteriler={opts.musteriler}
        techizatcilar={opts.techizatcilar}
      />

      <OperationsTable
        items={items}
        total={items.length}
        canPaySale={canPaySale}
        canCancelSale={canCancelSale}
        canReceivePurchase={canReceivePurchase}
        canCancelPurchase={canCancelPurchase}
      />
    </div>
  );
}
