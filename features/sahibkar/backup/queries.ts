import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type BackupTablo = {
  ad: string;
  azAd: string;
  emoji: string;
  qrup: "satis" | "alis" | "anbar" | "elaqe" | "maliyye" | "isci" | "diger";
  sayi: number;
};

/**
 * Sahibkar üçün backup hazırlanması üçün mövcud cədvəllər və sətr sayları.
 * Yalnız ən vacib cədvəllər siyahıya alınır — backup ölçüsü çoxalmasın.
 */
export async function getBackupTables(): Promise<BackupTablo[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [
      satis_count, satis_satir_count, alis_count, alis_satir_count,
      mehsul_count, stok_count, anbar_count,
      kontragent_count, finance_count, xerc_count, kassa_count, hesab_count,
      isci_count, davamiyyet_count, maas_count, audit_count,
    ] = await Promise.all([
      prisma.satis_sifarisleri.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.satis_sifaris_satirlari.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.alis_sifarisleri.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.alis_sifaris_satirlari.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.mehsullar.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.stok.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.anbarlar.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.kontragentler.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.finance_operations.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.xercl_r.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.kassalar.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.maliye_hesablari.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.istifadeciler.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.davamiyyet.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.maas_hesablamalar.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.audit_log.count({ where: { sahibkar_id: sahibkarId } }),
    ]);

    return [
      { ad: "satis_sifarisleri", azAd: "Satış sifarişləri", emoji: "🧾", qrup: "satis", sayi: satis_count },
      { ad: "satis_sifaris_satirlari", azAd: "Satış sətirləri", emoji: "📝", qrup: "satis", sayi: satis_satir_count },
      { ad: "alis_sifarisleri", azAd: "Alış sifarişləri", emoji: "🛒", qrup: "alis", sayi: alis_count },
      { ad: "alis_sifaris_satirlari", azAd: "Alış sətirləri", emoji: "📝", qrup: "alis", sayi: alis_satir_count },
      { ad: "mehsullar", azAd: "Məhsullar", emoji: "📦", qrup: "anbar", sayi: mehsul_count },
      { ad: "stok", azAd: "Stok", emoji: "📊", qrup: "anbar", sayi: stok_count },
      { ad: "anbarlar", azAd: "Anbarlar", emoji: "🏬", qrup: "anbar", sayi: anbar_count },
      { ad: "kontragentler", azAd: "Müştəri & təchizatçı", emoji: "👥", qrup: "elaqe", sayi: kontragent_count },
      { ad: "finance_operations", azAd: "Maliyyə əməliyyatları", emoji: "💰", qrup: "maliyye", sayi: finance_count },
      { ad: "xercl_r", azAd: "Xərclər", emoji: "💸", qrup: "maliyye", sayi: xerc_count },
      { ad: "kassalar", azAd: "Kassalar", emoji: "🏪", qrup: "maliyye", sayi: kassa_count },
      { ad: "maliye_hesablari", azAd: "Maliyyə hesabları", emoji: "🏦", qrup: "maliyye", sayi: hesab_count },
      { ad: "istifadeciler", azAd: "İşçilər/İstifadəçilər", emoji: "👤", qrup: "isci", sayi: isci_count },
      { ad: "davamiyyet", azAd: "Davamiyyət", emoji: "📅", qrup: "isci", sayi: davamiyyet_count },
      { ad: "maas_hesablamalar", azAd: "Maaş hesablamaları", emoji: "💵", qrup: "isci", sayi: maas_count },
      { ad: "audit_log", azAd: "Audit log", emoji: "📋", qrup: "diger", sayi: audit_count },
    ];
  });
}
