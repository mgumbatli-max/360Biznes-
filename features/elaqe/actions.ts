"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireElaqeActionPerm } from "./access-guard";
import { audit, diffObjects } from "@/lib/audit/log";
import { normalizePhone } from "@/lib/utils/normalize-phone";
import { checkSmsRateLimit } from "./sms-limit";

/** Maximum bulk emeliyyat say. */
const BULK_MAX = 1000;

/** Dashboard, nezaret və elaqe cache tag-larını birgə təzələ. */
function bustElaqeCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`elaqe:${sahibkarId}`, "max");
    revalidateTag(`ref:${sahibkarId}:musteriler`, "max");
  } catch {
    // tenant context yoxdur — TTL tutacaq
  }
}

const ContactSchema = z.object({
  id: z.string().uuid().optional(),
  nov: z.enum(["musteri", "techizatci", "her_ikisi"]),
  ad: z.string().min(2).max(200),
  voen: z.string().max(20).optional().or(z.literal("")),
  fin_kod: z.string().max(20).optional().or(z.literal("")),
  telefon: z.string().max(20).optional().or(z.literal("")),
  telefon2: z.string().max(30).optional().or(z.literal("")),
  whatsapp: z.string().max(30).optional().or(z.literal("")),
  email: z.string().max(150).optional().or(z.literal("")),
  unvan: z.string().max(500).optional().or(z.literal("")),
  sirket_adi: z.string().max(200).optional().or(z.literal("")),
  sheher: z.string().max(100).optional().or(z.literal("")),
  olke: z.string().max(100).optional().or(z.literal("")),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  // z.coerce.boolean Boolean("false")===true verir → checkbox açılanda da true olurdu.
  // Yalnız açıq "true"/"on" gələndə aktiv (forma gizli "false" input-u ilə birlikdə işləyir).
  aktiv: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()).default(true),
  qiymet_tipi: z.enum(["adi", "perakende", "topdan", "partnyor", "vip"]).optional(),
  borc_limiti: z.string().optional().or(z.literal("")),
  menecer_id: z.string().uuid().optional().or(z.literal("")),
});

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveContact(input: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(input.entries());
  // İcazə yoxlaması — nov-a görə müştəri yoxsa təchizatçı
  const isEdit = !!(raw as { id?: string }).id;
  const nov = String(raw.nov ?? "musteri");
  const baseRes = nov === "techizatci" ? "techizatci" : "musteri";
  const requiredPerm = isEdit ? `${baseRes}.duzelt` : `${baseRes}.yarat`;
  const permCheck = await requireElaqeActionPerm(requiredPerm);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  // Treat empty string emails as null instead of failing zod email rule
  if (raw.email && typeof raw.email === "string" && raw.email.trim() !== "") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw.email)) {
      return { ok: false, error: "Email düzgün deyil" };
    }
  }
  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstField = Object.keys(fieldErrors)[0] ?? null;
    const firstMsg = Object.values(fieldErrors).flat()[0] ?? null;
    console.error("[saveContact] validation failed:", {
      raw_summary: {
        nov: raw.nov, qiymet_tipi: raw.qiymet_tipi, ad: raw.ad,
        borc_limiti: raw.borc_limiti, menecer_id: raw.menecer_id,
      },
      fieldErrors,
    });
    return {
      ok: false,
      error: firstField && firstMsg
        ? `Sahə "${firstField}": ${firstMsg}`
        : firstMsg ?? "Forma yanlışdır",
    };
  }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // borc_limiti — string ya da number gələ bilər; boş gəlirsə null
      let borcLimitNum: number | null = null;
      if (d.borc_limiti != null && String(d.borc_limiti).trim() !== "") {
        const n = Number(String(d.borc_limiti).trim().replace(",", "."));
        if (Number.isFinite(n) && n >= 0) borcLimitNum = n;
      }
      const data = {
        nov: d.nov,
        ad: d.ad.trim(),
        voen: d.voen?.trim() || null,
        fin_kod: d.fin_kod?.trim() || null,
        telefon: d.telefon?.trim() || null,
        telefon2: d.telefon2?.trim() || null,
        whatsapp: d.whatsapp?.trim() || null,
        email: d.email?.trim() || null,
        unvan: d.unvan?.trim() || null,
        sirket_adi: d.sirket_adi?.trim() || null,
        sheher: d.sheher?.trim() || null,
        olke: d.olke?.trim() || null,
        qeyd: d.qeyd?.trim() || null,
        aktiv: d.aktiv,
        ...(d.qiymet_tipi ? { qiymet_tipi: d.qiymet_tipi } : {}),
        ...(borcLimitNum !== null && Number.isFinite(borcLimitNum)
          ? { borc_limiti: borcLimitNum }
          : { borc_limiti: null }),
        menecer_id: d.menecer_id && d.menecer_id !== "" ? d.menecer_id : null,
      };
      let id: string;
      if (d.id) {
        const before = await prisma.kontragentler.findUnique({
          where: { id: d.id },
          select: { ad: true, nov: true, telefon: true, email: true, voen: true, aktiv: true, borc_limiti: true, qiymet_tipi: true, menecer_id: true },
        });
        const updated = await prisma.kontragentler.update({ where: { id: d.id }, data });
        id = updated.id;
        const diff = diffObjects(before as Record<string, unknown> | null, data as unknown as Record<string, unknown>);
        if (diff) await audit("yenile", "kontragent", id, { evvelki_data: diff.before, yeni_data: diff.after });
      } else {
        // getirdi_id — yaradılma anında qeyd olunur, sonradan dəyişmir
        const created = await prisma.kontragentler.create({
          data: { sahibkar_id: sahibkarId, getirdi_id: istifadeciId, ...data },
        });
        id = created.id;
        await audit("yarat", "kontragent", id, { yeni_data: { ad: d.ad, nov: d.nov, telefon: d.telefon || null, voen: d.voen || null } });

        // Yeni müştəri (musteri / her_ikisi) avto-loyalty kart yaratma
        // Müəyyən şərt: yalnız müştəri tipi və avto-loyalty global ayarı açıqdır
        if (d.nov === "musteri" || d.nov === "her_ikisi") {
          try {
            const autoCfg = await prisma.ayarlar.findFirst({
              where: { sahibkar_id: sahibkarId, qrup: "loyalty", acar: "auto_create" },
              select: { deyer: true },
            });
            // Default: avto-aktiv (sahibkar söndürə bilər)
            const autoEnabled = autoCfg?.deyer !== "false";
            if (autoEnabled) {
              const kartKod = `LK${Date.now().toString().slice(-9)}`;
              await prisma.loyalty_cards.create({
                data: {
                  sahibkar_id: sahibkarId,
                  kontragent_id: id,
                  kart_kod: kartKod,
                  tier: "bronze",
                },
              }).catch((e) => {
                // Unique constraint xətası — kart artıq mövcuddursa səssiz keç
                console.warn("[saveContact loyalty]", e);
              });
            }
          } catch (e) {
            console.warn("[saveContact loyalty auto]", e);
          }
        }
      }
      revalidatePath("/elaqe");
      revalidatePath("/elaqe/musteriler");
      revalidatePath("/elaqe/techizatcilar");
      revalidatePath("/kampaniyalar/loyalty");
      return { ok: true, id };
    } catch (e) {
      console.error("[saveContact]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deactivateContact(id: string, force?: boolean): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    }
> {
  const permCheck = await requireElaqeActionPerm("musteri.sil");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    try {
      const { sahibkarId } = requireTenant();
      const before = await prisma.kontragentler.findUnique({ where: { id }, select: { ad: true, nov: true, aktiv: true } });
      if (!before) return { ok: false, error: "Kontragent tapılmadı" };

      // 🛑 Strukturlu blocker yoxlaması
      if (!force) {
        const { findContactBlockers } = await import("@/lib/blockers/find-contact-blockers");
        const blockers = await findContactBlockers(id, sahibkarId);
        if (blockers.length > 0) {
          return {
            ok: false,
            error: `${before.ad} aktiv borc və ya açıq sənədləri olduğu üçün deaktivləşdirilə bilməz.`,
            blockers,
            hint: "Aşağıdakı sənədləri əvvəlcə bağlayın (ödənişlər, satışlar, alışlar, servis). Sonra yenidən cəhd edin.",
          };
        }
      }

      await prisma.kontragentler.update({ where: { id }, data: { aktiv: false } });
      await audit("sil", "kontragent", id, { evvelki_data: before as Record<string, unknown> | null, sebeb: force ? "force deactivate" : "deactivate (soft delete)" });
      revalidatePath("/elaqe");
      revalidatePath("/elaqe/musteriler");
      revalidatePath("/elaqe/techizatcilar");
      return { ok: true };
    } catch (e) {
      console.error("[deactivateContact]", e);
      return { ok: false, error: "Deaktivləşdirilmədi" };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   NOTES                                                            */
/* ------------------------------------------------------------------ */

const NoteSchema = z.object({
  kontragent_id: z.string().uuid(),
  matn: z.string().min(1).max(4000),
});

export async function addContactNote(input: FormData): Promise<ActionResult> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = NoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Qeyd düzgün deyil və ya boşdur" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const created = await prisma.musteri_qeydleri.create({
        data: {
          sahibkar_id: sahibkarId,
          musteri_id: parsed.data.kontragent_id,
          iscini_id: istifadeciId,
          matn: parsed.data.matn,
        },
      });
      revalidatePath(`/elaqe/musteriler/${parsed.data.kontragent_id}`);
      revalidatePath(`/elaqe/techizatcilar/${parsed.data.kontragent_id}`);
      bustElaqeCache();
      await audit("yarat", "musteri_qeyd", String(created.id), {
        yeni_data: { kontragent_id: parsed.data.kontragent_id, uzunluq: parsed.data.matn.length },
      });
      return { ok: true, id: String(created.id) };
    } catch (e) {
      console.error("[addContactNote]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Qeyd əlavə edilmədi: ${msg}` };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   FOLLOWUPS                                                        */
/* ------------------------------------------------------------------ */

const FollowupSchema = z.object({
  id: z.string().optional(),
  kontragent_id: z.string().uuid(),
  basliq: z.string().min(2).max(200),
  qeyd: z.string().max(2000).optional().or(z.literal("")),
  vaxt: z.string().min(8),
  prioritet: z.enum(["dusuk", "normal", "yuksek", "kritik"]).optional(),
  kanal: z.enum(["zeng", "whatsapp", "email", "gorush", "diger"]).optional(),
});

export async function addFollowup(input: FormData): Promise<ActionResult> {
  const permCheck = await requireElaqeActionPerm("elaqe.followup");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = FollowupSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const created = await prisma.contact_followups.create({
        data: {
          sahibkar_id: sahibkarId,
          kontragent_id: d.kontragent_id,
          istifadeci_id: istifadeciId,
          basliq: d.basliq.trim(),
          qeyd: d.qeyd?.trim() || null,
          vaxt: new Date(d.vaxt),
          prioritet: d.prioritet ?? "normal",
          kanal: d.kanal ?? null,
          status: "gozleyir",
          yaradan_id: istifadeciId,
        },
      });
      revalidatePath("/elaqe/followup");
      revalidatePath(`/elaqe/musteriler/${d.kontragent_id}`);
      revalidatePath(`/elaqe/techizatcilar/${d.kontragent_id}`);
      bustElaqeCache();
      await audit("yarat", "contact_followup", String(created.id), {
        yeni_data: {
          kontragent_id: d.kontragent_id,
          basliq: d.basliq,
          vaxt: new Date(d.vaxt).toISOString(),
          prioritet: d.prioritet ?? "normal",
        },
      });
      return { ok: true, id: String(created.id) };
    } catch (e) {
      console.error("[addFollowup]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Follow-up yaradılmadı: ${msg}` };
    }
  });
}

export async function completeFollowup(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("elaqe.followup");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.contact_followups.findUnique({
        where: { id },
        select: { kontragent_id: true, basliq: true, status: true },
      });
      if (!before) return { ok: false, error: "Follow-up tapılmadı" };
      await prisma.contact_followups.update({
        where: { id },
        data: { status: "tamamlandi", edildi_de: new Date() },
      });
      revalidatePath("/elaqe/followup");
      if (before.kontragent_id) {
        revalidatePath(`/elaqe/musteriler/${before.kontragent_id}`);
        revalidatePath(`/elaqe/techizatcilar/${before.kontragent_id}`);
      }
      bustElaqeCache();
      await audit("tamamla", "contact_followup", String(id), {
        evvelki_data: { status: before.status },
        yeni_data: { status: "tamamlandi", basliq: before.basliq },
      });
      return { ok: true };
    } catch (e) {
      console.error("[completeFollowup]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tamamlanmadı: ${msg}` };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   PAYMENT — record incoming payment, decrement borc                */
/* ------------------------------------------------------------------ */

const PaymentSchema = z.object({
  kontragent_id: z.string().uuid(),
  mebleg: z.coerce.number().positive(),
  tarix: z.string().optional().or(z.literal("")),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function recordContactPayment(input: FormData): Promise<ActionResult> {
  // Borc qarşı ödəniş qəbulu — `odenis.qebul` maliyyə icazəsi tələb edir
  // QA-orta: əvvəl yanlış "musteri.duzelt" yoxlanırdı — odenis.qebul gate-i bypass olunurdu
  const permCheck = await requireElaqeActionPerm("odenis.qebul");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = PaymentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findUnique({
        where: { id: d.kontragent_id },
        select: { id: true, ad: true, nov: true },
      });
      if (!k) return { ok: false, error: "Kontragent tapılmadı" };

      // FIFO ALLOCATION — bütün açıq qaimələrə ardıcıl tətbiq et
      const openSales = await prisma.satis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          musteri_id: d.kontragent_id,
          status: { not: "legv" },
          qaralama: { not: true },
          odenis_nov: { in: ["nisye", "borc"] },
        },
        select: { id: true, son_mebleg: true, odenilmis: true, nomre: true, tarix: true },
        // QA-orta: tarix @db.Date — eyni günün qaimələrində FIFO sırası deterministik olsun
        orderBy: [{ tarix: "asc" }, { yaradildi: "asc" }, { nomre: "asc" }],
      });
      const openWithQalig = openSales
        .map((s) => ({
          id: s.id,
          nomre: s.nomre,
          son_mebleg: Number(s.son_mebleg ?? 0),
          odenilmis: Number(s.odenilmis ?? 0),
          qalig: +(Number(s.son_mebleg ?? 0) - Number(s.odenilmis ?? 0)).toFixed(2),
        }))
        .filter((s) => s.qalig > 0.01);

      // Paylama: hər qaiməyə qalıq qədər ödəniş yazılır, artıq məbləğ növbətiyə.
      // Bütün qaimələr bağlandıqdan sonra qalan məbləğ avansa düşür.
      let remain = d.mebleg;
      const distribution: Array<{
        sale_id: string; nomre: string; applied: number; closed: boolean;
      }> = [];
      for (const inv of openWithQalig) {
        if (remain <= 0.001) break;
        const apply = Math.min(remain, inv.qalig);
        distribution.push({
          sale_id: inv.id,
          nomre: inv.nomre,
          applied: +apply.toFixed(2),
          closed: apply >= inv.qalig - 0.001,
        });
        remain -= apply;
      }
      const toAdvance = +Math.max(0, remain).toFixed(2);

      // Atomic update — bütün qaimələr + müştəri balansı + finance_op
      await prisma.$transaction(async (tx) => {
        // 1. Hər seçilmiş qaiməyə ödəniş tətbiq et
        for (const dist of distribution) {
          await tx.satis_sifarisleri.update({
            where: { id: dist.sale_id },
            data: {
              odenilmis: { increment: dist.applied },
              ...(dist.closed ? { status: "tamamlandi" } : {}),
              yenilendi: new Date(),
            },
          });
        }

        // 2. Müştəri avans (qalan məbləğ varsa)
        if (toAdvance > 0) {
          await tx.kontragentler.update({
            where: { id: d.kontragent_id },
            data: {
              avans: { increment: toAdvance },
              son_temas: new Date(),
              yenilendi: new Date(),
            },
          });
        } else {
          await tx.kontragentler.update({
            where: { id: d.kontragent_id },
            data: { son_temas: new Date(), yenilendi: new Date() },
          });
        }

        // 3. Source-of-truth recalc
        const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
        await recalculateCustomerBalance(d.kontragent_id, tx);

        // 4. Finance operation log
        const typeKod = "musteri_odenis";
        let type = await tx.finance_operation_types
          .findUnique({ where: { kod: typeKod } })
          .catch(() => null);
        if (!type) {
          type = await tx.finance_operation_types
            .create({
              data: { kod: typeKod, ad: "Müştəri ödənişi", qrup: "borc", y_n: "daxil" },
            })
            .catch(() => null);
        }
        if (type) {
          const primarySaleId = distribution[0]?.sale_id ?? null;
          // QA-K14: əvvəl hesab_id YOX idi — pul heç bir kassa/bank hesabına
          // düşmürdü (account-balance hesab_id üzrə cəmləyir). Default aktiv
          // nağd hesab (yoxsa ilk aktiv) işlədilir + balans recalc.
          const defHesab = await tx.maliye_hesablari.findFirst({
            where: { sahibkar_id: sahibkarId, aktiv: true, nov: "negd" },
            orderBy: { yaradildi: "asc" },
            select: { id: true },
          }) ?? await tx.maliye_hesablari.findFirst({
            where: { sahibkar_id: sahibkarId, aktiv: true },
            orderBy: { yaradildi: "asc" },
            select: { id: true },
          });
          await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: type.kod,
              y_n: type.y_n,
              tarix: d.tarix ? new Date(d.tarix) : new Date(),
              meblegh: d.mebleg,
              azn_meblegh: d.mebleg,
              hesab_id: defHesab?.id ?? null,
              kontragent_id: d.kontragent_id,
              satis_id: primarySaleId,
              qeyd:
                distribution.length > 1
                  ? `Ödəniş ${distribution.length} qaiməyə bölündü${toAdvance > 0 ? `, ${toAdvance.toFixed(2)} ₼ avans` : ""}`
                  : distribution.length === 1
                  ? `Qaimə #${distribution[0].nomre} ödənişi${toAdvance > 0 ? `, ${toAdvance.toFixed(2)} ₼ avans` : ""}`
                  : `Avans ödənişi (${toAdvance.toFixed(2)} ₼)`,
              yaradan_id: istifadeciId,
            },
          });
          if (defHesab?.id) {
            const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
            await recalculateAccountBalance(defHesab.id, tx);
          }
        }
      });

      try {
        await audit("yenile", "kontragent_borc", d.kontragent_id, {
          yeni_data: {
            odenis: d.mebleg,
            type: "musteri_odenis",
            distribution: distribution.map((x) => ({ qaime: x.nomre, applied: x.applied, closed: x.closed })),
            avans: toAdvance,
          },
          sebeb:
            distribution.length === 0
              ? `Avans ödənişi ${d.mebleg.toFixed(2)} ₼ — ${k.ad}`
              : `${distribution.length} qaiməyə FIFO ödəniş — ${k.ad}`,
        });
      } catch { /* non-fatal */ }

      revalidatePath("/elaqe/borclar");
      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/musteriler/${d.kontragent_id}`);
      revalidatePath(`/elaqe/techizatcilar/${d.kontragent_id}`);
      revalidatePath("/ticaret/satislar");
      revalidatePath("/maliyye");
      return { ok: true, id: d.kontragent_id };
    } catch (e) {
      console.error("[recordContactPayment]", e);
      return { ok: false, error: e instanceof Error ? e.message : "Ödəniş qeyd edilmədi" };
    }
  });
}

export async function resetContactDebt(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("elaqe.borc");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.kontragentler.findUnique({ where: { id }, select: { borc: true, alacaq: true, ad: true } });
      if (!before) return { ok: false, error: "Kontragent tapılmadı" };

      // Source-of-truth-da borc/alacaq real cədvəllərdən hesablanır.
      // Manual "sıfırlama" mənasız — yalnız cache yenilənərsə, recalc onu geri qaytarır.
      // Faktiki borcu sıfırlamaq üçün açıq sənədlər (alış/satış/servis) bağlanmalıdır.
      const { calculateCustomerBalance } = await import("@/lib/balance/customer-balance");
      const { calculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
      const [musteriBal, techizatciBal] = await Promise.all([
        calculateCustomerBalance(id),
        calculateSupplierBalance(id),
      ]);

      if (musteriBal.acik_qaime_sayi > 0 || techizatciBal.acik_alis_sayi > 0) {
        const detay = [
          musteriBal.acik_qaime_sayi > 0 ? `${musteriBal.acik_qaime_sayi} açıq satış/servis` : "",
          techizatciBal.acik_alis_sayi > 0 ? `${techizatciBal.acik_alis_sayi} açıq alış` : "",
        ].filter(Boolean).join(", ");
        return {
          ok: false,
          error: `Borc sıfırlanmaz: ${detay} mövcuddur. Əvvəlcə həmin sənədləri ödəyin və ya ləğv edin.`,
        };
      }

      // Aktiv sənəd yoxdursa — yalnız cache-i source-of-truth ilə uyğunlaşdır.
      const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
      const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
      await recalculateCustomerBalance(id);
      await recalculateSupplierBalance(id);

      await audit("yenile", "kontragent_borc", id, {
        evvelki_data: { borc: before.borc ?? null, alacaq: before.alacaq ?? null, ad: before.ad ?? null },
        yeni_data: { borc: 0, alacaq: 0 },
        sebeb: "Borc cache source-of-truth ilə yeniləndi",
      });
      revalidatePath("/elaqe/borclar");
      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/musteriler/${id}`);
      bustElaqeCache();
      return { ok: true };
    } catch (e) {
      console.error("[resetContactDebt]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Sıfırlanmadı: ${msg}` };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   MERGE DUPLICATES                                                 */
/* ------------------------------------------------------------------ */

export async function mergeContacts(
  primaryId: string,
  mergeIds: string[]
): Promise<{ ok: true; merged: number } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!primaryId || mergeIds.length === 0) {
    return { ok: false, error: "Birləşdiriləcək kontragent seçilməyib" };
  }
  if (mergeIds.length > 50) {
    return { ok: false, error: "Bir dəfəyə 50-dən çox kontragent birləşdirilə bilməz" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      let mergedCount = 0;
      // Use a transaction
      await prisma.$transaction(async (tx) => {
        for (const otherId of mergeIds) {
          if (otherId === primaryId) continue;
          const other = await tx.kontragentler.findUnique({ where: { id: otherId } });
          if (!other) continue;

          // Re-link all related records to primary
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reassign: Array<{ model: any; field: string }> = [
            { model: tx.satis_sifarisleri, field: "musteri_id" },
            { model: tx.alis_sifarisleri, field: "techiazatci_id" },
            { model: tx.servis_qeydleri, field: "musteri_id" },
            { model: tx.finance_operations, field: "kontragent_id" },
            { model: tx.musteri_qeydleri, field: "musteri_id" },
            { model: tx.contact_communications, field: "kontragent_id" },
            { model: tx.contact_followups, field: "kontragent_id" },
            { model: tx.contact_people, field: "kontragent_id" },
            { model: tx.leads, field: "kontragent_id" },
          ];
          for (const r of reassign) {
            try {
              await r.model.updateMany({
                where: { [r.field]: otherId },
                data: { [r.field]: primaryId },
              });
            } catch {
              /* table may not support, skip */
            }
          }

          // Borc/alacaq source-of-truth recalc — manual cəm YOX, real cədvəllərdən hesab olunur.
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
          await recalculateCustomerBalance(primaryId, tx);
          await recalculateSupplierBalance(primaryId, tx);

          // Log merge
          await tx.contact_merge_logs.create({
            data: {
              sahibkar_id: sahibkarId,
              ana_kontragent_id: primaryId,
              silinen_id: otherId,
              silinen_ad: other.ad,
              silinen_telefon: other.telefon,
              istifadeci_id: istifadeciId,
              qeyd: "UI mərge",
            },
          });

          // Soft delete: mark inactive (avoid FK cascade issues)
          await tx.kontragentler.update({
            where: { id: otherId },
            data: { aktiv: false, qeyd: `MERGED INTO ${primaryId}` },
          });
          mergedCount += 1;
        }
      });
      revalidatePath("/elaqe/dublikat");
      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/musteriler/${primaryId}`);
      bustElaqeCache();
      if (mergedCount > 0) {
        await audit("birlesdir", "kontragent", primaryId, {
          yeni_data: { silinen_idler: mergeIds, sayi: mergedCount },
          sebeb: "Dublikat birləşdirmə",
        });
      }
      return { ok: true, merged: mergedCount };
    } catch (e) {
      console.error("[mergeContacts]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Birləşdirmə uğursuz oldu: ${msg}` };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   CSV / XLSX IMPORT                                                 */
/* ------------------------------------------------------------------ */

export type ImportRow = {
  ad?: string;
  telefon?: string;
  email?: string;
  voen?: string;
  fin_kod?: string;
  sirket_adi?: string;
  unvan?: string;
  sheher?: string;
  nov?: string;
};

export async function importContacts(
  rows: ImportRow[],
  defaultNov: "musteri" | "techizatci" = "musteri"
): Promise<{ ok: true; created: number; skipped: number; dublikat: number } | { ok: false; error: string }> {
  // İcazə — yeni kontragent yaradılır
  const requiredPerm = defaultNov === "techizatci" ? "techizatci.yarat" : "musteri.yarat";
  const permCheck = await requireElaqeActionPerm(requiredPerm);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "Sətr yoxdur" };
  }
  if (rows.length > 2000) {
    return { ok: false, error: "Bir dəfəyə 2000-dən çox sətir mümkün deyil" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    let created = 0;
    let skipped = 0;
    let dublikat = 0;
    try {
      // Batch daxili dedup üçün set-lər (eyni batch-də təkrarları sılmaq üçün)
      const seenPhones = new Set<string>();
      const seenEmails = new Set<string>();
      const seenVoens = new Set<string>();

      for (const r of rows) {
        const ad = (r.ad ?? "").trim();
        if (!ad || ad.length < 2) {
          skipped++;
          continue;
        }
        const telefonRaw = (r.telefon ?? "").trim() || null;
        const telefonNorm = normalizePhone(telefonRaw);
        const email = ((r.email ?? "").trim() || null)?.toLowerCase() ?? null;
        const voen = (r.voen ?? "").trim() || null;
        const fin_kod = (r.fin_kod ?? "").trim() || null;

        // 1) Eyni batch-də artıq görünübmü?
        if ((telefonNorm && seenPhones.has(telefonNorm))
          || (email && seenEmails.has(email))
          || (voen && seenVoens.has(voen))) {
          dublikat++;
          continue;
        }

        // 2) DB-də mövcuddur — normallaşdırılmış telefon ilə müqayisə üçün
        // raw SQL: kontragentler-də normallaşdırma olmadığı üçün hər iki yöndə yoxlayırıq
        if (telefonNorm || email || voen) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orList: any[] = [];
          if (email) orList.push({ email });
          if (voen) orList.push({ voen });
          if (telefonNorm) {
            // Bir az daha geniş yoxlama — son 9 rəqəm uyğun gəlirsə dublikat
            const last9 = telefonNorm.slice(-9);
            if (last9.length >= 7) {
              orList.push({ telefon: { endsWith: last9 } });
            } else if (telefonRaw) {
              orList.push({ telefon: telefonRaw });
            }
          }
          if (orList.length > 0) {
            const exists = await prisma.kontragentler.findFirst({ where: { OR: orList } });
            if (exists) {
              dublikat++;
              continue;
            }
          }
        }

        let nov: "musteri" | "techizatci" | "her_ikisi" = defaultNov;
        if (r.nov === "techizatci" || r.nov === "təchizatçı") nov = "techizatci";
        else if (r.nov === "her_ikisi") nov = "her_ikisi";
        else if (r.nov === "musteri" || r.nov === "müştəri") nov = "musteri";

        await prisma.kontragentler.create({
          data: {
            sahibkar_id: sahibkarId,
            getirdi_id: istifadeciId,
            nov,
            ad,
            telefon: telefonRaw,
            email,
            voen,
            fin_kod,
            sirket_adi: (r.sirket_adi ?? "").trim() || null,
            unvan: (r.unvan ?? "").trim() || null,
            sheher: (r.sheher ?? "").trim() || null,
            aktiv: true,
            qiymet_tipi: "adi",
          },
        });
        if (telefonNorm) seenPhones.add(telefonNorm);
        if (email) seenEmails.add(email);
        if (voen) seenVoens.add(voen);
        created++;
      }
      revalidatePath("/elaqe");
      revalidatePath("/elaqe/musteriler");
      revalidatePath("/elaqe/techizatcilar");
      bustElaqeCache();
      await audit("idxal", "kontragent", null, {
        yeni_data: { defaultNov, ümumi: rows.length, yaradilan: created, atilan: skipped, dublikat },
      });
      return { ok: true, created, skipped, dublikat };
    } catch (e) {
      console.error("[importContacts]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `İdxal alınmadı: ${msg}` };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   BULK OPERATIONS                                                  */
/* ------------------------------------------------------------------ */

export async function bulkAddTag(
  ids: string[],
  tagName: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const name = tagName.trim();
  if (!name) return { ok: false, error: "Tag adı boşdur" };
  if (!ids.length) return { ok: false, error: "Seçim yoxdur" };
  if (ids.length > BULK_MAX) return { ok: false, error: `Bir dəfəyə ${BULK_MAX}-dən çox kontragent ola bilməz` };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const tag = await prisma.contact_tags.upsert({
        where: { sahibkar_id_ad: { sahibkar_id: sahibkarId, ad: name } },
        update: {},
        create: { sahibkar_id: sahibkarId, ad: name },
      });
      let count = 0;
      for (const id of ids) {
        try {
          await prisma.contact_tag_links.upsert({
            where: { kontragent_id_tag_id: { kontragent_id: id, tag_id: tag.id } },
            update: {},
            create: { kontragent_id: id, tag_id: tag.id },
          });
          count++;
        } catch { /* skip */ }
      }
      revalidatePath("/elaqe");
      bustElaqeCache();
      await audit("bulk_yenile", "kontragent", null, {
        yeni_data: { emeliyyat: "tag_elave", tag: name, kontragent_say: count, secilen_say: ids.length },
      });
      return { ok: true, count };
    } catch (e) {
      console.error("[bulkAddTag]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tag əlavə olunmadı: ${msg}` };
    }
  });
}

export async function bulkAssignManager(
  ids: string[],
  menecerId: string | null
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!ids.length) return { ok: false, error: "Seçim yoxdur" };
  if (ids.length > BULK_MAX) return { ok: false, error: `Bir dəfəyə ${BULK_MAX}-dən çox kontragent ola bilməz` };
  return withTenant(async () => {
    try {
      const res = await prisma.kontragentler.updateMany({
        where: { id: { in: ids } },
        data: { menecer_id: menecerId || null },
      });
      revalidatePath("/elaqe");
      bustElaqeCache();
      await audit("bulk_yenile", "kontragent", null, {
        yeni_data: { emeliyyat: "menecer_teyin", menecer_id: menecerId, kontragent_say: res.count },
      });
      return { ok: true, count: res.count };
    } catch (e) {
      console.error("[bulkAssignManager]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Menecer təyin olunmadı: ${msg}` };
    }
  });
}

export async function bulkSetStatus(
  ids: string[],
  aktiv: boolean
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const requiredPerm = aktiv ? "musteri.duzelt" : "musteri.sil";
  const permCheck = await requireElaqeActionPerm(requiredPerm);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!ids.length) return { ok: false, error: "Seçim yoxdur" };
  if (ids.length > BULK_MAX) return { ok: false, error: `Bir dəfəyə ${BULK_MAX}-dən çox kontragent ola bilməz` };
  return withTenant(async () => {
    try {
      const res = await prisma.kontragentler.updateMany({
        where: { id: { in: ids } },
        data: { aktiv },
      });
      revalidatePath("/elaqe");
      bustElaqeCache();
      await audit(aktiv ? "bulk_aktivlesh" : "bulk_deaktivlesh", "kontragent", null, {
        yeni_data: { kontragent_say: res.count, secilen_say: ids.length },
      });
      return { ok: true, count: res.count };
    } catch (e) {
      console.error("[bulkSetStatus]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Status dəyişmədi: ${msg}` };
    }
  });
}

export async function bulkDeactivate(
  ids: string[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  return bulkSetStatus(ids, false);
}

/* ------------------------------------------------------------------ */
/*   AUTO-MERGE SUGGEST                                                */
/* ------------------------------------------------------------------ */

export async function autoMergeSuggested(
  pairs: { primaryId: string; mergeIds: string[] }[]
): Promise<{ ok: true; merged: number } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!pairs.length) return { ok: false, error: "Birləşdirmək üçün qrup yoxdur" };
  if (pairs.length > 50) return { ok: false, error: "Bir dəfəyə 50-dən çox qrup mümkün deyil" };
  let merged = 0;
  for (const p of pairs) {
    if (!p.primaryId || !p.mergeIds?.length) continue;
    const res = await mergeContacts(p.primaryId, p.mergeIds);
    if (res.ok) merged++;
  }
  return { ok: true, merged };
}

/* ------------------------------------------------------------------ */
/*   SMS LAUNCHER — real provider (Twilio/MSG91/AzerCell) ya mock     */
/* ------------------------------------------------------------------ */

export async function sendContactSms(
  kontragentId: string,
  template: string
): Promise<{ ok: true; provider: string; is_mock: boolean } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("elaqe.bulk_mesaj");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!template?.trim()) return { ok: false, error: "Mətn boşdur" };
  if (template.length > 1600) return { ok: false, error: "SMS mətni 1600 simvoldan uzun ola bilməz" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Rate limit yoxla
      const rate = await checkSmsRateLimit(1);
      if (!rate.ok) return { ok: false, error: rate.error };

      const k = await prisma.kontragentler.findUnique({ where: { id: kontragentId } });
      if (!k) return { ok: false, error: "Kontragent tapılmadı" };
      if (!k.telefon) return { ok: false, error: "Telefon nömrəsi yoxdur" };

      const { sendSms } = await import("@/lib/sms/adapter");
      const smsResult = await sendSms({ to: k.telefon, body: template.trim() });
      if (!smsResult.ok) {
        return { ok: false as const, error: smsResult.error };
      }

      await prisma.contact_communications.create({
        data: {
          sahibkar_id: sahibkarId,
          kontragent_id: kontragentId,
          istifadeci_id: istifadeciId,
          kanal: "sms",
          istiqamet: "cixan",
          metn: template.trim(),
          m_vzu: smsResult.is_mock ? "SMS (mock)" : `SMS (${smsResult.provider})`,
        },
      });
      await prisma.kontragentler.update({
        where: { id: kontragentId },
        data: { son_temas: new Date() },
      });
      revalidatePath(`/elaqe/musteriler/${kontragentId}`);
      revalidatePath("/elaqe/followup");
      bustElaqeCache();
      await audit("gonder", "sms", kontragentId, {
        yeni_data: {
          provider: smsResult.provider,
          is_mock: smsResult.is_mock,
          metn_uzunluq: template.length,
          telefon: k.telefon,
        },
      });
      return { ok: true as const, provider: smsResult.provider, is_mock: smsResult.is_mock };
    } catch (e) {
      console.error("[sendContactSms]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `SMS göndərilmədi: ${msg}` };
    }
  });
}

/**
 * YENI: Bulk SMS — bir mətn şablonu çoxlu kontragentə göndərir.
 * Hər kontaktın adı `{{ad}}`, borcu `{{borc}}` ilə əvəz olunur.
 */
export async function sendBulkContactSms(
  kontragentIds: string[],
  template: string,
): Promise<
  | { ok: true; sent: number; failed: number; skipped: number; details: { id: string; ok: boolean; error?: string }[] }
  | { ok: false; error: string }
> {
  const permCheck = await requireElaqeActionPerm("elaqe.bulk_mesaj");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!template?.trim()) return { ok: false, error: "Mətn boşdur" };
  if (template.length > 1600) return { ok: false, error: "SMS mətni 1600 simvoldan uzun ola bilməz" };
  if (!kontragentIds.length) return { ok: false, error: "Seçim yoxdur" };
  if (kontragentIds.length > 500) return { ok: false, error: "Bir dəfəyə 500-dən çox SMS göndərilə bilməz" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    // Toplu rate limit yoxla — gərək olan say
    const rate = await checkSmsRateLimit(kontragentIds.length);
    if (!rate.ok) return { ok: false, error: rate.error };

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const details: { id: string; ok: boolean; error?: string }[] = [];

    const { sendSms } = await import("@/lib/sms/adapter");
    const contacts = await prisma.kontragentler.findMany({
      where: { id: { in: kontragentIds } },
      select: { id: true, ad: true, telefon: true, borc: true },
    });
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    for (const id of kontragentIds) {
      const k = contactMap.get(id);
      if (!k) {
        skipped++;
        details.push({ id, ok: false, error: "Tapılmadı" });
        continue;
      }
      if (!k.telefon) {
        skipped++;
        details.push({ id, ok: false, error: "Telefon yoxdur" });
        continue;
      }
      // Template-də placeholder-ləri əvəz et
      const text = template
        .replace(/\{\{\s*ad\s*\}\}/g, k.ad ?? "")
        .replace(/\{\{\s*borc\s*\}\}/g, String(k.borc ?? 0))
        .slice(0, 1600);

      try {
        const r = await sendSms({ to: k.telefon, body: text });
        if (!r.ok) {
          failed++;
          details.push({ id, ok: false, error: r.error });
          continue;
        }
        await prisma.contact_communications.create({
          data: {
            sahibkar_id: sahibkarId,
            kontragent_id: id,
            istifadeci_id: istifadeciId,
            kanal: "sms",
            istiqamet: "cixan",
            metn: text,
            m_vzu: r.is_mock ? "Bulk SMS (mock)" : `Bulk SMS (${r.provider})`,
          },
        });
        await prisma.kontragentler.update({
          where: { id },
          data: { son_temas: new Date() },
        }).catch(() => null);
        sent++;
        details.push({ id, ok: true });
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : "naməlum";
        details.push({ id, ok: false, error: msg });
      }
    }

    revalidatePath("/elaqe");
    revalidatePath("/elaqe/followup");
    revalidatePath("/elaqe/borclar");
    bustElaqeCache();
    await audit("bulk_gonder", "sms", null, {
      yeni_data: { sent, failed, skipped, hedef_say: kontragentIds.length, sablon_uzunluq: template.length },
    });

    return { ok: true, sent, failed, skipped, details };
  });
}

/* ------------------------------------------------------------------ */
/*   TAGS                                                             */
/* ------------------------------------------------------------------ */

export async function addContactTag(
  kontragentId: string,
  tagName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const name = tagName.trim();
  if (!name) return { ok: false, error: "Tag adı boşdur" };
  if (name.length > 50) return { ok: false, error: "Tag adı 50 simvoldan uzun ola bilməz" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const tag = await prisma.contact_tags.upsert({
        where: { sahibkar_id_ad: { sahibkar_id: sahibkarId, ad: name } },
        update: {},
        create: { sahibkar_id: sahibkarId, ad: name },
      });
      await prisma.contact_tag_links.upsert({
        where: { kontragent_id_tag_id: { kontragent_id: kontragentId, tag_id: tag.id } },
        update: {},
        create: { kontragent_id: kontragentId, tag_id: tag.id },
      });
      revalidatePath(`/elaqe/musteriler/${kontragentId}`);
      revalidatePath(`/elaqe/techizatcilar/${kontragentId}`);
      bustElaqeCache();
      await audit("tag_elave", "kontragent", kontragentId, {
        yeni_data: { tag: name },
      });
      return { ok: true };
    } catch (e) {
      console.error("[addContactTag]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tag əlavə edilmədi: ${msg}` };
    }
  });
}

export async function removeContactTag(
  kontragentId: string,
  tagId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const tag = await prisma.contact_tags.findUnique({ where: { id: tagId }, select: { ad: true } });
      await prisma.contact_tag_links.deleteMany({
        where: { kontragent_id: kontragentId, tag_id: tagId },
      });
      revalidatePath(`/elaqe/musteriler/${kontragentId}`);
      revalidatePath(`/elaqe/techizatcilar/${kontragentId}`);
      bustElaqeCache();
      await audit("tag_sil", "kontragent", kontragentId, {
        yeni_data: { tag: tag?.ad ?? String(tagId) },
      });
      return { ok: true };
    } catch (e) {
      console.error("[removeContactTag]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tag silinmədi: ${msg}` };
    }
  });
}
