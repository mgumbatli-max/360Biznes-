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

    for (const r of rows) {
      // Find or insert salary row
      const existing = await prisma.maas_hesablamalar.findFirst({
        where: { istifadeci_id: r.istifadeci_id, il: year, ay: month },
        select: { id: true, status: true, kpi_bonus: true },
      });
      if (existing && existing.status && existing.status !== "cernovik") {
        skipped += 1;
        continue;
      }
      const totalBonus = r.commission_mebleg + r.bonus_mebleg;
      if (existing) {
        await prisma.maas_hesablamalar.update({
          where: { id: existing.id },
          data: { kpi_bonus: totalBonus, yenilendi: new Date() },
        });
      } else {
        await prisma.maas_hesablamalar.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: r.istifadeci_id,
            il: year,
            ay: month,
            kpi_bonus: totalBonus,
            status: "cernovik",
          },
        });
      }
      updated += 1;
    }
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
