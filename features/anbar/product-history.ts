import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type ProductHistoryEntry = {
  id: string;
  yaradildi: Date | null;
  emeliyyat: string;
  istifadeci_ad: string | null;
  url: string | null;
  status: string | null;
  sebeb: string | null;
  evvelki_data: Record<string, unknown> | null;
  yeni_data: Record<string, unknown> | null;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
};

/**
 * Məhsul kartı üçün audit-log əsaslı tarixçə.
 * `audit_log` cədvəlində `resurs_nov='mehsul'` və `resurs_id=<uuid>` ilə yazılan
 * bütün dəyişiklikləri qaytarır, hər biri üçün dəyişən sahələri də diff-ləyir.
 */
export async function getProductHistory(productId: string, limit = 100): Promise<ProductHistoryEntry[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.audit_log.findMany({
      where: {
        sahibkar_id: sahibkarId,
        resurs_nov: "mehsul",
        resurs_id: productId,
      },
      orderBy: { yaradildi: "desc" },
      take: Math.min(500, Math.max(1, limit)),
      select: {
        id: true,
        yaradildi: true,
        emeliyyat: true,
        istifadeci_ad: true,
        url: true,
        status: true,
        sebeb: true,
        evvelki_data: true,
        yeni_data: true,
      },
    });

    return rows.map((r) => {
      const evvelki = (r.evvelki_data ?? null) as Record<string, unknown> | null;
      const yeni = (r.yeni_data ?? null) as Record<string, unknown> | null;
      return {
        id: r.id.toString(),
        yaradildi: r.yaradildi,
        emeliyyat: r.emeliyyat,
        istifadeci_ad: r.istifadeci_ad,
        url: r.url,
        status: r.status,
        sebeb: r.sebeb,
        evvelki_data: evvelki,
        yeni_data: yeni,
        changes: computeChanges(evvelki, yeni),
      };
    });
  });
}

/**
 * Cari istifadəçi məhsul tarixçəsindən qeyd silə bilərmi?
 * Yalnız sahibkar (rol 9), system admin (rol 1) və ya audit_log_silme icazəsi olanlar.
 */
export async function canDeleteHistory(): Promise<boolean> {
  return withTenant(async () => {
    const ctx = requireTenant();
    if (ctx.rolId === 1 || ctx.rolId === 9) return true;
    return ctx.icazeler?.includes("audit_log.sil") ?? false;
  });
}

function computeChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ field: string; from: unknown; to: unknown }> {
  if (!before && !after) return [];
  if (!before) {
    return Object.entries(after ?? {}).map(([k, v]) => ({ field: k, from: null, to: v }));
  }
  if (!after) {
    return Object.entries(before).map(([k, v]) => ({ field: k, from: v, to: null }));
  }
  const out: Array<{ field: string; from: unknown; to: unknown }> = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: k, from: a, to: b });
  }
  return out;
}
