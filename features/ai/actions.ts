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
  mode: z.enum(["owner", "employee"]).default("employee"),
});

export type SendResult =
  | { ok: true; reply: string; is_mock: boolean }
  | { ok: false; error: string };

export async function sendMessage(message: string, mode: "owner" | "employee" = "employee"): Promise<SendResult> {
  const parsed = SendSchema.safeParse({ message, mode });
  if (!parsed.success) return { ok: false, error: "Mesaj boş ola bilməz" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolId } = requireTenant();
    // owner mode yalnız rol 9 üçün — başqa hər kəs employee-ə düşür
    const effectiveMode: "owner" | "employee" = parsed.data.mode === "owner" && rolId === 9 ? "owner" : "employee";

    // Mode-a görə ayrı söhbət tarixçəsi (kanal: "panel" = employee, "sahibkar" = owner)
    const kanal = effectiveMode === "owner" ? "sahibkar" : "panel";
    const recent = await prisma.ai_sohbet_loq.findMany({
      where: { istifadeci_id: istifadeciId, kanal },
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

    // Mode-a görə kontekst — owner mode tam KPI, employee yalnız şəxsi performans
    const businessCtx = await getBusinessContext(effectiveMode).catch(() => "");
    const baseRole = effectiveMode === "owner"
      ? "biznes sahibinə kömək edən sahibkar-rejimində AI köməkçisən. Tam giriş icazən var: gəlir, mənfəət, maya, kassa, maaş, məxfi qeydlər."
      : "şirkət əməkdaşına kömək edən əməkdaş-rejimində AI köməkçisən. Sənin icazən məhdud: yalnız şəxsi performans, vəzifə, anbar və ümumi məhsul/müştəri datasına. Sahibkar-yalnız mövzuları rədd et.";
    const system = businessCtx
      ? `Sən 360Biznes ERP sistemində ${baseRole}\n\nCavabını Azərbaycan dilində ver. Aşağıdakı real data-dan istifadə edib konkret rəqəmlərlə cavab ver. Heç vaxt "məlumatım yoxdur" demə.\n\n${businessCtx}\n\nQısa ol (3-4 abzas). Markdown bullet işlət. JSON/HTML/kod blok QAYTARMA.`
      : `Sən 360Biznes ERP sistemində ${baseRole} Cavabını Azərbaycan dilində ver. Qısa və faydalı ol.`;

    const result = await chatCompletion(history, { system });

    await prisma.ai_sohbet_loq.create({
      data: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        prompt: parsed.data.message,
        cavab: result.text,
        model: result.model,
        kanal,
      },
    });

    revalidatePath(effectiveMode === "owner" ? "/sahibkar/ai" : "/ai");
    return { ok: true, reply: result.text, is_mock: result.is_mock };
  });
}

export async function clearHistory(mode: "owner" | "employee" = "employee"): Promise<{ ok: true }> {
  return withTenant(async () => {
    const { istifadeciId, rolId } = requireTenant();
    const effective = mode === "owner" && rolId === 9 ? "owner" : "employee";
    const kanal = effective === "owner" ? "sahibkar" : "panel";
    await prisma.ai_sohbet_loq.deleteMany({ where: { istifadeci_id: istifadeciId, kanal } });
    revalidatePath(effective === "owner" ? "/sahibkar/ai" : "/ai");
    return { ok: true };
  });
}
