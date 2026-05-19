import type { Metadata } from "next";
import { Tags, Search } from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { PriceRow } from "@/features/anbar/qiymet/components/price-row";
import { BulkAdjust } from "@/features/anbar/qiymet/components/bulk-adjust";
import { PriceRulesButton } from "@/features/anbar/qiymet/components/price-rules";
import { getQiymetList } from "@/features/anbar/qiymet/queries";

export const metadata: Metadata = { title: "Qiymət mərkəzi" };
export const dynamic = "force-dynamic";

type SP = { q?: string };

export default async function QiymetPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const rows = await getQiymetList(sp.q);

  return (
    <div className="mx-auto max-w-[1500px]">
      <AnbarSubNav active="/anbar/qiymet" />
      <div className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Tags className="h-6 w-6 text-primary" />
              Qiymət mərkəzi
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bütün qiymət səviyyələrini bir cədvəldə redaktə et: alış, satış, endirim, min, topdan, partnyor, VIP. Marja avtomatik hesablanır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PriceRulesButton />
            <BulkAdjust />
          </div>
        </header>

        <form className="rounded-xl border border-border bg-card/40 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="🔍 Məhsul axtar (ad, kod, barkod) — Enter ilə filtr"
              className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
            />
          </div>
        </form>

        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          <div className="overflow-x-auto" data-table-scroll>
            <table className="w-full text-sm" data-sticky-head>
              <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-[240px]">Məhsul</th>
                  <th className="px-2 py-2 text-right w-[100px]">Maya (Alış)</th>
                  <th colSpan={6} className="px-2 py-2 text-center">Qiymət səviyyələri</th>
                  <th className="px-2 py-2 w-[70px]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    <Tags className="mx-auto mb-2 h-6 w-6 opacity-30" />
                    Məhsul tapılmadı
                  </td></tr>
                )}
                {rows.map((r) => <PriceRow key={r.id} row={r} />)}
              </tbody>
            </table>
          </div>
          {rows.length >= 200 && (
            <div className="border-t border-border/40 p-2 text-center text-xs text-muted-foreground">
              İlk 200 məhsul göstərilir. Filterlə dəqiqləşdirin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
