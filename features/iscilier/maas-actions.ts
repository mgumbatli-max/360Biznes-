"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";

type Result = { ok: true; count?: number } | { ok: false; error: string };

const MonthSchema = z.object({
  il: z.coerce.number().int().min(2000).max(2100),
  ay: z.coerce.number().int().min(1).max(12),
});

const TAX_RATE = 0.14;
const SOCIAL_RATE = 0.03;
const COMMISSION_RATE = 0.03;

/**
 * Calculates draft bordro rows for the given month for every active employee.
 * If an existing maas_hesablamalar row exists (any status), it's left untouched.
 */
export async function calculateBordro(input: FormData): Promise<Result> {
  const parsed = MonthSchema.safeParse({
    il: input.get("il"),
    ay: input.get("ay"),
  });
  if (!parsed.success) return { ok: false, error: "Yanlış ay" };
  const { il, ay } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const start = new Date(il, ay - 1, 1);
      const end = new Date(il, ay, 1);

      const [employees, existing, sales, attendance, leaves] = await Promise.all([
        prisma.istifadeciler.findMany({
          where: { aktiv: true, isden_cixdi: null, sahibkar_id: sahibkarId },
        }),
        prisma.maas_hesablamalar.findMany({
          where: { il, ay, sahibkar_id: sahibkarId },
          select: { istifadeci_id: true },
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
        prisma.davamiyyet.groupBy({
          by: ["istifadeci_id", "status"],
          where: { sahibkar_id: sahibkarId, tarix: { gte: start, lt: end } },
          _count: { _all: true },
        }),
        prisma.isci_mezuniyyet
          .findMany({
            where: {
              sahibkar_id: sahibkarId,
              status: "tesdiq",
              OR: [
                { baslama: { gte: start, lt: end } },
                { bitme: { gte: start, lt: end } },
              ],
            },
          })
          .catch(() => []),
      ]);

      const existingSet = new Set(existing.map((e) => e.istifadeci_id));
      const salesMap = new Map<string, number>();
      for (const s of sales) {
        if (s.satis_meneceri_id) salesMap.set(s.satis_meneceri_id, Number(s._sum.son_mebleg ?? 0));
      }
      // attendance summary per user
      const attMap = new Map<string, { faktiki: number; qaib: number }>();
      for (const a of attendance) {
        const cur = attMap.get(a.istifadeci_id) ?? { faktiki: 0, qaib: 0 };
        if (a.status === "qaib") cur.qaib += a._count._all;
        else cur.faktiki += a._count._all;
        attMap.set(a.istifadeci_id, cur);
      }
      const leaveMap = new Map<string, number>();
      for (const lv of leaves) {
        const days = Math.max(1, Number(lv.gun_sayi ?? 1));
        leaveMap.set(lv.istifadeci_id, (leaveMap.get(lv.istifadeci_id) ?? 0) + days);
      }

      const norma = 22;
      let created = 0;

      for (const e of employees) {
        if (existingSet.has(e.id)) continue;
        const esas = Number(e.aylik_maas ?? 0);
        const att = attMap.get(e.id);
        const ish_faktiki = att?.faktiki ?? norma;
        const qaib_gun = att?.qaib ?? 0;
        const mezuniyyet_gun = leaveMap.get(e.id) ?? 0;
        const prorata = esas > 0 ? (esas * Math.min(ish_faktiki, norma)) / norma : 0;
        const komisyon = (salesMap.get(e.id) ?? 0) * COMMISSION_RATE;
        const gross = prorata + komisyon;
        const vergi = gross * TAX_RATE;
        const sosial = gross * SOCIAL_RATE;
        const son = gross - vergi - sosial;

        await prisma.maas_hesablamalar.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: e.id,
            il,
            ay,
            esas_maas: esas,
            ish_gun_norma: norma,
            ish_gun_faktiki: ish_faktiki,
            qaib_gun,
            mezuniyyet_gun,
            prorata_maas: prorata,
            kpi_bonus: 0,
            manual_bonus: 0,
            cerime: 0,
            avans: 0,
            son_meblegh: son,
            status: "cernovik",
            detal: {
              satis_komisyon: komisyon,
              vergi,
              sosial_sigorta: sosial,
              gross,
            },
            yaradan_id: istifadeciId,
          },
        });
        created++;
      }
      revalidatePath("/iscilier/maas");
      return { ok: true, count: created };
    } catch (e) {
      console.error("[calculateBordro]", e);
      return { ok: false, error: "Bordro hesablanmadı" };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   MANUAL BONUS / PENALTY                                            */
/* ------------------------------------------------------------------ */

const BonusSchema = z.object({
  istifadeci_id: z.string().uuid(),
  nov: z.enum(["bonus", "cerime"]),
  meblegh: z.coerce.number().positive(),
  sebeb: z.string().min(2).max(500),
  tarix: z.string().optional().or(z.literal("")),
});

export async function saveBonusOrPenalty(input: FormData): Promise<Result> {
  const parsed = BonusSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const refDate = d.tarix ? (parseLocalDate(d.tarix) ?? new Date()) : new Date();
      const il = refDate.getFullYear();
      const ay = refDate.getMonth() + 1;

      // Find or create draft bordro for that month
      let b = await prisma.maas_hesablamalar.findFirst({
        where: { sahibkar_id: sahibkarId, istifadeci_id: d.istifadeci_id, il, ay },
      });
      if (b && b.status === "odenilib") {
        return { ok: false, error: `${il}-${String(ay).padStart(2, "0")} ödənilib, redaktə oluna bilməz` };
      }
      if (!b) {
        const emp = await prisma.istifadeciler.findUnique({ where: { id: d.istifadeci_id } });
        if (!emp) return { ok: false, error: "İşçi tapılmadı" };
        const esas = Number(emp.aylik_maas ?? 0);
        b = await prisma.maas_hesablamalar.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: d.istifadeci_id,
            il,
            ay,
            esas_maas: esas,
            prorata_maas: esas,
            kpi_bonus: 0,
            manual_bonus: 0,
            cerime: 0,
            avans: 0,
            son_meblegh: esas,
            status: "cernovik",
            yaradan_id: istifadeciId,
          },
        });
      }

      const isBonus = d.nov === "bonus";
      const curBonus = Number(b.manual_bonus ?? 0);
      const curCerime = Number(b.cerime ?? 0);
      const nextBonus = isBonus ? curBonus + d.meblegh : curBonus;
      const nextCerime = !isBonus ? curCerime + d.meblegh : curCerime;
      const prorata = Number(b.prorata_maas ?? 0);
      const kpiBonus = Number(b.kpi_bonus ?? 0);
      const avans = Number(b.avans ?? 0);
      const detal = (b.detal as { satis_komisyon?: number } | null) ?? {};
      const komisyon = Number(detal.satis_komisyon ?? 0);
      const gross = prorata + kpiBonus + nextBonus + komisyon;
      const vergi = gross * 0.14;
      const sosial = gross * 0.03;
      const son = gross - nextCerime - avans - vergi - sosial;

      // Append to qeyd JSON in detal: { events: [...] }
      const events = ((b.detal as { events?: unknown[] } | null)?.events ?? []) as Array<{
        ts: string; nov: string; meblegh: number; sebeb: string; by?: string;
      }>;
      events.push({
        ts: new Date().toISOString(),
        nov: d.nov,
        meblegh: d.meblegh,
        sebeb: d.sebeb.trim(),
        by: istifadeciId ?? undefined,
      });

      await prisma.maas_hesablamalar.update({
        where: { id: b.id },
        data: {
          manual_bonus: nextBonus,
          cerime: nextCerime,
          son_meblegh: son,
          detal: { ...detal, events, vergi, sosial_sigorta: sosial, gross },
        },
      });
      revalidatePath("/iscilier/maas");
      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[saveBonusOrPenalty]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

const PaySchema = z.object({ id: z.coerce.number().int().positive() });

export async function payBordro(input: FormData): Promise<Result> {
  const parsed = PaySchema.safeParse({ id: input.get("id") });
  if (!parsed.success) return { ok: false, error: "Yanlış ID" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const b = await prisma.maas_hesablamalar.findUnique({ where: { id: parsed.data.id } });
      if (!b) return { ok: false, error: "Bordro tapılmadı" };
      if (b.status === "odenilib") return { ok: false, error: "Artıq ödənilib" };

      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.maas_hesablamalar.update({
          where: { id: b.id },
          data: { status: "odenilib", odenish_tarixi: now },
        });
        await tx.isci_odenisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: b.istifadeci_id,
            nov: "maas",
            meblegh: b.son_meblegh ?? 0,
            maas_hesab_id: b.id,
            qeyd: `${b.il}-${String(b.ay).padStart(2, "0")} ayı üçün maaş`,
            yaradan_id: istifadeciId,
          },
        });
      });
      revalidatePath("/iscilier/maas");
      return { ok: true };
    } catch (e) {
      console.error("[payBordro]", e);
      return { ok: false, error: "Ödəniş alınmadı" };
    }
  });
}

export async function bulkPayBordro(input: FormData): Promise<Result> {
  const parsed = MonthSchema.safeParse({ il: input.get("il"), ay: input.get("ay") });
  if (!parsed.success) return { ok: false, error: "Yanlış ay" };
  const { il, ay } = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const list = await prisma.maas_hesablamalar.findMany({
        where: { il, ay, sahibkar_id: sahibkarId, status: { not: "odenilib" } },
      });
      const now = new Date();
      let count = 0;
      for (const b of list) {
        await prisma.$transaction(async (tx) => {
          await tx.maas_hesablamalar.update({
            where: { id: b.id },
            data: { status: "odenilib", odenish_tarixi: now },
          });
          await tx.isci_odenisleri.create({
            data: {
              sahibkar_id: sahibkarId,
              istifadeci_id: b.istifadeci_id,
              nov: "maas",
              meblegh: b.son_meblegh ?? 0,
              maas_hesab_id: b.id,
              qeyd: `${il}-${String(ay).padStart(2, "0")} ayı üçün maaş (bulk)`,
              yaradan_id: istifadeciId,
            },
          });
        });
        count++;
      }
      revalidatePath("/iscilier/maas");
      return { ok: true, count };
    } catch (e) {
      console.error("[bulkPayBordro]", e);
      return { ok: false, error: "Toplu ödəniş alınmadı" };
    }
  });
}

const AdjustSchema = z.object({
  id: z.coerce.number().int().positive(),
  field: z.enum(["kpi_bonus", "manual_bonus", "cerime", "avans"]),
  value: z.coerce.number().min(0),
});

export async function adjustBordro(input: FormData): Promise<Result> {
  const parsed = AdjustSchema.safeParse({
    id: input.get("id"),
    field: input.get("field"),
    value: input.get("value"),
  });
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  return withTenant(async () => {
    try {
      const { id, field, value } = parsed.data;
      const b = await prisma.maas_hesablamalar.findUnique({ where: { id } });
      if (!b) return { ok: false, error: "Bordro tapılmadı" };
      if (b.status === "odenilib") return { ok: false, error: "Ödənilib, redaktə oluna bilməz" };

      const data: Record<string, unknown> = { [field]: value };
      const next = {
        prorata_maas: Number(b.prorata_maas ?? 0),
        kpi_bonus: Number(b.kpi_bonus ?? 0),
        manual_bonus: Number(b.manual_bonus ?? 0),
        cerime: Number(b.cerime ?? 0),
        avans: Number(b.avans ?? 0),
        [field]: value,
      };
      const detal = (b.detal as { satis_komisyon?: number; vergi?: number; sosial_sigorta?: number } | null) ?? {};
      const komisyon = Number(detal.satis_komisyon ?? 0);
      const gross = next.prorata_maas + next.kpi_bonus + next.manual_bonus + komisyon;
      const vergi = gross * TAX_RATE;
      const sosial = gross * SOCIAL_RATE;
      const son = gross - next.cerime - next.avans - vergi - sosial;
      data.son_meblegh = son;
      data.detal = { ...detal, vergi, sosial_sigorta: sosial, gross };

      await prisma.maas_hesablamalar.update({ where: { id }, data });
      revalidatePath("/iscilier/maas");
      return { ok: true };
    } catch (e) {
      console.error("[adjustBordro]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}
