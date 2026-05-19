import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Zəmanət talonu" };
export const dynamic = "force-dynamic";

async function getData(satisId: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const sale = await prisma.satis_sifarisleri.findFirst({
      where: { id: satisId, sahibkar_id: sahibkarId },
      include: {
        kontragentler: { select: { ad: true, telefon: true } },
        zemanetler: {
          orderBy: { yaradildi: "asc" },
        },
      },
    });
    const sahibkar = await prisma.sahibkarlar.findUnique({
      where: { id: sahibkarId },
      select: { ad: true, telefon: true, unvan: true, voen: true, loqo_url: true },
    });
    return { sale, sahibkar };
  });
}

export default async function ZemanetPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ satis?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in");
  const sp = await searchParams;
  const satisId = sp.satis;
  if (!satisId) notFound();

  const { sale, sahibkar } = await getData(satisId);
  if (!sale) notFound();
  const zemanetler = sale.zemanetler ?? [];

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-black">
      <style>{`
        @media print {
          @page { size: A5; margin: 8mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="mx-auto max-w-2xl">
        <div className="no-print mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white"
          >
            Çap et
          </button>
        </div>

        {zemanetler.length === 0 ? (
          <div className="rounded border border-gray-300 p-6 text-center text-sm">
            Bu satış üçün zəmanət qeydiyyatı yoxdur.
          </div>
        ) : (
          zemanetler.map((z) => (
            <article
              key={z.id}
              className="mb-6 break-after-page rounded border border-gray-300 p-6"
            >
              <header className="mb-4 flex items-start justify-between border-b border-gray-300 pb-3">
                <div>
                  <h1 className="flex items-center gap-2 text-xl font-bold">
                    <ShieldCheck className="h-5 w-5" /> Zəmanət talonu
                  </h1>
                  <div className="mt-1 font-mono text-xs">Kod: {z.unikal_kod}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold">{sahibkar?.ad ?? "—"}</div>
                  {sahibkar?.voen && <div>VÖEN: {sahibkar.voen}</div>}
                  {sahibkar?.telefon && <div>{sahibkar.telefon}</div>}
                  {sahibkar?.unvan && <div>{sahibkar.unvan}</div>}
                </div>
              </header>

              <section className="mb-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase text-gray-500">Müştəri</div>
                  <div className="font-medium">{z.musteri_ad ?? "—"}</div>
                  {z.musteri_telefon && (
                    <div className="text-xs">{z.musteri_telefon}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Satış №</div>
                  <div className="font-mono text-sm font-semibold">{sale.nomre}</div>
                  <div className="text-xs">{formatDate(sale.tarix)}</div>
                </div>
              </section>

              <section className="mb-3 rounded border border-gray-200 p-3 text-sm">
                <div className="font-semibold">{z.mehsul_ad ?? "—"}</div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-gray-700">
                  {z.serial_nomre && <div>SN: {z.serial_nomre}</div>}
                  {z.imei && <div>IMEI: {z.imei}</div>}
                  <div>Miqdar: {Number(z.miqdar ?? 1)}</div>
                </div>
                {z.satis_qiymeti != null && (
                  <div className="mt-2 text-right text-sm font-bold">
                    {formatMoney(Number(z.satis_qiymeti))}
                  </div>
                )}
              </section>

              <section className="mb-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase text-gray-500">Başlama</div>
                  <div className="font-medium">{formatDate(z.baslama_tarixi)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Bitmə</div>
                  <div className="font-medium">{formatDate(z.bitme_tarixi)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Müddət</div>
                  <div className="font-medium">{z.ay_sayi} ay</div>
                </div>
              </section>

              <footer className="mt-6 border-t border-gray-300 pt-3 text-[10px] leading-relaxed text-gray-700">
                Zəmanət şərtlərinə uyğun mexaniki nasazlıqlar pulsuz aradan
                qaldırılır. Səhv istifadə, mexaniki zərbə, su təması, qeyri-orijinal
                aksesuar nəticəsində yaranan nasazlıqlara zəmanət şamil olunmur.
                <div className="mt-3 flex justify-between font-mono">
                  <span>Müştəri imzası: ______________</span>
                  <span>Satıcı imzası: ______________</span>
                </div>
              </footer>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
