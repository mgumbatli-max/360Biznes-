import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Users, CreditCard, AlertCircle, UserCheck, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { ContactDialog } from "@/features/elaqe/components/contact-dialog";
import { ContactSearch } from "@/features/elaqe/components/contact-search";
import { ContactsTable } from "@/features/elaqe/components/contacts-table";
import { RecordStatusFilter } from "@/components/ui/record-status-filter";
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
import { liteGate } from "@/lib/lite/config";

export const metadata: Metadata = { title: "Müştərilər" };

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
  yatmis?: string;
  dogum_ay?: string;
  vip?: string;
  qara?: string;
  yeni?: string;
  filter?: string;
  page?: string;
};

const PAGE_SIZE = 50;

function KpiSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </section>
  );
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

async function HeaderDialog({ managersP }: { managersP: ReturnType<typeof getManagers> }) {
  const managers = await managersP;
  return <ContactDialog defaultNov="musteri" managers={managers} />;
}

async function SegmentTabsBlock({
  sp,
  segmentsP,
}: {
  sp: SearchParams;
  segmentsP: ReturnType<typeof getContactSegmentCounts>;
}) {
  const segments = await segmentsP;
  return (
    <SegmentTabs
      basePath="/elaqe/musteriler"
      current={sp.qiymet}
      data={segments}
      nov="musteri"
      searchParams={sp}
    />
  );
}

async function StatsKpis({
  dataP,
  segmentsP,
}: {
  dataP: ReturnType<typeof getContacts>;
  segmentsP: ReturnType<typeof getContactSegmentCounts>;
}) {
  const [data, segments] = await Promise.all([dataP, segmentsP]);
  const { stats } = data;
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard icon={Users} label="Filtrdə" value={String(stats.count)} subline={`${segments.total} cəmi`} />
      <KpiCard icon={UserCheck} label="Aktiv" value={String(stats.aktiv_count)} subline="Aktiv qeydlər" tone="success" />
      <KpiCard
        icon={AlertCircle}
        label="Borclu"
        value={String(stats.borclu_count)}
        subline={`${segments.borclu_say} cəmi borclu`}
        tone={stats.borclu_count > 0 ? "warning" : "neutral"}
      />
      <KpiCard
        icon={CreditCard}
        label="Cəmi borc"
        value={formatMoney(stats.total_borc > 0 ? stats.total_borc : 0)}
        subline="Bizə borclu"
        tone={stats.total_borc > 0 ? "warning" : "neutral"}
      />
    </section>
  );
}

async function SearchBlock({
  managersP,
  segmentsP,
}: {
  managersP: ReturnType<typeof getManagers>;
  segmentsP: ReturnType<typeof getContactSegmentCounts>;
}) {
  const [managers, segments] = await Promise.all([managersP, segmentsP]);
  return (
    <ContactSearch
      basePath="/elaqe/musteriler"
      managers={managers}
      countries={segments.countries}
      cities={segments.cities}
    />
  );
}

async function ContactsTableBlock({
  dataP,
  managersP,
  page,
}: {
  dataP: ReturnType<typeof getContacts>;
  managersP: ReturnType<typeof getManagers>;
  page: number;
}) {
  const [data, managers] = await Promise.all([dataP, managersP]);
  const { items, total } = data;
  return (
    <ContactsTable
      items={items}
      total={total}
      defaultNov="musteri"
      managers={managers}
      page={page}
      pageSize={PAGE_SIZE}
      basePath="/elaqe/musteriler"
    />
  );
}

export default async function MusterilerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { requireElaqePerm } = await import("@/features/elaqe/access-guard");
  await requireElaqePerm("musteri.oxu");

  const sp = await searchParams;
  const f = (sp.filter ?? "").toLowerCase();
  const { readRecordStatusFromSearch } = await import("@/lib/soft-delete/record-filter");
  const { filter: recordStatus, canSeeDeleted } = await readRecordStatusFromSearch(
    sp as Record<string, string | string[] | undefined>,
  );
  const filter: ContactFilter = {
    nov: "musteri",
    recordStatus,
    search: sp.q,
    borc: (sp.borc as ContactFilter["borc"]) ?? (f === "borclu" ? "var" : "any"),
    qiymet_tipi: sp.qiymet,
    status: (sp.status as ContactFilter["status"]) ?? "aktiv",
    menecer_id: sp.menecer,
    olke: sp.olke,
    sheher: sp.sheher,
    sort: (sp.sort as SortKey) ?? "yaradildi",
    dir: (sp.dir as "asc" | "desc") ?? "desc",
    yatmis: sp.yatmis === "1" || f === "yatmis",
    dogum_ay: sp.dogum_ay === "1" || f === "dogum",
    vip: sp.vip === "1" || f === "vip",
    qara_siyahi: sp.qara === "1" || f === "qara",
    yeni: sp.yeni === "1" || f === "yeni",
  };

  const page = Math.max(1, Number(sp.page) || 1);
  // Promise-ləri page-də başlat — parallel resolve, hər Suspense eyni promise-i await edir
  const dataP = getContacts(filter, page, PAGE_SIZE);
  const managersP = getManagers();
  const segmentsP = getContactSegmentCounts("musteri");

  const lite = await liteGate("elaqe");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Müştərilər</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qiymət növü üzrə segmentlərlə: pərakəndə, topdan, diller, VIP. Tez seçim üçün yuxarıdan tab klikləyin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RecordStatusFilter canSeeDeleted={canSeeDeleted} />
          <SavedUrlFiltersChip storageKey="musteriler" basePath="/elaqe/musteriler" />
          <Link href="/ayarlar/inteqrasiya?key=musteri">
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel idxal
            </Button>
          </Link>
          <Suspense fallback={<Skeleton className="h-9 w-32 rounded-md" />}>
            <HeaderDialog managersP={managersP} />
          </Suspense>
        </div>
      </header>

      <Suspense fallback={<Skeleton className="h-10 w-full rounded-md" />}>
        <SegmentTabsBlock sp={sp} segmentsP={segmentsP} />
      </Suspense>

      {lite("ozet") && (
        <Suspense fallback={<KpiSkeleton />}>
          <StatsKpis dataP={dataP} segmentsP={segmentsP} />
        </Suspense>
      )}

      {lite("filtrler") && (
        <Suspense fallback={<Skeleton className="h-14 w-full rounded-md" />}>
          <SearchBlock managersP={managersP} segmentsP={segmentsP} />
        </Suspense>
      )}

      <Suspense fallback={<TableSkeleton />}>
        <ContactsTableBlock dataP={dataP} managersP={managersP} page={page} />
      </Suspense>
    </div>
  );
}
