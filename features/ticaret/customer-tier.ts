import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type CustomerTier =
  | "adi"
  | "perakende"
  | "topdan"
  | "partnyor"
  | "vip";

export type CustomerTierInfo = {
  musteri_id: string;
  musteri_ad: string;
  qiymet_tipi: CustomerTier;
  borc: number;
  borc_limiti: number | null;
  voen: string | null;
  telefon: string | null;
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  adi:        { label: "Adi",        color: "bg-secondary text-foreground" },
  perakende:  { label: "Pərakəndə",  color: "bg-info/15 text-info" },
  topdan:     { label: "Topdan",     color: "bg-success/15 text-success" },
  partnyor:   { label: "Partnyor",   color: "bg-warning/15 text-warning" },
  vip:        { label: "VIP",        color: "bg-primary/15 text-primary-light" },
};

export function tierLabel(tier: string): { label: string; color: string } {
  return TIER_LABELS[tier] ?? TIER_LABELS.adi;
}

/**
 * Get the price tier and credit info of a customer. Used by POS, sale and
 * quote forms to auto-apply correct pricing and to validate credit limits.
 */
export async function getCustomerPriceTier(musteriId: string): Promise<CustomerTierInfo | null> {
  return withTenant(async () => {
    const c = await prisma.kontragentler.findUnique({
      where: { id: musteriId },
      select: {
        id: true,
        ad: true,
        qiymet_tipi: true,
        borc: true,
        borc_limiti: true,
        voen: true,
        telefon: true,
      },
    });
    if (!c) return null;
    return {
      musteri_id: c.id,
      musteri_ad: c.ad,
      qiymet_tipi: (c.qiymet_tipi as CustomerTier) ?? "adi",
      borc: Number(c.borc ?? 0),
      borc_limiti: c.borc_limiti === null || c.borc_limiti === undefined ? null : Number(c.borc_limiti),
      voen: c.voen,
      telefon: c.telefon,
    };
  });
}

/**
 * Check whether adding `addAmount` to customer's current debt would exceed
 * their credit limit. Returns ok=true when no limit configured.
 */
export async function checkCustomerCreditLimit(
  musteriId: string,
  addAmount: number
): Promise<
  | { ok: true; current: number; limit: number | null; available: number | null }
  | { ok: false; current: number; limit: number; addAmount: number; over: number }
> {
  return withTenant(async () => {
    const c = await prisma.kontragentler.findUnique({
      where: { id: musteriId },
      select: { borc: true, borc_limiti: true },
    });
    const current = Number(c?.borc ?? 0);
    const limit = c?.borc_limiti === null || c?.borc_limiti === undefined ? null : Number(c.borc_limiti);
    if (limit === null) {
      return { ok: true, current, limit: null, available: null };
    }
    const next = current + addAmount;
    if (next > limit) {
      return {
        ok: false,
        current,
        limit,
        addAmount,
        over: next - limit,
      };
    }
    return { ok: true, current, limit, available: limit - next };
  });
}
