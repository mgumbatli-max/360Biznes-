import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Tapşırığı ləğv/silmə cəhdində bloklayan amilləri qaytarır:
 *   1. Tamamlanmamış checklist sətirləri
 *   2. Əlaqəli obyektlər (satış / alış / müştəri və s.) — yumşaq xəbərdarlıq
 */
export async function findTaskBlockers(
  taskId: string,
  sahibkarId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  // 1) Tamamlanmamış checklist
  try {
    const items = await tx.tapshiriq_checklist.findMany({
      where: { tapshiriq_id: taskId, tamamlandi: false },
      select: { id: true, metn: true },
      take: 10,
    });
    for (const it of items) {
      blockers.push({
        type: "tapsiriq",
        id: String(it.id),
        label: (it.metn ?? "Punkt").slice(0, 80),
        href: `/tapshiriqlar/${taskId}`,
        badge: "açıq punkt",
      });
    }
  } catch { /* skip */ }

  // 2) Bağlı obyektlər (yumşaq — istifadəçiyə xəbər versin)
  try {
    const links = await tx.tapshiriq_obyektleri.findMany({
      where: { tapshiriq_id: taskId, sahibkar_id: sahibkarId },
      select: { id: true, obyekt_nov: true, obyekt_id: true },
      take: 5,
    });
    for (const l of links) {
      const route =
        l.obyekt_nov === "satis_sifarisi"
          ? `/ticaret/satislar/${l.obyekt_id}`
          : l.obyekt_nov === "alis_sifarisi"
          ? `/ticaret/alislar/${l.obyekt_id}`
          : l.obyekt_nov === "kontragent"
          ? `/elaqe/musteriler/${l.obyekt_id}`
          : "#";
      blockers.push({
        type: "tapsiriq",
        id: String(l.id),
        label: `Bağlı: ${l.obyekt_nov}`,
        href: route,
        badge: l.obyekt_nov ?? undefined,
      });
    }
  } catch { /* skip */ }

  return blockers;
}
