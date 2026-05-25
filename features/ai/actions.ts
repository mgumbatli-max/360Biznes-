"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { chatCompletion, type ChatMessage } from "@/lib/ai/anthropic";
import { getBusinessContext } from "./queries";

const SendSchema = z.object({
  message: z.string().min(1).max(4000),
});

export type SendResult =
  | { ok: true; reply: string; is_mock: boolean }
  | { ok: false; error: string };

export async function sendMessage(message: string): Promise<SendResult> {
  const parsed = SendSchema.safeParse({ message });
  if (!parsed.success) return { ok: false, error: "Mesaj boş ola bilməz" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    // Load recent context (last 10 turns) for continuity
    const recent = await prisma.ai_sohbet_loq.findMany({
      where: { istifadeci_id: istifadeciId },
      orderBy: { yaradildi: "desc" },
      take: 10,
    });
    recent.reverse();

    const history: ChatMessage[] = [];
    for (const r of recent) {
      history.push({ role: "user", content: r.prompt });
      history.push({ role: "assistant", content: r.cavab });
    }
    history.push({ role: "user", content: parsed.data.message });

    // Real biznes KPI-larını system prompt-a inject — AI konkret rəqəmlərlə cavab versin
    const businessCtx = await getBusinessContext().catch(() => "");
    const system = businessCtx
      ? `Sən 360Biznes ERP sistemində biznes sahibinə kömək edən AI köməkçisən. Cavablarını Azərbaycan dilində ver. Aşağıdakı real biznes data-sından istifadə edib konkret rəqəmlərlə cavab ver. Heç vaxt "məlumatım yoxdur" demə — kontekst aşağıdadır.\n\n${businessCtx}\n\nQısa ol (3-4 abzas maksimum). Markdown bullet siyahıları işlət. JSON/HTML qaytarma — yalnız sadə mətn.`
      : undefined;

    const result = await chatCompletion(history, system ? { system } : undefined);

    await prisma.ai_sohbet_loq.create({
      data: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        prompt: parsed.data.message,
        cavab: result.text,
        model: result.model,
        kanal: "panel",
      },
    });

    revalidatePath("/ai");
    return { ok: true, reply: result.text, is_mock: result.is_mock };
  });
}

export async function clearHistory(): Promise<{ ok: true }> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    await prisma.ai_sohbet_loq.deleteMany({ where: { istifadeci_id: istifadeciId } });
    revalidatePath("/ai");
    return { ok: true };
  });
}
