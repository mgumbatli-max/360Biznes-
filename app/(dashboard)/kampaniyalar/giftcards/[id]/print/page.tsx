import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { PrintButton } from "@/features/kampaniyalar/components/print-button";
import { formatMoney, formatDate } from "@/lib/utils";

async function getGiftCard(id: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [card, sahibkar] = await Promise.all([
      prisma.gift_cards.findFirst({
        where: { id },
        include: { kontragentler: { select: { ad: true, telefon: true } } },
      }),
      prisma.sahibkarlar.findUnique({ where: { id: sahibkarId }, select: { ad: true } }),
    ]);
    return { card, sahibkar };
  });
}

export default async function GiftCardPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { card, sahibkar } = await getGiftCard(id);
  if (!card) notFound();

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(card.kart_kod)}&margin=0`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <CreditCard className="h-5 w-5 text-fuchsia-500" /> Hədiyyə kartı — çap üçün
        </h1>
        <PrintButton />
      </div>

      <p className="text-xs text-muted-foreground print:hidden">
        💡 Standart bank kartı ölçüsü (85.6 × 54 mm). Brauzerin print menyusunda <b>"Save as PDF"</b> seçimi ilə saxlayın.
      </p>

      {/* Ön tərəf — premium gradient */}
      <div className="grid place-items-center">
        <div
          className="relative w-[85.6mm] h-[54mm] overflow-hidden rounded-xl p-4 text-white shadow-2xl"
          style={{ background: "linear-gradient(135deg, #db2777, #9333ea, #4f46e5)" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[8px] uppercase tracking-[0.2em] opacity-80">HƏDIYYƏ KARTI</div>
              <div className="mt-0.5 text-base font-black tracking-tight">{sahibkar?.ad ?? "360Biznes"}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl">🎁</div>
            </div>
          </div>

          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2">
            <div className="text-[8px] uppercase tracking-wider opacity-70">Dəyər</div>
            <div className="text-3xl font-black tabular-nums">{formatMoney(Number(card.nominal))}</div>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="font-mono text-base font-bold tracking-wider">{card.kart_kod}</div>
            {card.kontragentler && (
              <div className="mt-0.5 text-[9px] opacity-80">Sahibi: {card.kontragentler.ad}</div>
            )}
            {card.bitme_tarixi && (
              <div className="text-[8px] opacity-70">
                Bitir: {formatDate(card.bitme_tarixi, { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            )}
          </div>

          <div className="absolute -right-12 -bottom-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        </div>
      </div>

      {/* Arxa tərəf — QR + təlimat */}
      <div className="grid place-items-center">
        <div className="w-[85.6mm] h-[54mm] rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="grid h-full grid-cols-[auto_1fr] gap-3">
            <div className="grid place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt={card.kart_kod} className="h-[34mm] w-[34mm] object-contain" />
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Necə istifadə</div>
                <p className="text-[9px] leading-snug text-muted-foreground">
                  POS-da kartı təqdim edin və ya kodu daxil etdirin. Karta yüklənmiş məbləğ ödənişdə istifadə olunur.
                </p>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Qalıq</div>
                <div className="text-sm font-bold tabular-nums text-fuchsia-500">{formatMoney(Number(card.qaliq))}</div>
              </div>
              <div className="text-[7.5px] font-mono text-muted-foreground">{card.kart_kod}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@media print { @page { size: A4; margin: 10mm; } body { background: white; } }`}</style>
    </div>
  );
}
