import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { prisma } from "@/lib/db/prisma";

/**
 * GET — POS məhsul axtarışı/skanı. `?q=` barkod/kod/ad, `?anbar_id=` stok üçün,
 * `?scan=1` → yalnız barkod/kod dəqiq uyğunluğu (tək nəticə).
 * Qaytarır: [{ id, ad, kod, barkod, qiymet, valyuta, stok }].
 */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "pos.satis", "satis.yarat", "satis.idare", "mehsul.oxu", "anbar.oxu")) {
      return { items: [] };
    }
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim();
    const scan = sp.get("scan") === "1";
    const anbarId = sp.get("anbar_id") ? Number(sp.get("anbar_id")) : null;
    if (!q) return { items: [] };

    const where = scan
      ? { aktiv: { not: false }, OR: [{ barkod: q }, { kod: q }] }
      : {
          aktiv: { not: false },
          OR: [
            { barkod: q },
            { kod: q },
            { ad: { contains: q, mode: "insensitive" as const } },
          ],
        };

    const mehsullar = await prisma.mehsullar.findMany({
      where,
      take: scan ? 1 : 25,
      orderBy: { ad: "asc" },
      select: { id: true, ad: true, kod: true, barkod: true, satis_qiymeti: true, valyuta: true },
    });
    if (mehsullar.length === 0) return { items: [] };

    // Seçilmiş anbarın stoku
    const stokMap = new Map<string, number>();
    if (anbarId) {
      const ids = mehsullar.map((m) => m.id);
      const stoklar = await prisma.stok.findMany({
        where: { mehsul_id: { in: ids }, anbar_id: anbarId },
        select: { mehsul_id: true, miqdar: true },
      });
      for (const s of stoklar) {
        if (s.mehsul_id) stokMap.set(s.mehsul_id, Number(s.miqdar ?? 0));
      }
    }

    return {
      items: mehsullar.map((m) => ({
        id: m.id,
        ad: m.ad,
        kod: m.kod,
        barkod: m.barkod,
        qiymet: Number(m.satis_qiymeti ?? 0),
        valyuta: m.valyuta ?? "AZN",
        stok: anbarId ? (stokMap.get(m.id) ?? 0) : null,
      })),
    };
  });
}
