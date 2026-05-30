import type { Metadata } from "next";
import { Tag, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { BrandDialog } from "@/features/anbar/components/brand-dialog";
import { BrandFilters } from "@/features/anbar/components/brand-filters";
import { BrandList } from "@/features/anbar/components/brand-list";
import { ViewModeToggle } from "@/features/anbar/components/view-mode-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { getBrands, type BrandFilter } from "@/features/anbar/queries";

export const metadata: Metadata = { title: "Markalar" };

type SP = {
  q?: string;
  aktiv?: string;
  logo?: string;
  has?: string;
  sirala?: string;
  view?: string;
};

function parseBool(v: string | undefined): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export default async function MarkalarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filter: BrandFilter = {
    search: sp.q,
    aktiv_durum: (sp.aktiv as BrandFilter["aktiv_durum"]) ?? "aktiv",
    has_logo: parseBool(sp.logo),
    sirala: sp.sirala,
  };
  const allBrands = await getBrands(filter);
  const hasProducts = parseBool(sp.has);
  const brands = hasProducts === undefined
    ? allBrands
    : allBrands.filter((b) => (hasProducts ? b.mehsul_sayi > 0 : b.mehsul_sayi === 0));

  return (
    <div className="mx-auto max-w-6xl">
      <AnbarSubNav active="/anbar/markalar" />
      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Markalar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Brend siyahısı və hər markada olan məhsul sayı.
            </p>
          </div>
          <BrandDialog />
        </header>

        <BrandFilters />

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{brands.length} marka</div>
          <ViewModeToggle defaultView="table" listLabel="Cədvəl" gridLabel="Kvadrat" />
        </div>

        {brands.length === 0 ? (
          <EmptyState
            icon={Tag}
            tone="primary"
            title={sp.q || sp.aktiv !== "aktiv" || sp.has ? "Filtrə uyğun marka yoxdur" : "Hələ marka yoxdur"}
            description={
              sp.q || sp.aktiv !== "aktiv" || sp.has
                ? "Filtri sıfırlayın və ya yeni marka əlavə edin."
                : "Məhsulları markalara ayırmaq üçün ilk markanızı əlavə edin (məs. Apple, Samsung)."
            }
            help="Marka — istehsalçı brendidir. Hər məhsul bir markaya bağlanır və filtrlərdə istifadə olunur. Logo yükləyə bilərsiniz, yoxsa avtomatik təyin olunur."
          />
        ) : sp.view === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {brands.map((b) => (
              <Card key={b.id} className={`glass ${!b.aktiv && "opacity-60"}`}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start gap-3">
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async" src={b.logo_url} alt={b.ad} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-muted-foreground">
                        <Tag className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{b.ad}</h3>
                        {!b.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                      </div>
                      {b.qeyd && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{b.qeyd}</p>
                      )}
                    </div>
                    <BrandDialog
                      initial={{ id: b.id, ad: b.ad, qeyd: b.qeyd ?? null, aktiv: b.aktiv, logo_url: b.logo_url }}
                      trigger="edit"
                    />
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {b.mehsul_sayi} məhsul
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <BrandList brands={brands} />
        )}
      </div>
    </div>
  );
}
