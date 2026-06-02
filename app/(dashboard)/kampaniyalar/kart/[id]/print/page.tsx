import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { TIER_META, type LoyaltyTier } from "@/features/kampaniyalar/types";
import { PrintButton } from "@/features/kampaniyalar/components/print-button";
import { cn } from "@/lib/utils";

async function getCardForPrint(id: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [card, sahibkar] = await Promise.all([
      prisma.loyalty_cards.findFirst({
        where: { id },
        include: { kontragentler: { select: { ad: true, telefon: true } } },
      }),
      prisma.sahibkarlar.findUnique({
        where: { id: sahibkarId },
        select: { ad: true },
      }),
    ]);
    return { card, sahibkar };
  });
}

export default async function CardPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { card, sahibkar } = await getCardForPrint(id);
  if (!card) notFound();

  const tierMeta = TIER_META[card.tier as LoyaltyTier] ?? TIER_META.bronze;
  // QR Code üçün açar (api.qrserver.com istifadə edilir — pulsuz, no-auth)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(card.kart_kod)}&margin=0`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:p-0">
      {/* Print toolbar — yalnız ekranda görünür */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Star className="h-5 w-5 text-amber-500" /> Loyalty kart — çap üçün
        </h1>
        <PrintButton />
      </div>

      <p className="text-xs text-muted-foreground print:hidden">
        💡 Brauzerin print menyusunda <b>"Save as PDF"</b> seçimi ilə kartı PDF kimi saxlaya bilərsən.
        Kart 85.6 × 54 mm ölçüsündə (standart bank kartı) çap olunur.
      </p>

      {/* Kart vizualı */}
      <div className="grid place-items-center">
        <div
          className={cn(
            "relative w-[85.6mm] h-[54mm] overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white shadow-2xl",
            tierMeta.reng.replace("border-", "from-").replace("/40", "").replace("bg-", "via-"),
          )}
          style={{
            background:
              card.tier === "platinum" ? "linear-gradient(135deg, #6d28d9, #9333ea, #c026d3)" :
              card.tier === "gold" ? "linear-gradient(135deg, #d97706, #f59e0b, #fbbf24)" :
              card.tier === "silver" ? "linear-gradient(135deg, #475569, #64748b, #94a3b8)" :
              "linear-gradient(135deg, #92400e, #b45309, #d97706)",
          }}
        >
          {/* Şirkət adı + tier */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[8px] uppercase tracking-[0.2em] opacity-80">SADIQLIK KARTI</div>
              <div className="mt-0.5 text-base font-black tracking-tight">{sahibkar?.ad ?? "360Biznes"}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl leading-none">{tierMeta.emoji}</div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider">{tierMeta.ad}</div>
            </div>
          </div>

          {/* Müştəri adı + kod */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-[8px] uppercase tracking-wider opacity-70">Sahib</div>
            <div className="truncate text-sm font-bold">{card.kontragentler.ad}</div>
            <div className="mt-1 font-mono text-base font-bold tracking-wider">{card.kart_kod}</div>
          </div>

          {/* Dekor — sağ-alt küncdə blob */}
          <div className="absolute -right-12 -bottom-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute right-4 bottom-12 h-1 w-12 rounded-full bg-white/40" />
        </div>
      </div>

      {/* Arxa tərəf — QR + barkod + təlimat */}
      <div className="grid place-items-center">
        <div className="w-[85.6mm] h-[54mm] rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="grid h-full grid-cols-[auto_1fr] gap-3">
            <div className="grid place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt={`QR: ${card.kart_kod}`} className="h-[34mm] w-[34mm] object-contain" />
            </div>
            <div className="flex flex-col justify-between">
              <div>
                <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Bonus topla</div>
                <div className="mt-0.5 text-xs font-bold">{tierMeta.bonusPct}% hər alışdan</div>
                {tierMeta.endirimPct > 0 && (
                  <div className="text-[10px] text-muted-foreground">+ {tierMeta.endirimPct}% endirim</div>
                )}
              </div>
              <div>
                <div className="text-[7.5px] uppercase tracking-wider text-muted-foreground">İstifadə</div>
                <p className="text-[8.5px] leading-snug text-muted-foreground">
                  Hər alışda kartı təqdim edin. Bonus avtomatik toplanır. Sonrakı alışda balansla ödəniş mümkündür.
                </p>
              </div>
              <div className="text-[7.5px] font-mono text-muted-foreground">{card.kart_kod}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

