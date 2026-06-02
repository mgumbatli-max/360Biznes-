import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Clock, ShoppingBag } from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { BronDialog } from "@/features/anbar/bron/components/bron-dialog";
import { BronTable } from "@/features/anbar/bron/components/bron-table";
import { getBronList, getBronOptions, getBronStats, type BronStatus } from "@/features/anbar/bron/queries";
import { BronFilters } from "@/features/anbar/bron/components/bron-filters";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Bron" };

type SP = { status?: string; q?: string; anbar?: string; musteri?: string; from?: string; to?: string };

const FILTERS: { value: BronStatus; label: string }[] = [
  { value: "",             label: "Hamısı" },
  { value: "aktiv",        label: "Aktiv" },
  { value: "vaxti_bitdi",  label: "Vaxtı bitdi" },
  { value: "satish_oldu",  label: "Satışa çevrildi" },
  { value: "legv",         label: "Ləğv" },
];

export default async function BronPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { requireAnbarPerm } = await import("@/features/anbar/access-guard");
  await requireAnbarPerm("stok.bron");

  const sp = await searchParams;
  const status = (sp.status ?? "") as BronStatus;
  const anbarId = sp.anbar ? Number(sp.anbar) : undefined;
  const [rows, options, stats] = await Promise.all([
    getBronList({
      status,
      q: sp.q,
      anbarId: Number.isFinite(anbarId) ? anbarId : undefined,
      musteriId: sp.musteri,
      from: sp.from,
      to: sp.to,
    }),
    getBronOptions(),
    getBronStats(),
  ]);

  const hasNoData = stats.total === 0;
  const hasFilters = !!(sp.q || sp.anbar || sp.musteri || sp.from || sp.to || status);

  return (
    <div className="mx-auto max-w-7xl">
      <AnbarSubNav active="/anbar/bron" />
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bron</h1>
            <p className="mt-1 text-sm text-muted-foreground">Müştəri üçün məhsulun anbarda saxlanması.</p>
          </div>
          <BronDialog
            products={options.products}
            customers={options.customers}
            warehouses={options.warehouses}
          />
        </header>

        {hasNoData && !hasFilters ? (
          <EmptyState
            icon={Bookmark}
            tone="primary"
            title="Hələ bron yoxdur"
            description="Bron — müştəriniz sifariş verdi, lakin hələ pulu ödəmədi. Mal anbarda saxlanır və başqasına satılmır."
            help="Hər bronun bitmə tarixi olur. Vaxt keçəndə bron avtomatik 'Vaxtı bitdi' statusuna düşür. Müştəri pulu ödəyəndə bron 'Satışa çevrildi' olur və mal anbardan çıxır."
            examples={[
              { icon: ShoppingBag, title: "Hipotetik nümunə", desc: "Müştəri 'Ehtiyatdan saxla' deyir — 3 gün sonra alacaq" },
              { icon: Clock,       title: "Avtomatik bitmə",  desc: "Bitmə tarixi gələndə bron sönür və mal yenidən satışda görünür" },
            ]}
            actions={[
              {
                label: "Yeni bron yarat",
                tone: "primary",
                href: "/anbar/bron?yeni=1",
                icon: Bookmark,
              },
            ]}
          />
        ) : (
          <>
            <BronFilters
              anbarlar={options.warehouses}
              customers={options.customers.map((c) => ({ id: c.id, ad: c.ad, telefon: c.telefon }))}
            />

            <div className="inline-flex gap-0.5 rounded-xl border border-border bg-secondary/40 p-1">
              {FILTERS.map((f) => {
                const isOn = status === f.value;
                const count = f.value === "" ? stats.total : ((stats as Record<string, number>)[f.value] ?? 0);
                const href = f.value ? `/anbar/bron?status=${f.value}` : "/anbar/bron";
                return (
                  <Link
                    key={f.value}
                    href={href}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isOn ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label} <span className="ml-1 text-[10px] text-muted-foreground">{count}</span>
                  </Link>
                );
              })}
            </div>

            <BronTable rows={rows} />
          </>
        )}
      </div>
    </div>
  );
}
