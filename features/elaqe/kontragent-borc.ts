import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Kontragentin (müştəri/təchizatçı) cari faktiki borc məlumatı.
 *
 * Yeni model:
 *   - `alacaq` → müştəri bizdən almalı (müştəri borcu)
 *   - `borc` → biz təchizatçıya verməliyik (təchizatçı borcu)
 *
 * Bu helper həm cədvəldəki dəyəri, həm də faktiki açıq sənədlərdən
 * hesablanan dəyəri yoxlayır və daha böyüyünü qaytarır — data drift
 * olsa belə düzgün cavab verir.
 */
export type KontragentBorc = {
  /** Müştəri tipi: müştəri bizə borclu (nisyə satış) */
  musteri_borcu: number;
  /** Təchizatçı tipi: biz onlara borcluyuq (ödənilməmiş alış) */
  techizatci_borcu: number;
  /** Açıq nisyə sənəd sayı */
  acig_satis_sayi: number;
  /** Ödənilməmiş alış sənəd sayı */
  acig_alis_sayi: number;
};

export async function getKontragentBorc(kontragentId: string): Promise<KontragentBorc | null> {
  if (!kontragentId) return null;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const k = await prisma.kontragentler.findFirst({
      where: { id: kontragentId, sahibkar_id: sahibkarId },
      select: { id: true },
    });
    if (!k) return null;

    const [satisAgg, alisAgg] = await Promise.all([
      // Müştərinin bizə açıq borcu (nisyə satışlardan)
      prisma.$queryRaw<{ total: number | string | null; cnt: number | string | null }[]>(
        Prisma.sql`
          SELECT COALESCE(SUM(son_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total,
                 COUNT(*)::int AS cnt
            FROM satis_sifarisleri
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND musteri_id = ${kontragentId}::uuid
             AND status NOT IN ('legv', 'qaytarilib')
             AND COALESCE(qaralama, false) = false
             AND odenis_nov IN ('nisye', 'borc')
             AND son_mebleg - COALESCE(odenilmis, 0) > 0
        `,
      ),
      // Bizim təchizatçıya açıq borcumuz (ödənilməmiş alışlardan)
      prisma.$queryRaw<{ total: number | string | null; cnt: number | string | null }[]>(
        Prisma.sql`
          SELECT COALESCE(SUM(umumi_mebleg - COALESCE(odenilmis, 0)), 0)::float AS total,
                 COUNT(*)::int AS cnt
            FROM alis_sifarisleri
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND techiazatci_id = ${kontragentId}::uuid
             AND status <> 'legv'
             AND umumi_mebleg - COALESCE(odenilmis, 0) > 0
        `,
      ),
    ]);

    const satisOpen = Number(satisAgg[0]?.total ?? 0);
    const alisOpen = Number(alisAgg[0]?.total ?? 0);

    // Source-of-truth: real-time hesablama (satışlardan). Cache field-ləri
    // (kontragentler.alacaq/borc) artıq mənbə deyil — yalnız fast-read üçün.
    return {
      musteri_borcu: satisOpen,
      techizatci_borcu: alisOpen,
      acig_satis_sayi: Number(satisAgg[0]?.cnt ?? 0),
      acig_alis_sayi: Number(alisAgg[0]?.cnt ?? 0),
    };
  });
}
