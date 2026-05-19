import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const QRUP = "ticaret";
const ACAR_TIERS = "commission_tiers";
const ACAR_BONUS_TIER = "commission_bonus_tier";

/**
 * Tiered commission rule. Each tier defines a min-amount cut-off (AZN of
 * monthly sales) and a percent applied to sales within that bucket.
 *   [{ from: 0, percent: 1 }, { from: 5000, percent: 1.5 }, { from: 10000, percent: 2 }]
 *
 * Computation is "marginal":
 *   commission(total) = Σ percent_i * (clamp(total - from_i, 0) - clamp(total - from_{i+1}, 0))
 */
export type CommissionTier = { from: number; percent: number };

const DEFAULT_TIERS: CommissionTier[] = [
  { from: 0, percent: 1 },
  { from: 5000, percent: 1.5 },
  { from: 10000, percent: 2 },
];

export async function getCommissionTiers(): Promise<CommissionTier[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR_TIERS } },
    });
    if (!row?.deyer) return DEFAULT_TIERS;
    try {
      const parsed = JSON.parse(row.deyer);
      if (!Array.isArray(parsed)) return DEFAULT_TIERS;
      const tiers = parsed
        .map((p) => ({ from: Number(p.from), percent: Number(p.percent) }))
        .filter((t) => Number.isFinite(t.from) && Number.isFinite(t.percent))
        .sort((a, b) => a.from - b.from);
      return tiers.length > 0 ? tiers : DEFAULT_TIERS;
    } catch {
      return DEFAULT_TIERS;
    }
  });
}

export async function getBonusOnTarget(): Promise<number> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR_BONUS_TIER } },
    });
    const n = Number(row?.deyer ?? 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
}

export function computeCommissionFromTiers(total: number, tiers: CommissionTier[]): number {
  if (total <= 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.from - b.from);
  let commission = 0;
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].from;
    const next = i + 1 < sorted.length ? sorted[i + 1].from : Infinity;
    if (total <= from) break;
    const amountInTier = Math.min(total, next) - from;
    commission += amountInTier * (sorted[i].percent / 100);
  }
  return Math.round(commission * 100) / 100;
}

export type SalespersonCommission = {
  istifadeci_id: string;
  ad_soyad: string;
  ay: number;
  il: number;
  satis_mebleg: number;
  satis_say: number;
  commission_mebleg: number;
  bonus_mebleg: number;
  yekun: number;
  hedef: number | null;
  hedefe_catdi: boolean;
};

/**
 * Per-salesperson commission for one calendar month, computed from the sales
 * they were assigned as `satis_meneceri_id`. Excludes drafts and cancelled
 * orders.
 */
export async function getSalespersonCommissions(
  year: number,
  month: number,
): Promise<SalespersonCommission[]> {
  return withTenant(async () => {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const [tiers, bonus] = await Promise.all([getCommissionTiers(), getBonusOnTarget()]);

    const rows = await prisma.satis_sifarisleri.findMany({
      where: {
        tarix: { gte: monthStart, lt: monthEnd },
        qaralama: { not: true },
        status: { not: "legv" },
        satis_meneceri_id: { not: null },
      },
      select: {
        son_mebleg: true,
        satis_meneceri_id: true,
        istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler: {
          select: { id: true, ad_soyad: true },
        },
      },
    });

    const map = new Map<string, { ad_soyad: string; total: number; count: number }>();
    for (const r of rows) {
      const u = r.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler;
      if (!u) continue;
      const cur = map.get(u.id) ?? { ad_soyad: u.ad_soyad, total: 0, count: 0 };
      cur.total += Number(r.son_mebleg ?? 0);
      cur.count += 1;
      map.set(u.id, cur);
    }

    // Per-person target (read once per request from ayarlar)
    const { sahibkarId } = requireTenant();
    const targetRow = await prisma.ayarlar.findUnique({
      where: {
        sahibkar_id_qrup_acar: {
          sahibkar_id: sahibkarId,
          qrup: "ticaret",
          acar: "satis_aylik_hedef",
        },
      },
    });
    const tenantTarget = targetRow ? Number(targetRow.deyer ?? 0) : 0;

    const out: SalespersonCommission[] = [];
    for (const [id, v] of map.entries()) {
      const commission = computeCommissionFromTiers(v.total, tiers);
      const hit = tenantTarget > 0 && v.total >= tenantTarget;
      out.push({
        istifadeci_id: id,
        ad_soyad: v.ad_soyad,
        il: year,
        ay: month,
        satis_mebleg: Math.round(v.total * 100) / 100,
        satis_say: v.count,
        commission_mebleg: commission,
        bonus_mebleg: hit ? bonus : 0,
        yekun: Math.round((commission + (hit ? bonus : 0)) * 100) / 100,
        hedef: tenantTarget > 0 ? tenantTarget : null,
        hedefe_catdi: hit,
      });
    }
    out.sort((a, b) => b.yekun - a.yekun);
    return out;
  });
}

/**
 * Single-user variant — used on the iscilier KPI tab to show the current
 * month's commission summary inline.
 */
export async function getCommissionForUser(
  userId: string,
  year: number,
  month: number,
): Promise<SalespersonCommission | null> {
  const all = await getSalespersonCommissions(year, month);
  return all.find((c) => c.istifadeci_id === userId) ?? null;
}
