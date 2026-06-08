import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { PurchasePrintControls } from "@/features/ticaret/components/purchase-print-controls";
import { formatMoney, formatNumber, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Alış qaiməsi" };

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

async function getPurchase(id: string) {
  return withTenant(async () =>
    prisma.alis_sifarisleri.findUnique({
      where: { id },
      include: {
        kontragentler: { select: { ad: true, telefon: true, voen: true, unvan: true } },
        anbarlar: { select: { ad: true } },
        istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
        alis_sifaris_satirlari: {
          orderBy: { id: "asc" },
          include: { mehsullar: { select: { ad: true, kod: true } } },
        },
      },
    }),
  );
}

export default async function PurchaseReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [purchase, company] = await Promise.all([getPurchase(id), getCompany()]);
  if (!purchase) notFound();

  const umumi = Number(purchase.umumi_mebleg ?? 0);
  const odenilmis = Number(purchase.odenilmis ?? 0);
  const qaliq = umumi - odenilmis;
  const elaveXerc = Number(purchase.elave_xerc ?? 0);

  return (
    <div className="min-h-screen bg-secondary/30 print:bg-white">
      <PurchasePrintControls purchaseId={purchase.id} />

      <main className="mx-auto print:m-0 print:max-w-none">
        <div
          className="mx-auto max-w-[210mm] bg-white p-10 text-black shadow-lg print:shadow-none"
          style={{ minHeight: "297mm" }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-black/20 pb-4">
            <div className="space-y-0.5">
              {company?.loqo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img loading="lazy" decoding="async" src={company.loqo_url} alt="" className="mb-2 h-12 w-auto object-contain" />
              )}
              <h1 className="text-2xl font-bold">{company?.ad ?? "Şirkət"}</h1>
              {company?.voen && <div className="text-xs text-black/60">VÖEN: {company.voen}</div>}
              {company?.telefon && <div className="text-xs text-black/60">Tel: {company.telefon}</div>}
              {company?.unvan && (
                <div className="max-w-[220px] text-xs text-black/60">{company.unvan}</div>
              )}
            </div>

            <div className="text-right">
              <div className="text-lg font-bold">ALIŞ QAİMƏSİ</div>
              <div className="mt-0.5 font-mono text-xs">{purchase.nomre}</div>
              <div className="mt-1 text-xs text-black/60">{formatDate(purchase.tarix)}</div>
              {purchase.qaime_nomre && (
                <div className="text-xs text-black/60">Qaimə №: {purchase.qaime_nomre}</div>
              )}
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 py-4 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/50">Təchizatçı</div>
              <div className="font-semibold">{purchase.kontragentler?.ad ?? "—"}</div>
              {purchase.kontragentler?.voen && (
                <div className="text-black/60">VÖEN: {purchase.kontragentler.voen}</div>
              )}
              {purchase.kontragentler?.telefon && (
                <div className="text-black/60">{purchase.kontragentler.telefon}</div>
              )}
              {purchase.kontragentler?.unvan && (
                <div className="text-black/60">{purchase.kontragentler.unvan}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-black/50">Qəbul edən</div>
              <div className="font-semibold">
                {purchase.istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? "—"}
              </div>
              {purchase.anbarlar?.ad && (
                <div className="text-black/60">Anbar: {purchase.anbarlar.ad}</div>
              )}
              <div className="text-black/60">
                Status: {purchase.status === "qebul_edildi" ? "Qəbul edildi" : purchase.status === "legv" ? "Ləğv" : "Gözləmədə"}
              </div>
            </div>
          </section>

          <table className="w-full text-xs">
            <thead className="border-y border-black/20">
              <tr>
                <th className="py-1.5 text-left font-semibold">Məhsul</th>
                <th className="py-1.5 text-right font-semibold">Say</th>
                <th className="py-1.5 text-right font-semibold">Vahid qiymət</th>
                <th className="py-1.5 text-right font-semibold">Cəm</th>
              </tr>
            </thead>
            <tbody>
              {purchase.alis_sifaris_satirlari.map((line) => (
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
            <Row label="Sətirlər cəmi" value={formatMoney(umumi - elaveXerc)} />
            {elaveXerc > 0 && (
              <Row label="Əlavə xərc (gömrük, çatdırılma)" value={`+ ${formatMoney(elaveXerc)}`} />
            )}
            <Row label="YEKUN" value={formatMoney(umumi)} bold />
            <Row label="Ödənilmiş" value={formatMoney(odenilmis)} />
            {qaliq > 0 && <Row label="Qalıq (təchizatçıya borc)" value={formatMoney(qaliq)} bold />}
          </section>

          {purchase.qeyd && (
            <p className="mt-4 whitespace-pre-line border-t border-black/10 pt-3 text-[11px] text-black/60">
              {purchase.qeyd}
            </p>
          )}

          <footer className="mt-8 border-t border-black/20 pt-3 text-center text-[10px] text-black/50">
            {company?.ad ?? "—"} · {formatDate(new Date(), { day: "2-digit", month: "long", year: "numeric" })}
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
