import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const QRUP = "ticaret";

/**
 * Per-role maximum discount percent. Hardcoded defaults: kassir=10%,
 * mudir=30%, sahibkar=100. Override per-tenant via ayarlar (qrup="ticaret",
 * acar=`endirim_limit_${role_kod}`).
 */
const DEFAULTS: Record<string, number> = {
  kassir: 10,
  mudir: 30,
  menecer: 30,
  sahibkar: 100,
  admin: 100,
};

export async function getDiscountLimitForRole(roleKod: string | null | undefined): Promise<number> {
  if (!roleKod) return DEFAULTS.kassir;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: {
        sahibkar_id_qrup_acar: {
          sahibkar_id: sahibkarId,
          qrup: QRUP,
          acar: `endirim_limit_${roleKod}`,
        },
      },
    });
    if (row?.deyer) {
      const n = Number(row.deyer);
      if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
    }
    return DEFAULTS[roleKod] ?? DEFAULTS.kassir;
  });
}

/**
 * Check whether a percent discount is within the current user's role limit.
 * If not, returns the limit. Caller should then create a tesdiq_telep record
 * and set sale.status='tesdiq_telep'.
 */
export async function checkDiscountLimit(percent: number): Promise<{ ok: boolean; limit: number; userRole: string | null }> {
  return withTenant(async () => {
    const ctx = requireTenant();
    let roleKod: string | null = null;
    if (ctx.rolId) {
      const role = await prisma.roles.findUnique({ where: { id: ctx.rolId }, select: { ad: true } });
      // role.ad in this codebase is the role slug (e.g. "kassir", "mudir").
      roleKod = role?.ad ? role.ad.toLowerCase() : null;
    }
    const limit = await getDiscountLimitForRole(roleKod);
    return { ok: percent <= limit, limit, userRole: roleKod };
  });
}

/**
 * Create a tesdiq_telep row asking the owner to approve a high-discount sale.
 */
export async function requestDiscountApproval(
  saleId: string,
  percent: number,
  basliq: string,
  mebleg: number
): Promise<{ ok: true; telep_id: number } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const row = await prisma.tesdiq_telep.create({
        data: {
          sahibkar_id: sahibkarId,
          emeliyyat_nov: "endirim_tesdiq",
          resurs_nov: "satis_sifarisi",
          resurs_id: saleId,
          basliq,
          mebleg,
          risk_sebeb: `Endirim limit aşılır (${percent.toFixed(1)}%)`,
          prioritet: percent > 50 ? "yuksek" : "orta",
          status: "gozleyir",
          yaradan_id: istifadeciId ?? null,
          detay_json: { endirim_faiz: percent, satis_id: saleId },
        },
      });
      return { ok: true, telep_id: row.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}
