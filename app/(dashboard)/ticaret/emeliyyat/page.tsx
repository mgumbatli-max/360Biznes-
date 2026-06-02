import type { Metadata } from "next";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { RefreshButton } from "@/components/refresh-button";
import { OperationsTable } from "@/features/ticaret/components/operations-table";
import { OperationsFilters } from "@/features/ticaret/components/operations-filters";
import { NewOperationButton } from "@/features/ticaret/components/new-operation-dialog";
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
  await requireTicaretPerm();

  const sp = await searchParams;
  const novlar = (sp.nov ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as OperationKind[];

  const [items, opts] = await Promise.all([
    getTradeOperations({
      novlar: novlar.length ? novlar : undefined,
      search: sp.q,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
      anbar_id: sp.anbar ? Number(sp.anbar) : undefined,
      kontragent_id: sp.kontragent || undefined,
      status: sp.status ? sp.status.split(",") : undefined,
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
          <NewOperationButton />
          <RefreshButton />
        </div>
      </div>

      <TicaretSubNav active="/ticaret/emeliyyat" />

      <OperationsFilters
        anbarlar={opts.anbarlar}
        musteriler={opts.musteriler}
        techizatcilar={opts.techizatcilar}
      />

      <OperationsTable items={items} total={items.length} />
    </div>
  );
}
