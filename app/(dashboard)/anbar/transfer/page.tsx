import type { Metadata } from "next";
import { ArrowLeftRight, Truck, Package, MapPin, RotateCw } from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { EmptyState } from "@/components/ui/empty-state";
import { TransferDialog } from "@/features/anbar/transfer/components/transfer-dialog";
import { AcceptTransferButton } from "@/features/anbar/transfer/components/transfer-accept";
import { TransferFilters } from "@/features/anbar/transfer/components/transfer-filters";
import { getTransfers, getTransferOptions } from "@/features/anbar/transfer/queries";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Anbar transferi" };
export const dynamic = "force-dynamic";

type SP = { status?: string; kaynak?: string; hedef?: string; from?: string; to?: string };

const STATUS_CLS: Record<string, string> = {
  tesdiqlenmemis: "bg-warning/15 text-warning border-warning/30",
  tesdiqlendi: "bg-success/15 text-success border-success/30",
  legv: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  tesdiqlenmemis: "Təsdiq gözlənir",
  tesdiqlendi: "Tamamlandı",
  legv: "Ləğv",
};

export default async function TransferPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const kaynakId = sp.kaynak ? Number(sp.kaynak) : undefined;
  const hedefId = sp.hedef ? Number(sp.hedef) : undefined;
  const hasFilters = !!(sp.status || sp.kaynak || sp.hedef || sp.from || sp.to);
  const [rows, options] = await Promise.all([
    getTransfers({
      status: sp.status,
      kaynakId: Number.isFinite(kaynakId) ? kaynakId : undefined,
      hedefId: Number.isFinite(hedefId) ? hedefId : undefined,
      from: sp.from,
      to: sp.to,
    }),
    getTransferOptions(),
  ]);
  const isEmptyAtAll = rows.length === 0 && !hasFilters;

  return (
    <div className="mx-auto max-w-7xl">
      <AnbarSubNav active="/anbar/transfer" />
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
              Anbarlararası transfer
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Bir anbardan digərinə məhsulun köçürülməsi.</p>
          </div>
          <TransferDialog anbarlar={options.anbarlar} products={options.products} />
        </header>

        {isEmptyAtAll ? (
          <EmptyState
            icon={Truck}
            tone="primary"
            title="Hələ transfer yoxdur"
            description="Transfer — bir anbardan digərinə malların köçürülməsidir. Audit qeydi avtomatik saxlanır."
            help="Mənbə anbardan mal çıxır, hədəf anbara daxil olur. Hər transfer Excel/PDF kimi ixrac edilə bilər. Barkod skanlama dəstəklənir."
            examples={[
              { icon: Package, title: "Mal axını",        desc: "Mərkəzi anbardan filiala məhsul göndər" },
              { icon: MapPin,  title: "Yenidən bölgü",    desc: "Az satılan anbardan çox satılana köçür" },
              { icon: RotateCw,title: "Sayım sonrası",     desc: "Sayım fərqlərini başqa anbara köçür" },
            ]}
          />
        ) : (
        <>
        <TransferFilters anbarlar={options.anbarlar.map((a) => ({ id: a.id, ad: a.ad }))} />

        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          <div className="overflow-x-auto" data-table-scroll>
            <table className="w-full text-sm" data-sticky-head>
              <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nömrə</th>
                  <th className="px-3 py-2">Tarix</th>
                  <th className="px-3 py-2">Mənbə anbar</th>
                  <th className="px-3 py-2">Hədəf anbar</th>
                  <th className="px-3 py-2 text-center">Sətir</th>
                  <th className="px-3 py-2 text-right">Cəmi miqdar</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    <Truck className="mx-auto mb-2 h-6 w-6 opacity-30" />
                    Hələ transfer yoxdur
                  </td></tr>
                )}
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-border/20 hover:bg-secondary/30">
                    <td className="px-3 py-2 font-mono text-xs font-semibold">{t.nomre}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(t.tarix)}</td>
                    <td className="px-3 py-2">{t.kaynak_anbar_ad}</td>
                    <td className="px-3 py-2">→ {t.hedef_anbar_ad}</td>
                    <td className="px-3 py-2 text-center text-xs">{t.satir_say}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatNumber(t.umumi_miqdar, 2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[t.status] ?? STATUS_CLS.tesdiqlenmemis}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {t.status === "tesdiqlenmemis" && <AcceptTransferButton id={t.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
