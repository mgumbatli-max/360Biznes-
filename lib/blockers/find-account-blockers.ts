import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Maliyə hesabı (kassa / bank) silmə cəhdində bloklayan amilləri qaytarır:
 *   1. Hesabda qalıq (qaliq > 0)
 *   2. Aktiv əməliyyatlar (finance_operations.hesab_id, son 30 gün)
 */
export async function findAccountBlockers(
  hesabId: string,
  sahibkarId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  // 1) Qaliq
  const hesab = await tx.maliye_hesablari.findUnique({
    where: { id: hesabId },
    select: { ad: true, qaliq: true, valyuta: true },
  });
  if (hesab) {
    const qaliq = Number(hesab.qaliq ?? 0);
    if (Math.abs(qaliq) > 0.01) {
      blockers.push({
        type: "kassa_emeliyyati",
        id: hesabId,
        label: `${hesab.ad} qaliqi: ${qaliq.toFixed(2)} ${hesab.valyuta ?? "AZN"}`,
        href: `/maliyye/hesab/${hesabId}`,
        amount: qaliq,
        badge: qaliq > 0 ? "müsbət qalıq" : "mənfi qalıq",
      });
    }
  }

  // 2) Son aktiv əməliyyatlar
  try {
    const ops = await tx.finance_operations.findMany({
      where: {
        hesab_id: hesabId,
        sahibkar_id: sahibkarId,
        deleted_at: null,
        status: { not: "legv" },
      },
      select: { id: true, meblegh: true, tarix: true, qeyd: true },
      orderBy: { tarix: "desc" },
      take: 8,
    });
    for (const op of ops) {
      const mebleg = Number(op.meblegh ?? 0);
      const dateStr = op.tarix ? new Date(op.tarix).toLocaleDateString("az-AZ") : "";
      blockers.push({
        type: "odenis",
        id: op.id,
        label: `${mebleg.toFixed(2)} ₼${dateStr ? ` — ${dateStr}` : ""}`,
        href: `/maliyye/emeliyyat/${op.id}`,
        amount: mebleg,
        tarix: op.tarix ?? undefined,
      });
    }
  } catch { /* skip */ }

  return blockers;
}
