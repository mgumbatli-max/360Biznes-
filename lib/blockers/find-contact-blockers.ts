import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import type { Blocker } from "./types";

type TxClient = Prisma.TransactionClient | typeof prisma;

/**
 * Müştəri / təchizatçı (kontragent) deaktivləşdirmə cəhdində bloklayan amilləri qaytarır:
 *   1. Aktiv borc (müştəri alacaq və ya təchizatçı borc)
 *   2. Açıq satış sənədləri (müştəri kimi)
 *   3. Açıq alış sənədləri (təchizatçı kimi)
 *   4. Açıq servis qeydləri
 *   5. Açıq tapşırıqlar (bonus — gələcəkdə)
 */
export async function findContactBlockers(
  kontragentId: string,
  sahibkarId: string,
  tx: TxClient = prisma,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];

  // 1) Borc/alacaq
  const k = await tx.kontragentler.findUnique({
    where: { id: kontragentId },
    select: { ad: true, nov: true, borc: true, alacaq: true },
  });
  if (k) {
    const alacaq = Number(k.alacaq ?? 0);
    const borc = Number(k.borc ?? 0);
    if (alacaq > 0.01) {
      blockers.push({
        type: "musteri",
        id: kontragentId,
        label: `Müştəri borcu: ${alacaq.toFixed(2)} ₼`,
        href: `/elaqe/musteriler/${kontragentId}`,
        amount: alacaq,
        badge: "alacaq",
      });
    }
    if (borc > 0.01) {
      blockers.push({
        type: "techizatci",
        id: kontragentId,
        label: `Təchizatçıya borcumuz: ${borc.toFixed(2)} ₼`,
        href: `/elaqe/techizatcilar/${kontragentId}`,
        amount: borc,
        badge: "borc",
      });
    }
  }

  // 2) Açıq satışlar
  try {
    const sales = await tx.satis_sifarisleri.findMany({
      where: {
        musteri_id: kontragentId,
        sahibkar_id: sahibkarId,
        deleted_at: null,
        status: { notIn: ["legv", "qaytarilib"] },
      },
      select: { id: true, nomre: true, son_mebleg: true, odenilmis: true, tarix: true, status: true },
      orderBy: { tarix: "desc" },
      take: 8,
    });
    for (const s of sales) {
      const son = Number(s.son_mebleg ?? 0);
      const odn = Number(s.odenilmis ?? 0);
      const qaliq = Math.max(0, son - odn);
      blockers.push({
        type: "satis",
        id: s.id,
        label: `${s.nomre} — ${son.toFixed(2)} ₼${qaliq > 0.01 ? ` (qalıq ${qaliq.toFixed(2)})` : ""}`,
        href: `/ticaret/satislar/${s.id}`,
        amount: son,
        tarix: s.tarix ?? undefined,
        badge: s.status ?? undefined,
      });
    }
  } catch { /* skip */ }

  // 3) Açıq alışlar
  try {
    const purchases = await tx.alis_sifarisleri.findMany({
      where: {
        techiazatci_id: kontragentId,
        sahibkar_id: sahibkarId,
        deleted_at: null,
        status: { not: "legv" },
      },
      select: { id: true, nomre: true, umumi_mebleg: true, odenilmis: true, tarix: true, status: true },
      orderBy: { tarix: "desc" },
      take: 8,
    });
    for (const p of purchases) {
      const umumi = Number(p.umumi_mebleg ?? 0);
      const odn = Number(p.odenilmis ?? 0);
      const qaliq = Math.max(0, umumi - odn);
      blockers.push({
        type: "alis",
        id: p.id,
        label: `${p.nomre} — ${umumi.toFixed(2)} ₼${qaliq > 0.01 ? ` (qalıq ${qaliq.toFixed(2)})` : ""}`,
        href: `/ticaret/alislar/${p.id}`,
        amount: umumi,
        tarix: p.tarix ?? undefined,
        badge: p.status ?? undefined,
      });
    }
  } catch { /* skip */ }

  // 4) Açıq servis qeydləri
  try {
    const servisler = await tx.servis_qeydleri.findMany({
      where: {
        musteri_id: kontragentId,
        sahibkar_id: sahibkarId,
        deleted_at: null,
        status: { notIn: ["redd_edildi", "musteriye_tehvil"] },
      },
      select: { id: true, nomre: true, temir_xerci: true, status: true, yaradildi: true },
      orderBy: { yaradildi: "desc" },
      take: 5,
    });
    for (const s of servisler) {
      blockers.push({
        type: "servis",
        id: s.id,
        label: `${s.nomre} — ${Number(s.temir_xerci ?? 0).toFixed(2)} ₼`,
        href: `/servis/${s.id}`,
        amount: Number(s.temir_xerci ?? 0),
        tarix: s.yaradildi ?? undefined,
        badge: s.status ?? undefined,
      });
    }
  } catch { /* skip */ }

  return blockers;
}
