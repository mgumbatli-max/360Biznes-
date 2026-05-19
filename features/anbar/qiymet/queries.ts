import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { searchProductIdsSpaceInsensitive } from "@/lib/db/space-insensitive-search";

export type QiymetRow = {
  id: string;
  ad: string;
  kod: string | null;
  alish_qiymeti: number;
  satis_qiymeti: number;
  endirimli_qiymet: number | null;
  min_satis_qiymeti: number;
  topdan_qiymeti: number;
  partnyor_qiymeti: number;
  vip_qiymeti: number;
};

export async function getQiymetList(search?: string): Promise<QiymetRow[]> {
  return withTenant(async () => {
    const q = search?.trim();
    // Boşluqdan asılı olmayan axtarış: "buds3" ↔ "buds 3" — kod/ad/barkod/model
    // sahələrində PG REPLACE(... , ' ', '') normalize edilir.
    const spaceInsensitiveIds = q
      ? await searchProductIdsSpaceInsensitive(q, { limit: 500, activeOnly: true })
      : [];
    const where = {
      aktiv: true,
      ...(q
        ? {
            OR: [
              ...(spaceInsensitiveIds.length > 0 ? [{ id: { in: spaceInsensitiveIds } }] : []),
              { markalar: { is: { ad: { contains: q, mode: "insensitive" as const } } } },
              { kateqoriyalar: { is: { ad: { contains: q, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };
    const rows = await prisma.mehsullar.findMany({
      where,
      orderBy: { ad: "asc" },
      take: 200,
      select: {
        id: true,
        ad: true,
        kod: true,
        alish_qiymeti: true,
        satis_qiymeti: true,
        endirimli_qiymet: true,
        min_satis_qiymeti: true,
        topdan_qiymeti: true,
        partnyor_qiymeti: true,
        vip_qiymeti: true,
      },
    });
    return rows.map((m) => ({
      id: m.id,
      ad: m.ad,
      kod: m.kod,
      alish_qiymeti: Number(m.alish_qiymeti ?? 0),
      satis_qiymeti: Number(m.satis_qiymeti ?? 0),
      endirimli_qiymet: m.endirimli_qiymet ? Number(m.endirimli_qiymet) : null,
      min_satis_qiymeti: Number(m.min_satis_qiymeti),
      topdan_qiymeti: Number(m.topdan_qiymeti),
      partnyor_qiymeti: Number(m.partnyor_qiymeti),
      vip_qiymeti: Number(m.vip_qiymeti),
    }));
  });
}
