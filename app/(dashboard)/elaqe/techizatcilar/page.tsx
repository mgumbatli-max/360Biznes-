import type { Metadata } from "next";
import Link from "next/link";
import { Truck, CreditCard, UserCheck, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordStatusFilter } from "@/components/ui/record-status-filter";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { ContactDialog } from "@/features/elaqe/components/contact-dialog";
import { ContactSearch } from "@/features/elaqe/components/contact-search";
import { ContactsTable } from "@/features/elaqe/components/contacts-table";
import { SegmentTabs } from "@/features/elaqe/components/segment-tabs";
import { SavedUrlFiltersChip } from "@/features/elaqe/components/saved-url-filters-chip";
import {
  getContacts,
  getManagers,
  getContactSegmentCounts,
  type ContactFilter,
  type SortKey,
} from "@/features/elaqe/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Təchizatçılar" };

type SearchParams = {
  q?: string;
  borc?: string;
  qiymet?: string;
  status?: string;
  menecer?: string;
  olke?: string;
  sheher?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const PAGE_SIZE = 50;

export default async function TechizatcilarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { requireElaqePerm } = await import("@/features/elaqe/access-guard");
  await requireElaqePerm("techizatci.oxu");

  const sp = await searchParams;
  const { readRecordStatusFromSearch } = await import("@/lib/soft-delete/record-filter");
  const { filter: recordStatus, canSeeDeleted } = await readRecordStatusFromSearch(
    sp as Record<string, string | string[] | undefined>,
  );
  const filter: ContactFilter = {
    nov: "techizatci",
    search: sp.q,
    borc: (sp.borc as ContactFilter["borc"]) ?? "any",
    qiymet_tipi: sp.qiymet,
    status: (sp.status as ContactFilter["status"]) ?? "aktiv",
    menecer_id: sp.menecer,
    olke: sp.olke,
    sheher: sp.sheher,
    sort: (sp.sort as SortKey) ?? "yaradildi",
    dir: (sp.dir as "asc" | "desc") ?? "desc",
    recordStatus,
  };

  const page = Math.max(1, Number(sp.page) || 1);
  const [data, managers, segments] = await Promise.all([
    getContacts(filter, page, PAGE_SIZE),
    getManagers(),
    getContactSegmentCounts("techizatci"),
  ]);
  const { items, total, stats } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Təchizatçılar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mal və xidmət göndərənlər — kateqoriya və ölkə üzrə tez filtr.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecordStatusFilter canSeeDeleted={canSeeDeleted} />
          <SavedUrlFiltersChip storageKey="techizatcilar" basePath="/elaqe/techizatcilar" />
          <Link href="/ayarlar/inteqrasiya?key=techizatci">
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel idxal
            </Button>
          </Link>
          <ContactDialog defaultNov="techizatci" managers={managers} />
        </div>
      </header>

      <SegmentTabs
        basePath="/elaqe/techizatcilar"
        current={sp.qiymet}
        data={segments}
        nov="techizatci"
        searchParams={sp}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Truck} label="Filtrdə" value={String(stats.count)} subline={`${segments.total} cəmi`} />
        <KpiCard icon={UserCheck} label="Aktiv" value={String(stats.aktiv_count)} subline="Aktiv qeydlər" tone="success" />
        <KpiCard
          icon={AlertCircle}
          label="Borclu"
          value={String(stats.borclu_count)}
          subline={`${segments.borclu_say} cəmi`}
          tone={stats.borclu_count > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={CreditCard}
          label="Onlara borcumuz"
          value={formatMoney(Math.abs(Math.min(0, stats.total_borc)))}
          subline="Mənfi balans"
          tone="warning"
        />
      </section>

      <ContactSearch
        basePath="/elaqe/techizatcilar"
        managers={managers}
        countries={segments.countries}
        cities={segments.cities}
      />

      <ContactsTable
        items={items}
        total={total}
        defaultNov="techizatci"
        managers={managers}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/elaqe/techizatcilar"
      />
    </div>
  );
}
