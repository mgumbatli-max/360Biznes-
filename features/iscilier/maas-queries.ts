import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { BordroRow } from "./types";

export type MaasMonth = { il: number; ay: number };

function parseMonth(str?: string): MaasMonth {
  if (str) {
    const [y, m] = str.split("-").map(Number);
    if (y && m) return { il: y, ay: m };
  }
  const d = new Date();
  return { il: d.getFullYear(), ay: d.getMonth() + 1 };
}

export function monthStr({ il, ay }: MaasMonth): string {
  return `${il}-${String(ay).padStart(2, "0")}`;
}

/**
 * Returns the bordro table for the given month. For each ACTIVE employee:
 * - if a `maas_hesablamalar` row exists for il/ay → use it
 * - else compute a draft based on aylik_maas + this month's sales commission (3%)
 */
export async function getMaasTable(monthArg?: string): Promise<{
  month: MaasMonth;
  rows: BordroRow[];
  totals: {
    cemi: number;
    odenilib: number;
    odenmeyen: number;
    vergi: number;
  };
}> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const month = parseMonth(monthArg);
    const start = new Date(month.il, month.ay - 1, 1);
    const end = new Date(month.il, month.ay, 1);

    const [employees, bordros, sales] = await Promise.all([
      prisma.istifadeciler.findMany({
        where: { aktiv: true, isden_cixdi: null, sahibkar_id: sahibkarId },
        orderBy: { ad_soyad: "asc" },
      }),
      prisma.maas_hesablamalar.findMany({
        where: { il: month.il, ay: month.ay, sahibkar_id: sahibkarId },
      }),
      prisma.satis_sifarisleri.groupBy({
        by: ["satis_meneceri_id"],
        where: {
          sahibkar_id: sahibkarId,
          status: { not: "legv" },
          tarix: { gte: start, lt: end },
          satis_meneceri_id: { not: null },
        },
        _sum: { son_mebleg: true },
      }),
    ]);

    const bordroMap = new Map(bordros.map((b) => [b.istifadeci_id, b]));
    const salesMap = new Map<string, number>();
    for (const s of sales) {
      if (s.satis_meneceri_id) salesMap.set(s.satis_meneceri_id, Number(s._sum.son_mebleg ?? 0));
    }

    // Standard AZ payroll tax/social: simplified (14% gelir vergisi + 3% sosial)
    const TAX_RATE = 0.14;
    const SOCIAL_RATE = 0.03;
    const COMMISSION_RATE = 0.03; // 3% sales commission

    const rows: BordroRow[] = employees.map((e) => {
      const b = bordroMap.get(e.id);
      const esas = b ? Number(b.esas_maas ?? 0) : Number(e.aylik_maas ?? 0);
      const ish_norma = b?.ish_gun_norma ?? 22;
      const ish_faktiki = b?.ish_gun_faktiki ?? 22;
      const qaib = b?.qaib_gun ?? 0;
      const mezuniyyet = b?.mezuniyyet_gun ?? 0;
      const prorata = b ? Number(b.prorata_maas ?? 0) : esas;
      const kpi_bonus = b ? Number(b.kpi_bonus ?? 0) : 0;
      const manual_bonus = b ? Number(b.manual_bonus ?? 0) : 0;
      const cerime = b ? Number(b.cerime ?? 0) : 0;
      const avans = b ? Number(b.avans ?? 0) : 0;
      const satis_komisyon = b
        ? Number((b.detal as { satis_komisyon?: number } | null)?.satis_komisyon ?? 0)
        : (salesMap.get(e.id) ?? 0) * COMMISSION_RATE;
      const gross = prorata + kpi_bonus + manual_bonus + satis_komisyon;
      const vergi = b
        ? Number((b.detal as { vergi?: number } | null)?.vergi ?? 0)
        : gross * TAX_RATE;
      const sosial_sigorta = b
        ? Number((b.detal as { sosial_sigorta?: number } | null)?.sosial_sigorta ?? 0)
        : gross * SOCIAL_RATE;
      const net = b
        ? Number(b.son_meblegh ?? 0)
        : gross - cerime - avans - vergi - sosial_sigorta;

      return {
        id: b?.id ?? null,
        istifadeci_id: e.id,
        ad_soyad: e.ad_soyad,
        vezife: e.vezife,
        esas_maas: esas,
        ish_gun_norma: ish_norma,
        ish_gun_faktiki: ish_faktiki,
        qaib_gun: qaib,
        mezuniyyet_gun: mezuniyyet,
        prorata_maas: prorata,
        kpi_bonus,
        manual_bonus,
        satis_komisyon,
        cerime,
        avans,
        vergi,
        sosial_sigorta,
        net_meblegh: net,
        status: b?.status ?? "cernovik",
        odenish_tarixi: b?.odenish_tarixi ?? null,
      };
    });

    const cemi = rows.reduce((s, r) => s + r.net_meblegh, 0);
    const odenilib = rows.filter((r) => r.status === "odenilib").reduce((s, r) => s + r.net_meblegh, 0);
    const odenmeyen = cemi - odenilib;
    const vergi = rows.reduce((s, r) => s + r.vergi + r.sosial_sigorta, 0);

    return { month, rows, totals: { cemi, odenilib, odenmeyen, vergi } };
  });
}
