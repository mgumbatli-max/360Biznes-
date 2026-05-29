import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getSaleDetail } from "@/features/ticaret/satis-queries";
import { PrintControls } from "@/features/ticaret/components/print-controls";
import { formatMoney, formatNumber, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Satış qəbzi" };
export const dynamic = "force-dynamic";

async function getCompany() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.sahibkarlar.findUnique({
      where: { id: sahibkarId },
      select: {
        ad: true,
        voen: true,
        telefon: true,
        unvan: true,
        loqo_url: true,
        email: true,
      },
    });
  });
}

const PAYMENT_LABEL: Record<string, string> = {
  negd: "Nağd",
  kart: "Kart",
  kecirme: "Köçürmə",
  nisye: "Nisyə (borc)",
  borc: "Borc",
};

export default async function SaleReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { id } = await params;
  const { format } = await searchParams;
  const isThermal = format === "thermal";

  const [sale, company] = await Promise.all([getSaleDetail(id), getCompany()]);
  if (!sale) notFound();

  const umumi = Number(sale.umumi_mebleg ?? 0);
  const endirim = Number(sale.endirim_mebleg ?? 0);
  const son = Number(sale.son_mebleg ?? 0);
  const odenilmis = Number(sale.odenilmis ?? 0);
  const qaliq = son - odenilmis;

  return (
    <div className="min-h-screen bg-secondary/30 print:bg-white">
      <PrintControls saleId={sale.id} isThermal={isThermal} />

      <main className="mx-auto print:m-0 print:max-w-none">
        <div
          className={`mx-auto bg-white text-black shadow-lg print:shadow-none ${
            isThermal ? "max-w-[80mm] p-4 text-xs" : "max-w-[210mm] p-10"
          }`}
          style={{ minHeight: isThermal ? "auto" : "297mm" }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-black/20 pb-4">
            <div className="space-y-0.5">
              {company?.loqo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img loading="lazy" decoding="async" src={company.loqo_url} alt="" className="mb-2 h-12 w-auto object-contain" />
              )}
              <h1 className={`font-bold ${isThermal ? "text-base" : "text-2xl"}`}>
                {company?.ad ?? "Şirkət"}
              </h1>
              {company?.voen && <div className="text-xs text-black/60">VÖEN: {company.voen}</div>}
              {company?.telefon && (
                <div className="text-xs text-black/60">Tel: {company.telefon}</div>
              )}
              {company?.unvan && (
                <div className="text-xs text-black/60 max-w-[220px]">{company.unvan}</div>
              )}
            </div>

            <div className="text-right">
              <div className={`font-bold ${isThermal ? "text-sm" : "text-lg"}`}>SATIŞ QƏBZİ</div>
              <div className="font-mono text-xs mt-0.5">{sale.nomre}</div>
              <div className="text-xs text-black/60 mt-1">{formatDate(sale.tarix)}</div>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 py-4 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/50">Müştəri</div>
              <div className="font-semibold">{sale.kontragentler?.ad ?? "Pərakəndə"}</div>
              {sale.kontragentler?.telefon && (
                <div className="text-black/60">{sale.kontragentler.telefon}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-black/50">Satıcı</div>
              <div className="font-semibold">
                {sale.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler?.ad_soyad ??
                  sale.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? "—"}
              </div>
              {sale.anbarlar?.ad && (
                <div className="text-black/60">Anbar: {sale.anbarlar.ad}</div>
              )}
            </div>
          </section>

          <table className="w-full text-xs">
            <thead className="border-y border-black/20">
              <tr>
                <th className="py-1.5 text-left font-semibold">Məhsul</th>
                <th className="py-1.5 text-right font-semibold">Say</th>
                <th className="py-1.5 text-right font-semibold">Qiymət</th>
                <th className="py-1.5 text-right font-semibold">Cəm</th>
              </tr>
            </thead>
            <tbody>
              {sale.satis_sifaris_satirlari.map((line) => (
                <tr key={line.id} className="border-b border-dashed border-black/10">
                  <td className="py-1.5 pr-1">
                    <div className="font-medium">{line.mehsullar?.ad ?? "—"}</div>
                    {line.mehsullar?.kod && (
                      <div className="font-mono text-[10px] text-black/50">{line.mehsullar.kod}</div>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatNumber(Number(line.miqdar), 0)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatMoney(Number(line.vahid_qiymet))}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">
                    {formatMoney(Number(line.cemi ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="mt-4 space-y-1 border-t border-black/20 pt-3 text-xs">
            <Row label="Cəm" value={formatMoney(umumi)} />
            {endirim > 0 && <Row label="Endirim" value={`- ${formatMoney(endirim)}`} />}
            <Row label="YEKUN" value={formatMoney(son)} bold />
            <Row
              label={`Ödəniş (${PAYMENT_LABEL[sale.odenis_nov ?? "negd"] ?? sale.odenis_nov})`}
              value={formatMoney(odenilmis)}
            />
            {qaliq > 0 && <Row label="Qalıq (borc)" value={formatMoney(qaliq)} bold />}
          </section>

          {sale.qeyd && (
            <p className="mt-4 border-t border-black/10 pt-3 text-[11px] text-black/60 whitespace-pre-line">
              {sale.qeyd}
            </p>
          )}

          <footer className="mt-8 border-t border-black/20 pt-3 text-center text-[10px] text-black/50">
            Təşəkkür edirik! Geri qaytarma qəbzlə birgə 14 gün ərzində mümkündür.
            <div className="mt-1">
              {company?.ad ?? "—"} · {formatDate(new Date(), { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-sm font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
