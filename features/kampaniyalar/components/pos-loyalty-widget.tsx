"use client";

import { useEffect, useState, useTransition } from "react";
import { Star, Wallet, Loader2 } from "lucide-react";
import { findLoyaltyCard, type FoundLoyaltyCard } from "../actions";
import { TIER_META, type LoyaltyTier } from "../types";
import { cn, formatMoney } from "@/lib/utils";

type Props = {
  /** Müştəri ID — bu dəyişəndə loyalty kart axtarılır */
  kontragentId: string | null;
  /** Səbət cəmi — bonus istifadə limitini hesablamaq üçün */
  sebetCemi: number;
  /** Bonus dəyişiklikləri parent-ə bildirmək üçün */
  onBonusChange?: (kart: FoundLoyaltyCard | null, serfMebleg: number) => void;
  /** Loyalty ayarları (sahibkar konfiqurasiyasından gəlir) */
  maxSerfPct?: number;
  minSerfMebleg?: number;
};

/**
 * POS-da müştəri seçildikdə avtomatik loyalty kart məlumatı göstərir.
 * Bonus balansını çevirir, "Bonus ilə öde" düyməsi qoyur.
 */
export function PosLoyaltyWidget({
  kontragentId,
  sebetCemi,
  onBonusChange,
  maxSerfPct = 30,
  minSerfMebleg = 5,
}: Props) {
  const [card, setCard] = useState<FoundLoyaltyCard | null>(null);
  const [serf, setSerf] = useState<number>(0);
  const [pending, startTransition] = useTransition();

  // Müştəri dəyişəndə kartı yenilə
  useEffect(() => {
    if (!kontragentId) {
      setCard(null);
      setSerf(0);
      return;
    }
    startTransition(async () => {
      // Müştəri id ilə kart axtar — query string kimi göndərmək lazımdır,
      // findLoyaltyCard query-ad/telefon/kod axtarır. Bu API tələbə birbaşa
      // kontragent_id-ilə uyğun gəlmir. Müştəri ID-i ilə "kart yoxdur" tipini
      // ayırd etmək üçün adı sorğu kimi göndərək — daha sadə.
      // Ən sadə yol: yeni API yarat. Hələlik adı ilə tap.
      const found = await findLoyaltyCardByKontragent(kontragentId);
      setCard(found);
      setSerf(0);
      onBonusChange?.(found, 0);
    });
  }, [kontragentId, onBonusChange]);

  if (!kontragentId) return null;

  if (pending && !card) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50/40 px-2 py-1.5 text-xs">
        <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
        Loyalty kart yoxlanılır...
      </div>
    );
  }

  if (!card) {
    // Kart yoxdur — sadəcə kiçik xəbərdarlıq
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
        <Star className="mr-1 inline h-3 w-3" />
        Bu müştərinin loyalty kartı yoxdur
      </div>
    );
  }

  const tierMeta = TIER_META[card.tier as LoyaltyTier] ?? TIER_META.bronze;
  const maxSerfMebleg = Math.min(
    card.balans,
    Math.floor(sebetCemi * maxSerfPct) / 100,
  );
  const canSerf = card.balans >= minSerfMebleg && sebetCemi >= minSerfMebleg;

  function applyMax() {
    const target = Math.floor(maxSerfMebleg * 100) / 100;
    setSerf(target);
    onBonusChange?.(card, target);
  }

  function clearSerf() {
    setSerf(0);
    onBonusChange?.(card, 0);
  }

  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5 text-xs space-y-1.5",
        tierMeta.reng,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">{tierMeta.emoji}</span>
          <div className="min-w-0">
            <div className="font-bold leading-tight">{tierMeta.ad}</div>
            <code className="text-[9.5px] opacity-70 font-mono">{card.kart_kod}</code>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider opacity-70">Balans</div>
          <div className="font-bold tabular-nums">{formatMoney(card.balans)}</div>
        </div>
      </div>

      {canSerf && (
        <div className="flex items-center gap-1 border-t border-current/20 pt-1.5">
          {serf > 0 ? (
            <>
              <Wallet className="h-3 w-3" />
              <span className="flex-1 font-semibold tabular-nums">
                −{formatMoney(serf)} bonus tətbiq olunub
              </span>
              <button
                type="button"
                onClick={clearSerf}
                className="rounded border border-current/30 px-1.5 py-0.5 text-[10px] font-medium hover:bg-current/10"
              >
                Ləğv
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={applyMax}
              disabled={maxSerfMebleg < minSerfMebleg}
              className="w-full rounded border border-current/30 bg-current/10 px-2 py-0.5 text-[11px] font-bold transition hover:bg-current/20 disabled:opacity-50"
            >
              💰 Bonus ilə öde — maks {formatMoney(maxSerfMebleg)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Kontragent_id ilə birbaşa kart axtarmaq üçün helper.
// findLoyaltyCard yalnız query-string ilə işləyir, biz isə id-ilə istəyirik.
// Server action-a yeni helper əlavə edək.
async function findLoyaltyCardByKontragent(id: string): Promise<FoundLoyaltyCard | null> {
  const { getLoyaltyCardByKontragent } = await import("../actions");
  return getLoyaltyCardByKontragent(id);
}
