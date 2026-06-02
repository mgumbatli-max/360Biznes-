"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true } | { ok: false; error: string };

const ReplySchema = z.object({
  sohbet_id: z.string().uuid(),
  metn: z.string().min(1).max(4000),
  ai_yaradilan: z.coerce.boolean().default(false),
});

export async function sendReply(input: FormData): Promise<ActionResult> {
  const parsed = ReplySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.inbox_mesajlari.create({
        data: {
          sahibkar_id: sahibkarId,
          sohbet_id: d.sohbet_id,
          istiqamet: "out",
          metn: d.metn.trim(),
          status: "gonderildi",
          ai_yaradilan: d.ai_yaradilan,
          istifadeci_id: istifadeciId,
        },
      });
      await prisma.inbox_sohbetler.update({
        where: { id: d.sohbet_id },
        data: {
          son_mesaj: d.metn.trim().slice(0, 200),
          son_mesaj_zamani: new Date(),
          oxunmamis_say: 0,
          yenilendi: new Date(),
        },
      });
      revalidatePath(`/crm/inbox/${d.sohbet_id}`);
      revalidatePath("/crm/inbox");
      return { ok: true };
    } catch (e) {
      console.error("[sendReply]", e);
      return { ok: false, error: "Göndərilmədi" };
    }
  });
}

export async function markChatRead(sohbet_id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.inbox_sohbetler.update({
        where: { id: sohbet_id },
        data: { oxunmamis_say: 0 },
      });
      revalidatePath("/crm/inbox");
      return { ok: true };
    } catch (e) {
      console.error("[markChatRead]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

const ConvertSchema = z.object({
  sohbet_id: z.string().uuid(),
});

export async function convertChatToMusteri(input: FormData): Promise<ActionResult> {
  const parsed = ConvertSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Sohbət tapılmadı" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const c = await prisma.inbox_sohbetler.findFirst({ where: { id: parsed.data.sohbet_id } });
      if (!c) return { ok: false, error: "Sohbət tapılmadı" };
      if (c.musteri_id) return { ok: true };
      const k = await prisma.kontragentler.create({
        data: {
          sahibkar_id: sahibkarId,
          getirdi_id: istifadeciId,
          nov: "musteri",
          ad: c.display_ad ?? "Müştəri",
          telefon: c.telefon,
          qaynaq: c.kanal,
          qiymet_tipi: "adi",
        },
      });
      await prisma.inbox_sohbetler.update({
        where: { id: c.id },
        data: { musteri_id: k.id, yenilendi: new Date() },
      });
      revalidatePath("/crm/inbox");
      return { ok: true };
    } catch (e) {
      console.error("[convertChat]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}
