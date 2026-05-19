import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { type TierKey, TIER_LABELS, ALL_TIERS } from "./qiymet-icaze-types";

export { type TierKey, TIER_LABELS, ALL_TIERS };

const AYAR_QRUP = "qiymet_icaze";

/**
 * Sensible defaults when no row has been saved yet.
 * Keyed by role-name (lowercased). Falls back to retail-only.
 */
function defaultsForRoleName(name: string | null | undefined): TierKey[] {
  const n = (name ?? "").toLowerCase();
  if (n.includes("sahibkar") || n.includes("owner") || n.includes("müdir") || n.includes("mudir") || n.includes("admin"))
    return ["satis_qiymeti", "endirimli_qiymet", "topdan_qiymeti", "partnyor_qiymeti", "vip_qiymeti", "min_satis_qiymeti"];
  if (n.includes("kassir") || n.includes("satici") || n.includes("satıcı"))
    return ["satis_qiymeti", "endirimli_qiymet"];
  return ["satis_qiymeti"];
}

/**
 * Read the tiers that a role is allowed to see in POS.
 * Returns sensible defaults if not configured.
 */
export async function getRoleAllowedTiers(rolId: number): Promise<TierKey[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findFirst({
      where: {
        sahibkar_id: sahibkarId,
        qrup: AYAR_QRUP,
        acar: `rol_${rolId}`,
      },
    });
    if (row && row.deyer) {
      try {
        const arr = JSON.parse(row.deyer) as unknown;
        if (Array.isArray(arr)) {
          return arr.filter((x): x is TierKey => ALL_TIERS.includes(x as TierKey));
        }
      } catch {
        /* fall through */
      }
    }
    const rol = await prisma.roles.findUnique({ where: { id: rolId }, select: { ad: true } });
    return defaultsForRoleName(rol?.ad ?? null);
  });
}

/** Bulk-read for the settings UI. */
export async function getAllRoleAllowedTiers(): Promise<{ rolId: number; ad: string; sistem: boolean; tiers: TierKey[] }[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const roles = await prisma.roles.findMany({
      where: { OR: [{ sahibkar_id: sahibkarId }, { sistem: true }] },
      orderBy: { id: "asc" },
    });
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: AYAR_QRUP },
    });
    const byKey = new Map(rows.map((r) => [r.acar, r.deyer ?? ""]));
    return roles.map((r) => {
      const v = byKey.get(`rol_${r.id}`);
      let tiers: TierKey[] | null = null;
      if (v) {
        try {
          const arr = JSON.parse(v) as unknown;
          if (Array.isArray(arr)) {
            tiers = arr.filter((x): x is TierKey => ALL_TIERS.includes(x as TierKey));
          }
        } catch {
          /* ignore */
        }
      }
      return {
        rolId: r.id,
        ad: r.ad,
        sistem: r.sistem,
        tiers: tiers ?? defaultsForRoleName(r.ad),
      };
    });
  });
}

/** Upsert the allowed tiers list for a role. */
export async function setRoleAllowedTiers(rolId: number, tiers: TierKey[]): Promise<void> {
  await withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const clean = Array.from(new Set(tiers.filter((t) => ALL_TIERS.includes(t))));
    const acar = `rol_${rolId}`;
    const value = JSON.stringify(clean);
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: {
          sahibkar_id: sahibkarId,
          qrup: AYAR_QRUP,
          acar,
        },
      },
      update: { deyer: value, nov: "json", yenilendi: new Date() },
      create: {
        sahibkar_id: sahibkarId,
        qrup: AYAR_QRUP,
        acar,
        deyer: value,
        nov: "json",
        tesvir: `Qiymət icazələri — rol ${rolId}`,
      },
    });
  });
}
