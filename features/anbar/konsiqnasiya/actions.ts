"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const CreateSchema = z.object({
  kontragent_id: z.string().uuid(),
  mehsul_id: z.string().uuid(),
  istiqamet: z.enum(["verilen", "alinan"]),
  sayi: z.coerce.number().positive(),
  qiymet: z.coerce.number().min(0).optional().nullable(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createKons(formData: FormData): Promise<ActionResult> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["konsiqnasiya.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Atomik: konsiqnasiya qeydi + stok hərəkəti (yalnız "verilen" üçün
      // stok azalır, çünki mal bizdən qarşı tərəfə fiziki olaraq getdi).
      // "alinan" konsiqnasiyada mal bizdə qalır amma mülkiyyət başqasının
      // olduğu üçün stoka qoşulmur (separate ledger pattern — gələcəkdə əlavə).
      await prisma.$transaction(async (tx) => {
        const created = await tx.konsiqnasiya.create({
          data: {
            sahibkar_id: sahibkarId,
            kontragent_id: d.kontragent_id,
            mehsul_id: d.mehsul_id,
            istiqamet: d.istiqamet,
            sayi: d.sayi,
            qiymet: d.qiymet ?? null,
            yaradan_id: istifadeciId,
            hesablashma_status: "aciq",
          },
          select: { id: true },
        });

        if (d.istiqamet === "verilen") {
          // Stoku olan anbarı tap (ən çoxu olan)
          const stokRow = await tx.stok.findFirst({
            where: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              miqdar: { gte: d.sayi },
            },
            orderBy: { miqdar: "desc" },
            select: { anbar_id: true, miqdar: true },
          });
          if (!stokRow) {
            throw new Error("Konsiqnasiya verilməsi üçün kifayət qədər stok yoxdur");
          }
          // Atomic decrement
          const upd = await tx.stok.updateMany({
            where: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: stokRow.anbar_id,
              miqdar: { gte: d.sayi },
            },
            data: { miqdar: { decrement: d.sayi } },
          });
          if (upd.count === 0) {
            throw new Error("Stok kifayət deyil — paralel əməliyyat ola bilər");
          }
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: stokRow.anbar_id,
              nov: "konsiqnasiya_mexaric",
              miqdar: d.sayi,
              qiymet: d.qiymet ?? null,
              qeyd: `Konsiqnasiya verildi: ${created.id}`,
              ref_nov: "konsiqnasiya",
              ref_id: String(created.id),
              edilen_id: istifadeciId,
            },
          });
        }
      });

      revalidatePath("/anbar/konsiqnasiya");
      revalidatePath("/anbar/mehsullar");
      return { ok: true };
    } catch (e) {
      console.error("[createKons]", e);
      const msg = e instanceof Error ? e.message : "Yaradılmadı";
      return { ok: false, error: msg };
    }
  });
}

const ReturnSchema = z.object({
  id: z.coerce.number().int().positive(),
  sayi: z.coerce.number().positive(),
  hedef_anbar_id: z.coerce.number().int().positive().optional(),
});

/**
 * Konsiqnasiyada verilmiş malın bir hissəsini geri qəbul et:
 *   - `verilen` istiqamətdə: bizdən qarşı tərəfə getmiş mal qaytarılır → stoka qayıdır
 *   - `alinan` istiqamətdə: bizdə qalmış (mülkiyyət başqasının olan) mal qaytarılır → izləmə bağlanır
 */
export async function acceptKonsReturn(formData: FormData): Promise<ActionResult> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["konsiqnasiya.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ReturnSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.$transaction(async (tx) => {
        const k = await tx.konsiqnasiya.findFirst({
          where: { id: d.id, sahibkar_id: sahibkarId },
          select: { id: true, mehsul_id: true, anbar_id: true, istiqamet: true, sayi: true, satilan_say: true, qaliq_say: true, hesablashma_status: true },
        });
        if (!k) throw new Error("Konsiqnasiya tapılmadı");
        if (k.hesablashma_status !== "aciq") throw new Error("Bu konsiqnasiya artıq bağlanıb");
        const qaliq = Number(k.qaliq_say ?? k.sayi ?? 0);
        if (d.sayi > qaliq) throw new Error(`Qaytarılan sayı (${d.sayi}) qalıqdan (${qaliq}) çox ola bilməz`);

        // Verilen istiqamətdə bizim malımız idi → geri stoka qayıt
        if (k.istiqamet === "verilen" && k.mehsul_id) {
          const targetAnbar = d.hedef_anbar_id ?? k.anbar_id;
          if (!targetAnbar) throw new Error("Hədəf anbar göstərilməlidir");
          await tx.stok.upsert({
            where: { mehsul_id_anbar_id: { mehsul_id: k.mehsul_id, anbar_id: targetAnbar } },
            update: { miqdar: { increment: d.sayi } },
            create: { sahibkar_id: sahibkarId, mehsul_id: k.mehsul_id, anbar_id: targetAnbar, miqdar: d.sayi },
          });
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              mehsul_id: k.mehsul_id,
              anbar_id: targetAnbar,
              nov: "medaxil",
              miqdar: d.sayi,
              ref_nov: "konsiqnasiya_qaytarma",
              ref_id: String(k.id),
              edilen_id: istifadeciId,
              qeyd: `Konsiqnasiya geri qayıtdı (#${k.id})`,
            },
          });
        }

        // Qalıq və status yenilə
        const yeniQaliq = Math.max(0, qaliq - d.sayi);
        await tx.konsiqnasiya.update({
          where: { id: k.id },
          data: {
            qaliq_say: yeniQaliq,
            ...(yeniQaliq === 0 ? { hesablashma_status: "bagli", qaytarilma_tarixi: new Date() } : {}),
          },
        });
      });
      revalidatePath("/anbar/konsiqnasiya");
      revalidatePath("/anbar/mehsullar");
      return { ok: true };
    } catch (e) {
      console.error("[acceptKonsReturn]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Geri qəbul alınmadı" };
    }
  });
}

const SellSchema = z.object({
  id: z.coerce.number().int().positive(),
  sayi: z.coerce.number().positive(),
});

/**
 * Konsiqnasiyada verilmiş malın bir hissəsi satıldığını işarələ.
 * Stok təsiri yoxdur (mal artıq verilibmiş statusda azalmışdı);
 * yalnız `satilan_say` artır və `qaliq_say` azalır.
 *
 * Faktiki satış sənədi və müştəri-borc məntiqi xarici prosesdir — bu yalnız
 * konsiqnasiya tarixçəsinə qeyd düşür.
 */
export async function sellKonsignedItem(formData: FormData): Promise<ActionResult> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["konsiqnasiya.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = SellSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const k = await prisma.konsiqnasiya.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
        select: { sayi: true, satilan_say: true, qaliq_say: true, hesablashma_status: true },
      });
      if (!k) return { ok: false, error: "Konsiqnasiya tapılmadı" };
      if (k.hesablashma_status !== "aciq") return { ok: false, error: "Konsiqnasiya bağlıdır" };
      const qaliq = Number(k.qaliq_say ?? k.sayi ?? 0);
      if (d.sayi > qaliq) return { ok: false, error: "Satılan sayı qalıqdan çox ola bilməz" };
      const yeniSatilan = Number(k.satilan_say ?? 0) + d.sayi;
      const yeniQaliq = qaliq - d.sayi;
      await prisma.konsiqnasiya.update({
        where: { id: d.id },
        data: {
          satilan_say: yeniSatilan,
          qaliq_say: yeniQaliq,
          ...(yeniQaliq === 0 ? { hesablashma_status: "bagli" } : {}),
        },
      });
      revalidatePath("/anbar/konsiqnasiya");
      return { ok: true };
    } catch (e) {
      console.error("[sellKonsignedItem]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Yenilənmədi" };
    }
  });
}

const CompleteSchema = z.object({ id: z.coerce.number().int().positive() });

/**
 * Konsiqnasiyanı manuel olaraq bağla (qalıq yoxsa avtomatik bağlanır).
 */
export async function completeKons(formData: FormData): Promise<ActionResult> {
  const { requireAnbarActionPerm } = await import("../access-guard");
  const permCheck = await requireAnbarActionPerm(["konsiqnasiya.idare", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CompleteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const k = await prisma.konsiqnasiya.findFirst({
        where: { id: parsed.data.id, sahibkar_id: sahibkarId },
        select: { hesablashma_status: true },
      });
      if (!k) return { ok: false, error: "Konsiqnasiya tapılmadı" };
      if (k.hesablashma_status === "bagli") return { ok: false, error: "Artıq bağlanıb" };
      await prisma.konsiqnasiya.update({
        where: { id: parsed.data.id },
        data: { hesablashma_status: "bagli", qaytarilma_tarixi: new Date() },
      });
      revalidatePath("/anbar/konsiqnasiya");
      return { ok: true };
    } catch (e) {
      console.error("[completeKons]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Bağlanmadı" };
    }
  });
}
