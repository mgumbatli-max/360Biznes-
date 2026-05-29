import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { computeChannelPrice, computeNetReturn, type KanalQiymetFormula } from "./types";

export type KanalKomissiya = {
  id: number;
  kanal: string;
  komissiya_faiz: number;
  sabit_komissiya: number;
  catdirilma: number;
  bank_xerc: number;
  reklam_faiz: number;
  qaytarma_risk: number;
};

export type MehsulKanalQiymetRow = {
  kanal: string;          // kod (eyni zamanda komissiya cədvəlindəki açar)
  kanal_label: string;    // göstərilən ad
  formula: KanalQiymetFormula;
  manual_qiymet: number | null;     // metod=manual olduqda
  effective_qiymet: number;          // hesablanmış (oxumaq üçün)
  net_qazanc: number;                // bütün xərclər çıxılıb
  komissiya: KanalKomissiya | null;  // kanal ayarları (UI tooltip üçün)
};

/** Kanal komissiyaları cədvəlinin oxunması (Ayarlar səhifəsi üçün). */
export async function getKanalKomissiyaList(): Promise<KanalKomissiya[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.qiymet_kanal_komissiya.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { kanal: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      kanal: r.kanal,
      komissiya_faiz: Number(r.komissiya_faiz ?? 0),
      sabit_komissiya: Number(r.sabit_komissiya ?? 0),
      catdirilma: Number(r.catdirilma ?? 0),
      bank_xerc: Number(r.bank_xerc ?? 0),
      reklam_faiz: Number(r.reklam_faiz ?? 0),
      qaytarma_risk: Number(r.qaytarma_risk ?? 0),
    }));
  });
}

/**
 * Bir məhsul üçün bütün kanal qiymətlərini qaytarır.
 * Kanal-komissiya cədvəlində olan HƏR kanalı qaytarır — `qiymet_kanal`-da row yoxdursa
 * default `baza` qaydası ilə hesablanır.
 */
export async function getMehsulKanalQiymetler(
  mehsulId: string,
): Promise<{
  baza: number;
  min_baza: number;
  rows: MehsulKanalQiymetRow[];
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [mehsul, kanallar, overrides] = await Promise.all([
      prisma.mehsullar.findFirst({
        where: { id: mehsulId, sahibkar_id: sahibkarId },
        select: { satis_qiymeti: true, min_satis_qiymeti: true },
      }),
      prisma.qiymet_kanal_komissiya.findMany({
        where: { sahibkar_id: sahibkarId },
        orderBy: { kanal: "asc" },
      }),
      prisma.qiymet_kanal.findMany({
        where: { sahibkar_id: sahibkarId, mehsul_id: mehsulId },
      }),
    ]);

    const baza = Number(mehsul?.satis_qiymeti ?? 0);
    const min_baza = Number(mehsul?.min_satis_qiymeti ?? 0);
    const ovMap = new Map(overrides.map((o) => [o.kanal, o]));

    const rows: MehsulKanalQiymetRow[] = kanallar.map((kk) => {
      const ov = ovMap.get(kk.kanal);
      const formula: KanalQiymetFormula = (ov?.formula_kod as KanalQiymetFormula) ?? "baza";
      const manual = ov?.formula_kod === "manual" ? Number(ov.qiymet) : null;
      const km: KanalKomissiya = {
        id: kk.id,
        kanal: kk.kanal,
        komissiya_faiz: Number(kk.komissiya_faiz ?? 0),
        sabit_komissiya: Number(kk.sabit_komissiya ?? 0),
        catdirilma: Number(kk.catdirilma ?? 0),
        bank_xerc: Number(kk.bank_xerc ?? 0),
        reklam_faiz: Number(kk.reklam_faiz ?? 0),
        qaytarma_risk: Number(kk.qaytarma_risk ?? 0),
      };
      const effective = computeChannelPrice({
        baza,
        formula,
        manual,
        komissiya_faiz: km.komissiya_faiz,
        sabit_komissiya: km.sabit_komissiya,
        catdirilma: km.catdirilma,
        bank_xerc: km.bank_xerc,
        min_qiymet: min_baza,
      });
      const net = computeNetReturn({
        effective,
        komissiya_faiz: km.komissiya_faiz,
        sabit_komissiya: km.sabit_komissiya,
        catdirilma: km.catdirilma,
        bank_xerc: km.bank_xerc,
      });
      return {
        kanal: kk.kanal,
        kanal_label: kk.kanal,
        formula,
        manual_qiymet: manual,
        effective_qiymet: effective,
        net_qazanc: net,
        komissiya: km,
      };
    });

    return { baza, min_baza, rows };
  });
}

/**
 * Tək çağırışla (mehsul, kanal) → effektiv qiymət.
 * Hər inteqrasiya (Wolt sync, Birmarket export, marketplace API) bunu çağırır.
 */
export async function getEffectivePriceForChannel(
  mehsulId: string,
  kanalKod: string,
): Promise<number> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [mehsul, kanal, override] = await Promise.all([
      prisma.mehsullar.findFirst({
        where: { id: mehsulId, sahibkar_id: sahibkarId },
        select: { satis_qiymeti: true, min_satis_qiymeti: true },
      }),
      prisma.qiymet_kanal_komissiya.findFirst({
        where: { sahibkar_id: sahibkarId, kanal: kanalKod },
      }),
      prisma.qiymet_kanal.findFirst({
        where: { sahibkar_id: sahibkarId, mehsul_id: mehsulId, kanal: kanalKod },
      }),
    ]);

    const baza = Number(mehsul?.satis_qiymeti ?? 0);
    const formula: KanalQiymetFormula = (override?.formula_kod as KanalQiymetFormula) ?? "baza";
    const manual = override?.formula_kod === "manual" ? Number(override.qiymet) : null;

    return computeChannelPrice({
      baza,
      formula,
      manual,
      komissiya_faiz: Number(kanal?.komissiya_faiz ?? 0),
      sabit_komissiya: Number(kanal?.sabit_komissiya ?? 0),
      catdirilma: Number(kanal?.catdirilma ?? 0),
      bank_xerc: Number(kanal?.bank_xerc ?? 0),
      min_qiymet: Number(mehsul?.min_satis_qiymeti ?? 0),
    });
  });
}
