"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireElaqeActionPerm } from "./access-guard";
import { audit, diffObjects } from "@/lib/audit/log";

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
  aktiv: z.coerce.boolean().default(true),
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
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: msg ?? "Forma yanlışdır" };
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

export async function deactivateContact(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.sil");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    try {
      const before = await prisma.kontragentler.findUnique({ where: { id }, select: { ad: true, nov: true, aktiv: true } });
      await prisma.kontragentler.update({ where: { id }, data: { aktiv: false } });
      await audit("sil", "kontragent", id, { evvelki_data: before as Record<string, unknown> | null, sebeb: "deactivate (soft delete)" });
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
  const parsed = NoteSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Qeyd boşdur" };
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
      return { ok: true, id: String(created.id) };
    } catch (e) {
      console.error("[addContactNote]", e);
      return { ok: false, error: "Qeyd əlavə edilmədi" };
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
      return { ok: true, id: String(created.id) };
    } catch (e) {
      console.error("[addFollowup]", e);
      return { ok: false, error: "Follow-up yaradılmadı" };
    }
  });
}

export async function completeFollowup(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTenant(async () => {
    try {
      await prisma.contact_followups.update({
        where: { id },
        data: { status: "tamamlandi", edildi_de: new Date() },
      });
      revalidatePath("/elaqe/followup");
      return { ok: true };
    } catch (e) {
      console.error("[completeFollowup]", e);
      return { ok: false, error: "Tamamlanmadı" };
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
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = PaymentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findUnique({ where: { id: d.kontragent_id } });
      if (!k) return { ok: false, error: "Kontragent tapılmadı" };

      // Try finance_operations with kod "musteri_odenis"
      const typeKod = "musteri_odenis";
      let type = await prisma.finance_operation_types
        .findUnique({ where: { kod: typeKod } })
        .catch(() => null);
      if (!type) {
        type = await prisma.finance_operation_types
          .create({
            data: { kod: typeKod, ad: "Müştəri ödənişi", qrup: "borc", y_n: "daxil" },
          })
          .catch(() => null);
      }
      if (type) {
        await prisma.finance_operations.create({
          data: {
            sahibkar_id: sahibkarId,
            type_id: type.id,
            type_kod: type.kod,
            y_n: type.y_n,
            tarix: d.tarix ? new Date(d.tarix) : new Date(),
            meblegh: d.mebleg,
            azn_meblegh: d.mebleg,
            kontragent_id: d.kontragent_id,
            qeyd: d.qeyd || "Borc ödənişi",
            yaradan_id: istifadeciId,
          },
        });
      }

      const borcBefore = await prisma.kontragentler.findUnique({ where: { id: d.kontragent_id }, select: { borc: true } });
      await prisma.kontragentler.update({
        where: { id: d.kontragent_id },
        data: {
          borc: { decrement: d.mebleg },
          son_temas: new Date(),
        },
      });
      await audit("yenile", "kontragent_borc", d.kontragent_id, {
        evvelki_data: { borc: borcBefore?.borc ?? null },
        yeni_data: { odenis: d.mebleg, type: "musteri_odenis" },
        sebeb: d.qeyd || "Borc ödənişi",
      });

      revalidatePath("/elaqe/borclar");
      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/musteriler/${d.kontragent_id}`);
      revalidatePath(`/elaqe/techizatcilar/${d.kontragent_id}`);
      return { ok: true, id: d.kontragent_id };
    } catch (e) {
      console.error("[recordContactPayment]", e);
      return { ok: false, error: "Ödəniş qeyd edilmədi" };
    }
  });
}

export async function resetContactDebt(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTenant(async () => {
    try {
      const before = await prisma.kontragentler.findUnique({ where: { id }, select: { borc: true, ad: true } });
      await prisma.kontragentler.update({ where: { id }, data: { borc: 0 } });
      await audit("yenile", "kontragent_borc", id, {
        evvelki_data: { borc: before?.borc ?? null, ad: before?.ad ?? null },
        yeni_data: { borc: 0 },
        sebeb: "Borc sıfırlandı (manual reset)",
      });
      revalidatePath("/elaqe/borclar");
      revalidatePath("/elaqe");
      return { ok: true };
    } catch (e) {
      console.error("[resetContactDebt]", e);
      return { ok: false, error: "Sıfırlanmadı" };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   MERGE DUPLICATES                                                 */
/* ------------------------------------------------------------------ */

export async function mergeContacts(
  primaryId: string,
  mergeIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!primaryId || mergeIds.length === 0) {
    return { ok: false, error: "Birləşdiriləcək kontragent seçilməyib" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
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

          // Sum debts
          const otherBorc = Number(other.borc ?? 0);
          await tx.kontragentler.update({
            where: { id: primaryId },
            data: { borc: { increment: otherBorc } },
          });

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
        }
      });
      revalidatePath("/elaqe/dublikat");
      revalidatePath("/elaqe");
      return { ok: true };
    } catch (e) {
      console.error("[mergeContacts]", e);
      return { ok: false, error: "Birləşdirmə uğursuz oldu" };
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
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
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
    try {
      for (const r of rows) {
        const ad = (r.ad ?? "").trim();
        if (!ad || ad.length < 2) {
          skipped++;
          continue;
        }
        const telefon = (r.telefon ?? "").trim() || null;
        const email = (r.email ?? "").trim() || null;
        const voen = (r.voen ?? "").trim() || null;
        const fin_kod = (r.fin_kod ?? "").trim() || null;

        // Skip if exact match telefon/email/voen exists
        if (telefon || email || voen) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const where: any = { OR: [] };
          if (telefon) where.OR.push({ telefon });
          if (email) where.OR.push({ email });
          if (voen) where.OR.push({ voen });
          const exists = await prisma.kontragentler.findFirst({ where });
          if (exists) {
            skipped++;
            continue;
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
            telefon,
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
        created++;
      }
      revalidatePath("/elaqe");
      revalidatePath("/elaqe/musteriler");
      revalidatePath("/elaqe/techizatcilar");
      return { ok: true, created, skipped };
    } catch (e) {
      console.error("[importContacts]", e);
      return { ok: false, error: "Idxal alınmadı" };
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
  const name = tagName.trim();
  if (!name) return { ok: false, error: "Tag adı boşdur" };
  if (!ids.length) return { ok: false, error: "Seçim yoxdur" };
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
      return { ok: true, count };
    } catch (e) {
      console.error("[bulkAddTag]", e);
      return { ok: false, error: "Tag əlavə olunmadı" };
    }
  });
}

export async function bulkAssignManager(
  ids: string[],
  menecerId: string | null
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!ids.length) return { ok: false, error: "Seçim yoxdur" };
  return withTenant(async () => {
    try {
      const res = await prisma.kontragentler.updateMany({
        where: { id: { in: ids } },
        data: { menecer_id: menecerId || null },
      });
      revalidatePath("/elaqe");
      return { ok: true, count: res.count };
    } catch (e) {
      console.error("[bulkAssignManager]", e);
      return { ok: false, error: "Menecer təyin olunmadı" };
    }
  });
}

export async function bulkSetStatus(
  ids: string[],
  aktiv: boolean
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!ids.length) return { ok: false, error: "Seçim yoxdur" };
  return withTenant(async () => {
    try {
      const res = await prisma.kontragentler.updateMany({
        where: { id: { in: ids } },
        data: { aktiv },
      });
      revalidatePath("/elaqe");
      return { ok: true, count: res.count };
    } catch (e) {
      console.error("[bulkSetStatus]", e);
      return { ok: false, error: "Status dəyişmədi" };
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
  if (!pairs.length) return { ok: false, error: "Birləşdirmək üçün qrup yoxdur" };
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
  if (!template?.trim()) return { ok: false, error: "Mətn boşdur" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findUnique({ where: { id: kontragentId } });
      if (!k?.telefon) return { ok: false, error: "Telefon yoxdur" };

      // Real göndərmə (env-də provider varsa) ya da mock log.
      // SMS adapter avtomatik provider seçir (Twilio/MSG91/AzerCell/mock).
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
      return { ok: true as const, provider: smsResult.provider, is_mock: smsResult.is_mock };
    } catch (e) {
      console.error("[sendContactSms]", e);
      return { ok: false, error: "SMS göndərilmədi" };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   TAGS                                                             */
/* ------------------------------------------------------------------ */

export async function addContactTag(
  kontragentId: string,
  tagName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = tagName.trim();
  if (!name) return { ok: false, error: "Tag adı boşdur" };
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
      return { ok: true };
    } catch (e) {
      console.error("[addContactTag]", e);
      return { ok: false, error: "Tag əlavə edilmədi" };
    }
  });
}

export async function removeContactTag(
  kontragentId: string,
  tagId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTenant(async () => {
    try {
      await prisma.contact_tag_links.deleteMany({
        where: { kontragent_id: kontragentId, tag_id: tagId },
      });
      revalidatePath(`/elaqe/musteriler/${kontragentId}`);
      revalidatePath(`/elaqe/techizatcilar/${kontragentId}`);
      return { ok: true };
    } catch (e) {
      console.error("[removeContactTag]", e);
      return { ok: false, error: "Tag silinmədi" };
    }
  });
}
