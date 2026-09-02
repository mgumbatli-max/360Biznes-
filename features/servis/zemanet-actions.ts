"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { nextDocNumber } from "@/lib/db/sened-nomre";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { requireServisActionPerm, bustServisCache } from "./access-guard";

type ActionResult<T = undefined> = { ok: true; id?: string; data?: T } | { ok: false; error: string };

const ZemanetSchema = z.object({
  musteri_id: z.string().uuid().optional().or(z.literal("")),
  musteri_ad: z.string().min(2).max(200),
  musteri_telefon: z.string().min(5).max(50).optional().or(z.literal("")),
  mehsul_id: z.string().uuid().optional().or(z.literal("")),
  mehsul_ad: z.string().min(2).max(255),
  serial_nomre: z.string().max(100).optional().or(z.literal("")),
  imei: z.string().max(50).optional().or(z.literal("")),
  baslama_tarixi: z.string(),
  ay_sayi: z.coerce.number().int().positive().max(120),
  satis_qiymeti: z.coerce.number().min(0).optional(),
  qeyd: z.string().optional(),
});

// Zəmanət kodu mərkəzi, atomik `nextDocNumber("zemanet")`-dən gəlir.
//
// Əvvəlki `nextUnikalKod()` iki qüsur daşıyırdı (audit 2026-09-02 ilə ölçülüb):
//   1) RACE — `findFirst + max+1`: 20 paralel çağırışda 20-si də eyni
//      `Z-YYYY-00001` kodunu alırdı (1/20 unikal).
//   2) LEKSİKOQRAFİK KİLİD — `orderBy: { unikal_kod: "desc" }` string
//      müqayisəsidir: POS-un random kodu (`Z-2026-ZZZZZZ`) ardıcıl koddan
//      (`Z-2026-00042`) "böyük" sayılırdı, `Number("ZZZZZZ")` isə NaN → 0.
//      Yəni bazada bir dənə random kod olan kimi generator həmişəlik
//      `Z-YYYY-00001` qaytarırdı.
// Görünən format (`Z-YYYY-NNNNN`) DISPLAY map ilə olduğu kimi qorunur.

/**
 * UTC-əsaslı tarix əlavə etmə — yerli timezone-dan asılı deyil.
 * baslama_tarixi YYYY-MM-DD kimi gəlir; saat 12:00 UTC-də ankerlənir ki
 * DST/timezone keçidləri 1 gün sürüşmə yaratmasın.
 */
function addMonthsUtc(baseIso: string, months: number): { baslama: Date; bitme: Date } {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(baseIso) ? baseIso : new Date(baseIso).toISOString().slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  const baslama = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const bitme = new Date(Date.UTC(y, m - 1 + months, d, 12, 0, 0));
  return { baslama, bitme };
}

export async function createZemanet(input: FormData): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["zemanet.yarat", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ZemanetSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const unikal_kod = await nextDocNumber(prisma, sahibkarId, "zemanet");
      const qr_token = crypto.randomBytes(24).toString("hex");
      const { baslama, bitme } = addMonthsUtc(d.baslama_tarixi, d.ay_sayi);

      const created = await prisma.zemanetler.create({
        data: {
          sahibkar_id: sahibkarId,
          unikal_kod,
          qr_token,
          musteri_id: d.musteri_id || null,
          musteri_ad: d.musteri_ad.trim(),
          musteri_telefon: d.musteri_telefon?.trim() || null,
          mehsul_id: d.mehsul_id || null,
          mehsul_ad: d.mehsul_ad.trim(),
          serial_nomre: d.serial_nomre || null,
          imei: d.imei || null,
          baslama_tarixi: baslama,
          bitme_tarixi: bitme,
          ay_sayi: d.ay_sayi,
          satis_qiymeti: d.satis_qiymeti ?? null,
          qeyd: d.qeyd ?? null,
          status: "aktiv",
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath("/servis/zemanet");
      bustServisCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yarat",
          resurs_nov: "zemanet",
          resurs_id: created.id,
          yeni_data: {
            unikal_kod,
            mehsul_ad: d.mehsul_ad,
            musteri_ad: d.musteri_ad,
            ay_sayi: d.ay_sayi,
            bitme_tarixi: bitme,
          },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[createZemanet]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
    }
  });
}

export async function deactivateZemanet(id: string): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["zemanet.idare", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Sahibkar yoxlaması + status filtri
      const r = await prisma.zemanetler.updateMany({
        where: { id, sahibkar_id: sahibkarId, status: { not: "legv" } },
        data: { status: "legv", yenilendi: new Date() },
      });
      if (r.count === 0) return { ok: false, error: "Zəmanət tapılmadı və ya artıq ləğv edilib" };
      revalidatePath("/servis/zemanet");
      bustServisCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "legv",
          resurs_nov: "zemanet",
          resurs_id: id,
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[deactivateZemanet]", e);
      return { ok: false, error: "Ləğv olunmadı" };
    }
  });
}

/**
 * Creates a new servis_qeydleri linked to a warranty.
 */
export async function createServisFromZemanet(zemanetId: string, problem: string): Promise<ActionResult> {
  const permCheck = await requireServisActionPerm(["servis.yarat", "zemanet.idare", "servis.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!problem || problem.trim().length < 5) return { ok: false, error: "Problem təsvir edilməlidir (ən azı 5 simvol)" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Sahibkar yoxlaması
      const z = await prisma.zemanetler.findFirst({
        where: { id: zemanetId, sahibkar_id: sahibkarId },
      });
      if (!z) return { ok: false, error: "Zəmanət tapılmadı" };
      if (z.status === "legv") return { ok: false, error: "Ləğv edilmiş zəmanət" };
      if (z.bitme_tarixi && z.bitme_tarixi < new Date()) {
        return { ok: false, error: "Zəmanət müddəti bitib" };
      }

      const result = await prisma.$transaction(async (tx) => {
        // Servis nömrəsi mərkəzi, atomik generatordan (audit 2026-09-01, release gate).
        //
        // Əvvəl burada `findFirst(startsWith SR-) + orderBy nomre desc + 1` vardı.
        // Üç qüsur:
        //   1) race-unsafe — iki paralel zəmanət→servis çevrilməsi eyni nömrəni alırdı;
        //   2) leksikoqrafik `desc` rəqəm sıralaması ilə üst-üstə düşmürdü;
        //   3) ƏN VACİBİ — `sened_nomre_counter` sayğacından XƏBƏRSİZ idi.
        //      `features/servis/actions.ts` artıq `nextDocNumber("servis")`
        //      işlədir; iki generator eyni cədvələ yazıb eyni nömrəni verə
        //      bilirdi və composite UNIQUE(sahibkar_id, nomre) altında bu,
        //      birbaşa P2002 demək idi.
        const nomre = await nextDocNumber(tx, sahibkarId, "servis");

        const created = await tx.servis_qeydleri.create({
          data: {
            sahibkar_id: sahibkarId,
            nomre,
            musteri_id: z.musteri_id,
            musteri_ad: z.musteri_ad ?? "—",
            musteri_telefon: z.musteri_telefon ?? "—",
            mehsul_id: z.mehsul_id,
            mehsul_ad: z.mehsul_ad ?? "—",
            mehsul_seri_nomresi: z.serial_nomre ?? z.imei,
            problem_tesviri: problem,
            qebul_eden_id: istifadeciId,
            status: "qebul_edildi",
            zemanet_var: true,
            zemanet_baslama: z.baslama_tarixi,
            zemanet_bitme: z.bitme_tarixi,
          },
        });
        await tx.zemanetler.update({
          where: { id: zemanetId },
          data: { servis_id: created.id, yenilendi: new Date() },
        });
        return created;
      });

      revalidatePath("/servis");
      revalidatePath("/servis/zemanet");
      bustServisCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yarat",
          resurs_nov: "servis",
          resurs_id: result.id,
          yeni_data: { zemanet_id: zemanetId, nomre: result.nomre, problem: problem.slice(0, 200) },
          sebeb: "Zəmanət əsasında servis qeydi yaradıldı",
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id: result.id };
    } catch (e) {
      console.error("[createServisFromZemanet]", e);
      return { ok: false, error: "Servis qeydi yaradılmadı" };
    }
  });
}

export async function printZemanetPdf(id: string): Promise<ActionResult<{ url: string }>> {
  const permCheck = await requireServisActionPerm(["zemanet.oxu", "servis.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return { ok: true, data: { url: `/api/zemanet/${id}/talon.pdf` } };
}
