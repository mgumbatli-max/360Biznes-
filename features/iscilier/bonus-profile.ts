import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Hər əməkdaş üçün bonus profili — çoxlu meyarlardan ibarət "portfel" şəklində.
 *
 * Saxlama: `ayarlar` cədvəlində — `qrup="bonus_profil"`, `acar=<istifadeci_id>`.
 * Bu yanaşma schema migrasiya tələb etmir, lakin tam funksionallıq verir.
 *
 * Bonus pool yaranma metodu:
 *  - `fixed`: standart məbləğ (məs. 500 ₼)
 *  - `percent_satis`: aylıq satışın faizi
 *  - `percent_menfaat`: aylıq mənfəətin faizi
 *
 * Paylanma — hər meyar ya `mebleg` (absolute ₼) ya `faiz` (% of pool) ilə təyin olunur.
 */
export type BonusKategoriya =
  | "davamiyyet"      // İş günü davamiyyəti
  | "tapsiriq"         // Tapşırıqların vaxtında tamamlanması
  | "sehv_yoxlugu"     // Təsdiq mərkəzində rədd edilməyən sorğular
  | "borc_yigim"       // Borc yığımı (portfeldən faiz)
  | "satis_hedef";     // Satış hədəfi (₼)

export type BonusPaylanma = {
  kateqoriya: BonusKategoriya;
  tip: "mebleg" | "faiz";
  deyer: number;        // mebleg-də absolute ₼, faiz-də % (0-100)
  hedef: number;        // category-spesifik hədəf (faiz vs məbləğ)
};

/**
 * Müştəri filtri:
 *  - "hamisi"             — bütün müştərilərin satışları
 *  - "mene_aid"           — müştəri kartında menecer = bu işçi
 *  - "getirdi"            — yalnız bu işçinin gətirdiyi müştərilər (kontragentler.getirdi_id)
 *  - "mene_aid_ve_getirdi" — yuxarıdakı ikisindən hər hansı biri
 */
export type MusteriFilter = "hamisi" | "mene_aid" | "getirdi" | "mene_aid_ve_getirdi";

export type BonusProfil = {
  metod: "fixed" | "percent_satis" | "percent_menfaat";
  fixed_mebleg: number;     // metod=fixed olduqda
  percent: number;          // metod=percent_* olduqda (0-100)
  paylanma: BonusPaylanma[];
  musteri_filter: MusteriFilter;
  /**
   * Blacklist — bu konkret kontragent_id-ləri olan satışlar bonusdan istisna.
   * Filter növündən asılı olmayaraq ƏLAVƏ kəsmə qatı kimi tətbiq olunur.
   */
  excluded_kontragent_ids: string[];
};

const DEFAULT_PROFIL: BonusProfil = {
  metod: "fixed",
  fixed_mebleg: 0,
  percent: 0,
  paylanma: [],
  musteri_filter: "hamisi",
  excluded_kontragent_ids: [],
};

const VALID_FILTERS: ReadonlyArray<MusteriFilter> = ["hamisi", "mene_aid", "getirdi", "mene_aid_ve_getirdi"];

export async function getBonusProfil(istifadeciId: string): Promise<BonusProfil> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: "bonus_profil", acar: istifadeciId },
      select: { deyer: true },
    });
    if (!row?.deyer) return { ...DEFAULT_PROFIL };
    try {
      const parsed = JSON.parse(row.deyer) as Partial<BonusProfil>;
      const filter = VALID_FILTERS.includes(parsed.musteri_filter as MusteriFilter)
        ? (parsed.musteri_filter as MusteriFilter)
        : "hamisi";
      const excluded = Array.isArray(parsed.excluded_kontragent_ids)
        ? parsed.excluded_kontragent_ids.filter((x): x is string => typeof x === "string")
        : [];
      return {
        metod: parsed.metod ?? "fixed",
        fixed_mebleg: Number(parsed.fixed_mebleg ?? 0),
        percent: Number(parsed.percent ?? 0),
        paylanma: Array.isArray(parsed.paylanma) ? parsed.paylanma : [],
        musteri_filter: filter,
        excluded_kontragent_ids: excluded,
      };
    } catch {
      return { ...DEFAULT_PROFIL, excluded_kontragent_ids: [] };
    }
  });
}

export const KATEQORIYA_META: Record<BonusKategoriya, { label: string; desc: string; hedefVahid: "faiz" | "mebleg" }> = {
  davamiyyet: {
    label: "Davamiyyət",
    desc: "İş günü davamiyyəti faizi — hədəf nə qədər iş günü gəlsin (%)",
    hedefVahid: "faiz",
  },
  tapsiriq: {
    label: "Tapşırıqlar vaxtında",
    desc: "Vaxtında tamamlanan tapşırıq faizi — hədəf %",
    hedefVahid: "faiz",
  },
  sehv_yoxlugu: {
    label: "Səhvsiz proseslər",
    desc: "Təsdiq mərkəzində rədd edilməyən sorğu faizi — hədəf %",
    hedefVahid: "faiz",
  },
  borc_yigim: {
    label: "Borc yığımı",
    desc: "Portfeldəki borcun yığılan faizi — hədəf %",
    hedefVahid: "faiz",
  },
  satis_hedef: {
    label: "Satış hədəfi",
    desc: "Aylıq satış məbləği — hədəf ₼",
    hedefVahid: "mebleg",
  },
};
