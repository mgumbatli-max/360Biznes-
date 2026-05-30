import type { Metadata } from "next";
import Link from "next/link";
import { ScanBarcode, Clock } from "lucide-react";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { QuickReturnScanner } from "@/features/ticaret/components/quick-return-scanner";
import { getRecentReturns, getAnbarOptions } from "@/features/ticaret/qaytarma-tez-queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Tez qaytarma" };

export default async function QaytarmaTezPage() {
  const [history, anbarlar] = await Promise.all([getRecentReturns(10), getAnbarOptions()]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ScanBarcode className="h-6 w-6 text-primary-light" />
            Tez qaytarma
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Barkod skanı ilə bir-kliklə müştəri qaytarması. Stok dərhal artırılır.
          </p>
        </div>
        <Link
          href="/ticaret/qaytarma"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-secondary"
        >
          Bütün qaytarmalar
        </Link>
      </div>

      <TicaretSubNav active="/ticaret/qaytarma" />

      <QuickReturnScanner anbarlar={anbarlar} />

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Clock className="h-4 w-4" />
          Son 10 qaytarma
        </h3>
        {history.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Hələ qaytarma yoxdur.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Nömrə</th>
                  <th className="px-3 py-2.5">Tarix</th>
                  <th className="px-3 py-2.5">Məhsul</th>
                  <th className="px-3 py-2.5 text-center">Miqdar</th>
                  <th className="px-3 py-2.5">Müştəri</th>
                  <th className="px-3 py-2.5">Anbar</th>
                  <th className="px-3 py-2.5">Səbəb</th>
                  <th className="px-3 py-2.5 text-right">Məbləğ</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="px-3 py-2.5 font-mono text-xs">{r.nomre}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.yaradildi ? formatDate(r.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : formatDate(r.tarix)}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      {r.mehsul_ad ?? "—"}
                      {r.mehsul_kod && <small className="ml-1 text-muted-foreground">({r.mehsul_kod})</small>}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs">{r.miqdar}</td>
                    <td className="px-3 py-2.5 text-xs">{r.kontragent_ad ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs">{r.anbar_ad ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.sebeb ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatMoney(r.umumi_mebleg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
