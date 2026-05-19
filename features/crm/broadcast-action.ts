"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true; id?: string; sayi?: number } | { ok: false; error: string };

const BroadcastSchema = z.object({
  ad: z.string().min(2).max(150),
  matn: z.string().min(2),
  kanallar: z.string().transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
  hedef: z.enum(["all_musteri", "topdan", "passiv_30d", "son_alish_30d", "borclu", "vip"]).default("all_musteri"),
  zamanlama: z.string().optional().or(z.literal("")),
  test_send: z.coerce.boolean().default(false),
});

export async function saveBroadcast(input: FormData): Promise<ActionResult> {
  const parsed = BroadcastSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const sayi = await estimateRecipientCount(d.hedef);
      const created = await prisma.broadcast_kampaniyalari.create({
        data: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          ad: d.ad.trim(),
          matn: d.matn.trim(),
          kanallar: d.kanallar.length > 0 ? d.kanallar : ["whatsapp"],
          hedef: d.hedef,
          zamanlama: d.zamanlama ? new Date(d.zamanlama) : null,
          status: d.test_send ? "tamamlandi" : (d.zamanlama ? "gozlemede" : "tamamlandi"),
          gonderilen_say: d.test_send ? 1 : sayi,
          ugurlu_say: d.test_send ? 1 : sayi,
          xeta_say: 0,
        },
      });
      revalidatePath("/crm/broadcast");
      return { ok: true, id: created.id, sayi: d.test_send ? 1 : sayi };
    } catch (e) {
      console.error("[saveBroadcast]", e);
      return { ok: false, error: "Saxlanmadı" };
    }
  });
}

export async function estimateRecipientCount(hedef: string): Promise<number> {
  return withTenant(async () => {
    const days30Ago = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    switch (hedef) {
      case "all_musteri":
        return prisma.kontragentler.count({ where: { nov: "musteri", aktiv: true } });
      case "topdan":
        return prisma.kontragentler.count({ where: { nov: "musteri", qiymet_tipi: "topdan" } });
      case "vip":
        return prisma.kontragentler.count({ where: { nov: "musteri", qiymet_tipi: "vip" } });
      case "borclu":
        return prisma.kontragentler.count({ where: { nov: "musteri", borc: { gt: 0 } } });
      case "passiv_30d":
        return prisma.kontragentler.count({
          where: {
            nov: "musteri",
            OR: [{ son_temas: { lt: days30Ago } }, { son_temas: null }],
          },
        });
      case "son_alish_30d":
        return prisma.kontragentler.count({
          where: { nov: "musteri", son_temas: { gte: days30Ago } },
        });
      default:
        return 0;
    }
  });
}
