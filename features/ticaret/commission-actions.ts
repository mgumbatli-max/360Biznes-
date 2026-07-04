"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import {
  getSalespersonCommissions,
  type SalespersonCommission,
} from "./commission-queries";
import { audit } from "@/lib/audit/log";
import { requireTicaretActionPerm, bustTicaretCache } from "./access-guard";

const TierSchema = z.object({
  from: z.coerce.number().min(0),
  percent: z.coerce.number().min(0).max(100),
});

const SaveSchema = z.object({
  tiers: z.array(TierSchema).min(1),
  bonus_on_target: z.coerce.number().min(0).default(0),
});

const QRUP = "ticaret";
const ACAR_TIERS = "commission_tiers";
const ACAR_BONUS_TIER = "commission_bonus_tier";

/**
 * Save tiered commission rules. Validates and persists to ayarlar.
 */
export async function saveCommissionRules(
  input: z.input<typeof SaveSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const permCheck = await requireTicaretActionPerm(["komissiya.idare", "ayarlar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış format" };
  }
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const sorted = parsed.data.tiers.slice().sort((a, b) => a.from - b.from);
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR_TIERS } },
      update: { deyer: JSON.stringify(sorted), nov: "json", yenilendi: new Date() },
      create: {
        sahibkar_id: sahibkarId,
        qrup: QRUP,
        acar: ACAR_TIERS,
        deyer: JSON.stringify(sorted),
        nov: "json",
        tesvir: "Satıcı komissiya mərhələləri",
      },
    });
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR_BONUS_TIER } },
      update: { deyer: String(parsed.data.bonus_on_target), nov: "number", yenilendi: new Date() },
      create: {
        sahibkar_id: sahibkarId,
        qrup: QRUP,
        acar: ACAR_BONUS_TIER,
        deyer: String(parsed.data.bonus_on_target),
        nov: "number",
        tesvir: "Hədəfə çatdıqda bonus (AZN)",
      },
    });
    revalidatePath("/ayarlar/komissiya-qaydalari");
    revalidatePath("/hesabatlar/emekdas");
    bustTicaretCache();
    try {
      await audit("yenile", "commission_rules", null, {
        yeni_data: { tier_count: sorted.length, bonus_on_target: parsed.data.bonus_on_target, tiers: sorted },
        sebeb: "Komissiya qaydaları yeniləndi",
      });
    } catch { /* non-fatal */ }
    return { ok: true };
  });
}

/**
 * Compute monthly commission for all salespeople and write per-user entries
 * into the existing `maas_hesablamalar` row for that month (kpi_bonus +=
 * commission + bonus). Idempotent — re-running for the same month overrides
 * the previous kpi_bonus value if the row was system-generated (status
 * "cernovik"). Already-paid rows are skipped.
 */
export async function calculateCommission(
  year: number,
  month: number,
): Promise<
  | { ok: true; updated: number; skipped: number; rows: SalespersonCommission[] }
  | { ok: false; error: string }
> {
  const permCheck = await requireTicaretActionPerm(["komissiya.idare", "maas.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, error: "İl yanlışdır" };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: "Ay yanlışdır" };
  }

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await getSalespersonCommissions(year, month);
    let updated = 0;
    let skipped = 0;

    // QA-audit-E: çoxsətirli bordro yazıları TRANZAKSIYAsız idi → dövrənin ortasında DB xətası
    // yarımçıq bordro commit-i buraxırdı (+ xam istisna). İndi bütün loop bir $transaction-da (atomik).
    await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      // Find or insert salary row
      const existing = await tx.maas_hesablamalar.findFirst({
        where: { istifadeci_id: r.istifadeci_id, il: year, ay: month },
        select: {
          id: true, status: true, kpi_bonus: true,
          prorata_maas: true, manual_bonus: true, cerime: true, avans: true, detal: true,
        },
      });
      if (existing && existing.status && existing.status !== "cernovik") {
        skipped += 1;
        continue;
      }
      const totalBonus = r.commission_mebleg + r.bonus_mebleg;
      if (existing) {
        // QA-K27: əvvəl yalnız kpi_bonus yazılırdı — son_meblegh (NET)
        // dbgenerated default UPDATE-də yenilənmir, komissiya işçiyə heç vaxt
        // çatmırdı. adjustBordro ilə EYNİ düsturla tam yenidən hesabla.
        const prorata = Number(existing.prorata_maas ?? 0);
        const manualBonus = Number(existing.manual_bonus ?? 0);
        const cerime = Number(existing.cerime ?? 0);
        const avans = Number(existing.avans ?? 0);
        const detal = (existing.detal as Record<string, unknown> | null) ?? {};
        // QA-orta: ikiqat komissiya — pilləli tarif hesablananda sabit 3%
        // (detal.satis_komisyon) sıfırlanır; eyni satış iki dəfə komissiyalaşmasın
        // (maas-queries/maas-table/bordro-print hər ikisini cəmləyirdi).
        const gross = prorata + totalBonus + manualBonus;
        const vergi = gross * 0.14;
        const sosial = gross * 0.03;
        const son = gross - cerime - avans - vergi - sosial;
        await tx.maas_hesablamalar.update({
          where: { id: existing.id },
          data: {
            kpi_bonus: totalBonus,
            son_meblegh: son,
            detal: { ...detal, satis_komisyon: 0, vergi, sosial_sigorta: sosial, gross },
            yenilendi: new Date(),
          },
        });
      } else {
        // QA-K28: əvvəl create-də esas_maas/prorata boş qalırdı — natamam
        // bordro (baz maaş 0, NET=vergi-siz yalnız komissiya). İşçinin aylıq
        // maaşı ilə tam doldur.
        const isci = await tx.istifadeciler.findFirst({
          where: { id: r.istifadeci_id },
          select: { aylik_maas: true },
        });
        const esas = Number(isci?.aylik_maas ?? 0);
        const gross = esas + totalBonus;
        const vergi = gross * 0.14;
        const sosial = gross * 0.03;
        const son = gross - vergi - sosial;
        await tx.maas_hesablamalar.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: r.istifadeci_id,
            il: year,
            ay: month,
            esas_maas: esas,
            prorata_maas: esas,
            kpi_bonus: totalBonus,
            son_meblegh: son,
            detal: { vergi, sosial_sigorta: sosial, gross },
            status: "cernovik",
          },
        });
      }
      updated += 1;
    }
    });
    revalidatePath("/iscilier");
    revalidatePath("/hesabatlar/emekdas");
    bustTicaretCache();
    try {
      await audit("hesabla", "commission", null, {
        yeni_data: { il: year, ay: month, updated, skipped, total_rows: rows.length },
        sebeb: `Komissiya hesablandı: ${year}-${String(month).padStart(2, "0")}`,
      });
    } catch { /* non-fatal */ }
    return { ok: true, updated, skipped, rows };
  });
}
