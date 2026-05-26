import type { Metadata } from "next";
import { Users, CreditCard, AlertCircle, UserCheck } from "lucide-react";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { ContactDialog } from "@/features/elaqe/components/contact-dialog";
import { ContactSearch } from "@/features/elaqe/components/contact-search";
import { ContactsTable } from "@/features/elaqe/components/contacts-table";
import { SegmentTabs } from "@/features/elaqe/components/segment-tabs";
import {
  getContacts,
  getManagers,
  getContactSegmentCounts,
  type ContactFilter,
  type SortKey,
} from "@/features/elaqe/queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Müştərilər" };
export const dynamic = "force-dynamic";

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

export default async function MusterilerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = (sp.filter ?? "").toLowerCase();
  const filter: ContactFilter = {
    nov: "musteri",
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
  const [data, managers, segments] = await Promise.all([
    getContacts(filter, page, PAGE_SIZE),
    getManagers(),
    getContactSegmentCounts("musteri"),
  ]);
  const { items, total, stats } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Müştərilər</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Qiymət növü üzrə segmentlərlə: pərakəndə, topdan, diller, VIP. Tez seçim üçün yuxarıdan tab klikləyin.
          </p>
        </div>
        <ContactDialog defaultNov="musteri" managers={managers} />
      </header>

      {/* Segment tabs by price tier */}
      <SegmentTabs
        basePath="/elaqe/musteriler"
        current={sp.qiymet}
        data={segments}
        nov="musteri"
        searchParams={sp}
      />

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

      <ContactSearch
        basePath="/elaqe/musteriler"
        managers={managers}
        countries={segments.countries}
        cities={segments.cities}
      />

      <ContactsTable
        items={items}
        total={total}
        defaultNov="musteri"
        managers={managers}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/elaqe/musteriler"
      />
    </div>
  );
}
