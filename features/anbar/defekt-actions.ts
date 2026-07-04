"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { safeStockDecrement } from "@/lib/db/stock-guards";
import { requireAnbarActionPerm } from "./access-guard";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export const DEFEKT_KATEQORIYALAR = [
  { value: "zedeli", label: "Zədələnmiş", desc: "Daşıma və ya saxlama zamanı zədə" },
  { value: "muddet_kecib", label: "Son istifadə vaxtı keçib", desc: "Expired" },
  { value: "istehsal_qusuru", label: "İstehsal qüsuru", desc: "Brak — istehsalçıya qaytarıla bilər" },
  { value: "yanlis_idxal", label: "Yanlış idxal", desc: "Səhv mal və ya artıq miqdar" },
  { value: "ogurluq", label: "Oğurluq / itki", desc: "İnventarda tapılmadı" },
  { value: "test_acilis", label: "Test üçün açılmış", desc: "Sınaq və ya demo" },
  { value: "musteri_qaytarmasi", label: "Müştəri qaytarması", desc: "Defektli qaytarma" },
  { value: "diger", label: "Digər", desc: "Sərbəst səbəb" },
] as const;

const DefektSchema = z.object({
  mehsul_id: z.string().uuid(),
  defekt_anbar_id: z.coerce.number().int().positive(),
  menbe_anbar_id: z.coerce.number().int().positive().optional(),
  miqdar: z.coerce.number().positive(),
  kateqoriya: z.enum([
    "zedeli", "muddet_kecib", "istehsal_qusuru", "yanlis_idxal",
    "ogurluq", "test_acilis", "musteri_qaytarmasi", "diger",
  ]),
  sebeb: z.string().min(3, "Səbəb ən az 3 simvol olmalıdır").max(2000),
  sekil_url: z.string().max(500).optional().or(z.literal("")),
});

export async function recordDefekt(
  input: z.input<typeof DefektSchema>,
): Promise<ActionResult<{ id: string }>> {
  const permCheck = await requireAnbarActionPerm(["stok.duzelt", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = DefektSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Defekt anbarının növünü yoxla
        const defektAnbar = await tx.anbarlar.findFirst({
          where: { id: d.defekt_anbar_id, sahibkar_id: sahibkarId },
          select: { id: true, nov: true, ad: true },
        });
        if (!defektAnbar) throw new Error("Defekt anbarı tapılmadı");
        if (defektAnbar.nov !== "defekt" && defektAnbar.nov !== "karantın") {
          throw new Error(`«${defektAnbar.ad}» defekt/karantın anbarı deyil — Ayarlar > Anbar bölməsindən növünü dəyiş`);
        }

        // Mənbə anbardan stoku düş (əgər verilibsə)
        if (d.menbe_anbar_id && d.menbe_anbar_id !== d.defekt_anbar_id) {
          const dec = await safeStockDecrement(tx, {
            mehsulId: d.mehsul_id,
            anbarId: d.menbe_anbar_id,
            miqdar: d.miqdar,
          });
          if (!dec.ok) throw new Error(dec.error);

          // Defekt anbarına əlavə et
          await tx.stok.upsert({
            where: {
              mehsul_id_anbar_id: { mehsul_id: d.mehsul_id, anbar_id: d.defekt_anbar_id },
            },
            update: { miqdar: { increment: d.miqdar } },
            create: {
              sahibkar_id: sahibkarId,
              mehsul_id: d.mehsul_id,
              anbar_id: d.defekt_anbar_id,
              miqdar: d.miqdar,
            },
          });

          // Hərəkət qeydləri
          await tx.anbar_hereketleri.createMany({
            data: [
              {
                sahibkar_id: sahibkarId,
                anbar_id: d.menbe_anbar_id,
                mehsul_id: d.mehsul_id,
                nov: "defekt_cixis",
                miqdar: d.miqdar,
                ref_nov: "defekt",
                edilen_id: istifadeciId,
              },
              {
                sahibkar_id: sahibkarId,
                anbar_id: d.defekt_anbar_id,
                mehsul_id: d.mehsul_id,
                nov: "defekt_giris",
                miqdar: d.miqdar,
                ref_nov: "defekt",
                edilen_id: istifadeciId,
              },
            ],
          });
        }

        // Defekt qeydi
        const defekt = await tx.defekt_qeydleri.create({
          data: {
            sahibkar_id: sahibkarId,
            anbar_id: d.defekt_anbar_id,
            mehsul_id: d.mehsul_id,
            miqdar: new Prisma.Decimal(d.miqdar.toFixed(3)),
            kateqoriya: d.kateqoriya,
            sebeb: d.sebeb.trim(),
            sekil_url: d.sekil_url || null,
            yaradan_id: istifadeciId,
          },
          select: { id: true },
        });

        return defekt;
      });

      try {
        await audit("yarat", "defekt_qeydi", result.id, {
          yeni_data: {
            mehsul_id: d.mehsul_id,
            miqdar: d.miqdar,
            kateqoriya: d.kateqoriya,
            sebeb: d.sebeb,
          },
          sebeb: `Defekt qeyd: ${d.kateqoriya} — ${d.sebeb.slice(0, 80)}`,
        });
      } catch { /* non-fatal */ }

      revalidatePath("/anbar/defekt");
      revalidatePath("/anbar/mehsullar");
      return { ok: true, data: { id: result.id } };
    } catch (e) {
      console.error("[recordDefekt]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Qeyd alınmadı" };
    }
  });
}

const ResolveSchema = z.object({
  id: z.string().uuid(),
  qerar: z.enum(["silindi", "qaytarildi", "satilibdi"]),
  // Geri qaytaranda hansı standart anbara dönəcəyini deyə bilərik. Yoxsa
  // defekt-dən çıxan əməliyyat üçün ilkin anbar istifadə olunmur — istifadəçi
  // əl ilə təyin etməlidir.
  hedef_anbar_id: z.coerce.number().int().positive().optional(),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function resolveDefekt(input: z.input<typeof ResolveSchema>): Promise<ActionResult> {
  const permCheck = await requireAnbarActionPerm(["stok.duzelt", "anbar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = ResolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const before = await prisma.defekt_qeydleri.findFirst({
        where: { id: d.id, sahibkar_id: sahibkarId },
        select: {
          kateqoriya: true,
          sebeb: true,
          status: true,
          sekil_url: true,
          mehsul_id: true,
          anbar_id: true,
          miqdar: true,
        },
      });
      if (!before) return { ok: false, error: "Tapılmadı" };
      if (before.status !== "aktiv") return { ok: false, error: "Bu qeyd artıq həll olunub" };

      const miqdar = Number(before.miqdar ?? 0);
      const mehsulId = before.mehsul_id;
      const defektAnbarId = before.anbar_id;

      await prisma.$transaction(async (tx) => {
        // 🔒 QA-audit-B: atomik compare-and-swap — qeydi 'aktiv'→qərar CLAIM et. Status yoxlaması
        // əvvəl tx-dən KƏNARDA idi + updateMany guard-sız → paralel/təkrar resolve stoku ikiqat
        // hərəkət etdirirdi. İndi yalnız biri claim-i keçir (idempotent).
        const claim = await tx.defekt_qeydleri.updateMany({
          where: { id: d.id, sahibkar_id: sahibkarId, status: "aktiv" },
          data: {
            status: d.qerar,
            sebeb: d.qeyd?.trim() ? `${before.sebeb}\n— Qərar: ${d.qeyd.trim()}` : before.sebeb,
            yenilendi: new Date(),
          },
        });
        if (claim.count === 0) throw new Error("Bu qeyd artıq həll olunub (paralel əməliyyat)");
        // QƏRARA görə stok hərəkəti
        // ─ silindi: defekt anbardan fiziki olaraq çıxır (zərər)
        // ─ qaytarildi: defekt anbardan çıxır → hədəf anbara medaxil
        // ─ satilibdi: defekt anbardan çıxır (avtomatik satış sənədi yaratmırıq —
        //   satış ayrıca POS-dan və ya yeni satış-dan edilməlidir)
        if (miqdar > 0 && mehsulId && defektAnbarId) {
          if (d.qerar === "silindi" || d.qerar === "satilibdi") {
            const dec = await safeStockDecrement(tx, {
              mehsulId,
              anbarId: defektAnbarId,
              miqdar,
            });
            if (!dec.ok) throw new Error(dec.error);
            await tx.anbar_hereketleri.create({
              data: {
                sahibkar_id: sahibkarId,
                anbar_id: defektAnbarId,
                mehsul_id: mehsulId,
                nov: "mexaric",
                miqdar,
                ref_nov: "defekt_resolve",
                ref_id: d.id,
                edilen_id: istifadeciId,
                qeyd: `Defekt qərar: ${d.qerar}`,
              },
            });
          } else if (d.qerar === "qaytarildi") {
            if (!d.hedef_anbar_id) {
              throw new Error("Qaytarmaq üçün hədəf anbar göstərilməlidir");
            }
            // Defekt anbardan çıxar
            const dec = await safeStockDecrement(tx, {
              mehsulId,
              anbarId: defektAnbarId,
              miqdar,
            });
            if (!dec.ok) throw new Error(dec.error);
            // Hədəf anbara qaytar
            await tx.stok.upsert({
              where: { mehsul_id_anbar_id: { mehsul_id: mehsulId, anbar_id: d.hedef_anbar_id } },
              update: { miqdar: { increment: miqdar } },
              create: {
                sahibkar_id: sahibkarId,
                mehsul_id: mehsulId,
                anbar_id: d.hedef_anbar_id,
                miqdar,
              },
            });
            await tx.anbar_hereketleri.createMany({
              data: [
                {
                  sahibkar_id: sahibkarId,
                  anbar_id: defektAnbarId,
                  mehsul_id: mehsulId,
                  nov: "transfer_cixis",
                  miqdar,
                  ref_nov: "defekt_resolve",
                  ref_id: d.id,
                  edilen_id: istifadeciId,
                  qeyd: "Defekt → əsas anbara qayıtdı",
                },
                {
                  sahibkar_id: sahibkarId,
                  anbar_id: d.hedef_anbar_id,
                  mehsul_id: mehsulId,
                  nov: "transfer_giris",
                  miqdar,
                  ref_nov: "defekt_resolve",
                  ref_id: d.id,
                  edilen_id: istifadeciId,
                  qeyd: "Defekt-dən qaytarıldı",
                },
              ],
            });
          }
        }

        // (status/sebeb artıq yuxarıdakı atomik claim-də təyin olundu — təkrar update lazım deyil)
      });

      try {
        await audit("yenile", "defekt_qeydi", d.id, {
          evvelki_data: { status: "aktiv" },
          yeni_data: { status: d.qerar, qeyd: d.qeyd, hedef_anbar_id: d.hedef_anbar_id ?? null },
          sebeb: `Defekt qərarı: ${d.qerar}`,
        });
      } catch { /* non-fatal */ }

      revalidatePath("/anbar/defekt");
      revalidatePath("/anbar/mehsullar");
      return { ok: true };
    } catch (e) {
      console.error("[resolveDefekt]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Yenilənmədi" };
    }
  });
}
