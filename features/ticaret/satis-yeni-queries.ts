import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type AnbarOption = { id: number; ad: string };
export type SablonRow = {
  id: number;
  ad: string;
  payload: string | null;
  yenilendi: Date | null;
};

const SABLON_QRUP = "satis_sablon";

export async function getAnbarOptions(): Promise<AnbarOption[]> {
  return withTenant(async () =>
    prisma.anbarlar.findMany({
      where: { aktiv: true },
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    }),
  );
}

/** Templates are stored as ayarlar rows (qrup=satis_sablon, acar=<slug>). */
export async function getSablonlar(): Promise<SablonRow[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: SABLON_QRUP },
      orderBy: { yenilendi: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      ad: r.acar,
      payload: r.deyer,
      yenilendi: r.yenilendi,
    }));
  });
}

/** Recent sale drafts for this user. */
export async function getQaralamalar(limit = 20): Promise<{
  id: string;
  nomre: string;
  tarix: Date | null;
  musteri_ad: string | null;
  son_mebleg: number;
  satir_sayi: number;
  yenilendi: Date | null;
}[]> {
  return withTenant(async () => {
    const rows = await prisma.satis_sifarisleri.findMany({
      where: { qaralama: true, status: { not: "legv" } },
      orderBy: { yenilendi: "desc" },
      take: limit,
      include: {
        kontragentler: { select: { ad: true } },
        _count: { select: { satis_sifaris_satirlari: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      tarix: r.tarix,
      musteri_ad: r.kontragentler?.ad ?? null,
      son_mebleg: Number(r.son_mebleg ?? 0),
      satir_sayi: r._count.satis_sifaris_satirlari,
      yenilendi: r.yenilendi,
    }));
  });
}

/** AI-style suggestion based on customer's average discount in last 90 days. */
export async function suggestDiscountForCustomer(musteriId: string): Promise<{
  suggested_pct: number;
  reason: string;
  history_count: number;
}> {
  return withTenant(async () => {
    const rows = await prisma.satis_sifarisleri.findMany({
      where: {
        musteri_id: musteriId,
        status: { not: "legv" },
        qaralama: { not: true },
        tarix: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      select: { umumi_mebleg: true, endirim_mebleg: true, son_mebleg: true },
      take: 50,
    });
    if (rows.length === 0) {
      return { suggested_pct: 0, reason: "Tarixçə yoxdur", history_count: 0 };
    }
    let pctSum = 0;
    let count = 0;
    for (const r of rows) {
      const umumi = Number(r.umumi_mebleg ?? 0);
      const endirim = Number(r.endirim_mebleg ?? 0);
      if (umumi > 0) {
        pctSum += (endirim / umumi) * 100;
        count += 1;
      }
    }
    const avg = count ? pctSum / count : 0;
    // Tier bumps: loyal customer (>=5 orders) gets +1%, big-spender (>=10) +2%
    const bump = rows.length >= 10 ? 2 : rows.length >= 5 ? 1 : 0;
    const suggested = Math.round((avg + bump) * 10) / 10;
    return {
      suggested_pct: Math.max(0, Math.min(suggested, 30)),
      reason: `Son 90 gündə orta endirim: ${avg.toFixed(1)}% (${rows.length} satış)${bump ? `, sadiq müştəri bonusu +${bump}%` : ""}`,
      history_count: rows.length,
    };
  });
}
