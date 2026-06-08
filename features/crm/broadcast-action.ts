"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireCrmActionPerm, bustCrmCache } from "./access-guard";
import { checkBroadcastQuota } from "./quota";

type ActionResult = { ok: true; id?: string; sayi?: number } | { ok: false; error: string };

const BroadcastSchema = z.object({
  ad: z.string().min(2).max(150),
  matn: z.string().min(2).max(2000),
  kanallar: z.string().transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
  hedef: z.enum(["all_musteri", "topdan", "passiv_30d", "son_alish_30d", "borclu", "vip"]).default("all_musteri"),
  zamanlama: z.string().optional().or(z.literal("")),
  test_send: z.coerce.boolean().default(false),
});

export async function saveBroadcast(input: FormData): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm("broadcast.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BroadcastSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    // Quota yoxla (test send xaric)
    if (!d.test_send) {
      const quota = await checkBroadcastQuota();
      if (!quota.ok) return { ok: false, error: quota.error };
    }

    try {
      const sayi = await estimateRecipientCount(d.hedef);
      // Yeni dizayn: zamanlama varsa "gozlemede", test_send isə "tamamlandi" (1 mesaj),
      // əks halda "taslak" — cron işləyəndə "gonderilir" → "tamamlandi" olur.
      let status: string;
      if (d.test_send) status = "tamamlandi";
      else if (d.zamanlama) status = "gozlemede";
      else status = "taslak"; // Cron işləyəcək (avtomatik göndərmə)

      const created = await prisma.broadcast_kampaniyalari.create({
        data: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          ad: d.ad.trim(),
          matn: d.matn.trim(),
          kanallar: d.kanallar.length > 0 ? d.kanallar : ["whatsapp"],
          hedef: d.hedef,
          zamanlama: d.zamanlama ? new Date(d.zamanlama) : null,
          status,
          gonderilen_say: d.test_send ? 1 : 0,
          ugurlu_say: d.test_send ? 1 : 0,
          xeta_say: 0,
        },
      });
      revalidatePath("/crm/broadcast");
      revalidatePath("/crm");
      bustCrmCache();
      await audit("yarat", "broadcast_kampaniya", created.id, {
        yeni_data: {
          ad: d.ad,
          hedef: d.hedef,
          kanallar: d.kanallar,
          hedef_say: sayi,
          test_send: d.test_send,
          zamanlama: d.zamanlama || null,
          status,
        },
        sebeb: `Broadcast kampaniyası: ${d.ad}`,
      });
      return { ok: true, id: created.id, sayi: d.test_send ? 1 : sayi };
    } catch (e) {
      console.error("[saveBroadcast]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Saxlanmadı: ${msg}` };
    }
  });
}

export async function estimateRecipientCount(hedef: string): Promise<number> {
  return withTenant(async () => {
    const days30Ago = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    // Bütün hədəflərdə qara siyahıda olanları istisna et (DNC)
    const baseWhere = { nov: "musteri", aktiv: true, qara_siyahi: false } as const;
    switch (hedef) {
      case "all_musteri":
        return prisma.kontragentler.count({ where: baseWhere });
      case "topdan":
        return prisma.kontragentler.count({ where: { ...baseWhere, qiymet_tipi: "topdan" } });
      case "vip":
        return prisma.kontragentler.count({ where: { ...baseWhere, qiymet_tipi: "vip" } });
      case "borclu":
        return prisma.kontragentler.count({ where: { ...baseWhere, alacaq: { gt: 0 } } });
      case "passiv_30d":
        return prisma.kontragentler.count({
          where: {
            ...baseWhere,
            OR: [{ son_temas: { lt: days30Ago } }, { son_temas: null }],
          },
        });
      case "son_alish_30d":
        return prisma.kontragentler.count({
          where: { ...baseWhere, son_temas: { gte: days30Ago } },
        });
      default:
        return 0;
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

/**
 * Taslak broadcast ləğv et.
 */
export async function cancelDraftBroadcast(id: string): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm("broadcast.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const before = await prisma.broadcast_kampaniyalari.findFirst({
        where: { id },
        select: { ad: true, status: true },
      });
      if (!before) return { ok: false, error: "Kampaniya tapılmadı" };
      if (before.status === "tamamlandi") return { ok: false, error: "Tamamlanmış kampaniya ləğv olunmur" };
      await prisma.broadcast_kampaniyalari.update({
        where: { id },
        data: { status: "legv" },
      });
      revalidatePath("/crm/broadcast");
      bustCrmCache();
      await audit("legv", "broadcast_kampaniya", id, {
        evvelki_data: { status: before.status, ad: before.ad },
        yeni_data: { status: "legv" },
        sebeb: "Taslak broadcast ləğv edildi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[cancelDraftBroadcast]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Ləğv olunmadı: ${msg}` };
    }
  });
}

/**
 * Broadcast ROI analitika — endirim/cost vs gəlir.
 */
export type BroadcastRoi = {
  id: string;
  ad: string;
  hedef_say: number;
  ugurlu_say: number;
  xeta_say: number;
  status: string;
  yaradildi: Date;
};

export async function getBroadcastROI(id: string): Promise<{ ok: true; data: BroadcastRoi } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm("crm.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      const c = await prisma.broadcast_kampaniyalari.findFirst({
        where: { id },
        select: {
          id: true, ad: true, status: true, yaradildi: true,
          gonderilen_say: true, ugurlu_say: true, xeta_say: true,
        },
      });
      if (!c) return { ok: false, error: "Kampaniya tapılmadı" };
      return {
        ok: true,
        data: {
          id: c.id,
          ad: c.ad,
          hedef_say: c.gonderilen_say ?? 0,
          ugurlu_say: c.ugurlu_say ?? 0,
          xeta_say: c.xeta_say ?? 0,
          status: c.status ?? "naməlum",
          yaradildi: c.yaradildi ?? new Date(),
        },
      };
    } catch (e) {
      console.error("[getBroadcastROI]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}
