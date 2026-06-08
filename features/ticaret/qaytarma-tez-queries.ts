import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

/**
 * Recent quick returns for the bottom history panel.
 */
export async function getRecentReturns(limit = 10) {
  return withTenant(async () => {
    const rows = await prisma.qaytarma_sifarisleri.findMany({
      where: { deleted_at: null },
      orderBy: { yaradildi: "desc" },
      take: limit,
      include: {
        kontragentler: { select: { ad: true } },
        anbarlar: { select: { ad: true } },
        qaytarma_satirlari: {
          include: { mehsullar: { select: { ad: true, kod: true } } },
          take: 1,
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      nomre: r.nomre,
      tarix: r.tarix,
      yaradildi: r.yaradildi,
      umumi_mebleg: Number(r.umumi_mebleg),
      sebeb: r.sebeb,
      kontragent_ad: r.kontragentler?.ad ?? null,
      anbar_ad: r.anbarlar?.ad ?? null,
      mehsul_ad: r.qaytarma_satirlari[0]?.mehsullar?.ad ?? null,
      mehsul_kod: r.qaytarma_satirlari[0]?.mehsullar?.kod ?? null,
      miqdar: r.qaytarma_satirlari[0] ? Number(r.qaytarma_satirlari[0].miqdar) : 0,
    }));
  });
}

export async function getAnbarOptions() {
  return withTenant(async () => {
    const rows = await prisma.anbarlar.findMany({
      select: { id: true, ad: true },
      orderBy: { ad: "asc" },
    });
    return rows;
  });
}
