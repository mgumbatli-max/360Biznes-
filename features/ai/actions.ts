"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { chatCompletion, chatWithTools, type ChatMessage } from "@/lib/ai/anthropic";
import { READ_TOOLS, WRITE_TOOLS, executeAgentTool } from "./agent-tools";
import { getBusinessContext, canUseOwnerMode } from "./queries";
import { checkAiRateLimit } from "./rate-limit";

const SendSchema = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(["owner", "employee"]).default("employee"),
});

export type SendResult =
  | { ok: true; reply: string; is_mock: boolean }
  | { ok: false; error: string };

const HISTORY_CONTEXT_LIMIT = 20; // AI prompt-una qoşulan son mesaj sayı

export async function sendMessage(message: string, mode: "owner" | "employee" = "employee"): Promise<SendResult> {
  // 1) Auth — sessiya olmadan ümumiyyətlə AI çağırışı yox
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };

  const parsed = SendSchema.safeParse({ message, mode });
  if (!parsed.success) {
    return { ok: false, error: "Mesaj boş və ya çox uzundur (max 4000 simvol)" };
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();
    // owner mode sahibkar/admin/direktor üçün; başqa hər kəs avtomatik employee düşür
    const effectiveMode: "owner" | "employee" = parsed.data.mode === "owner" && canUseOwnerMode(rolAd) ? "owner" : "employee";

    // 2) Rate limit — saatlıq + gündəlik quota
    const rate = await checkAiRateLimit();
    if (!rate.ok) {
      return { ok: false, error: rate.error };
    }

    // 3) Mode-a görə ayrı söhbət tarixçəsi (kanal: "panel" = employee, "sahibkar" = owner)
    const kanal = effectiveMode === "owner" ? "sahibkar" : "panel";
    const recent = await prisma.ai_sohbet_loq.findMany({
      where: { istifadeci_id: istifadeciId, kanal },
      orderBy: { yaradildi: "desc" },
      take: HISTORY_CONTEXT_LIMIT,
    });
    recent.reverse();

    const history: ChatMessage[] = [];
    for (const r of recent) {
      history.push({ role: "user", content: r.prompt });
      history.push({ role: "assistant", content: r.cavab });
    }
    history.push({ role: "user", content: parsed.data.message });

    // 4) Biznes kontekst — cache-li, eyni istifadəçi üçün 60sn-yə yenidən istifadə edilir
    const businessCtx = await getBusinessContext(effectiveMode).catch(() => "");
    const baseRole = effectiveMode === "owner"
      ? "biznes sahibinə kömək edən sahibkar-rejimində AI köməkçisən. Tam giriş icazən var: gəlir, mənfəət, maya, kassa, maaş, məxfi qeydlər."
      : "şirkət əməkdaşına kömək edən əməkdaş-rejimində AI köməkçisən. Sənin icazən məhdud: yalnız şəxsi performans, vəzifə, anbar və ümumi məhsul/müştəri datasına. Sahibkar-yalnız mövzuları rədd et.";
    // Agent rejimi (owner): AI alətlərlə DB-dən özü oxuyur və əməliyyat edir.
    const isAgent = effectiveMode === "owner";
    const agentNote = isAgent
      ? `\n\nALƏTLƏRİN VAR — istənilən xırda detal soruşulsa uyğun aləti ÇAĞIR, təxmin etmə:
OXU: mehsul_axtar, musteri_axtar, satis_hesabati, borclular, son_satislar, kassa_hesablar, xerc_hesabati, emekdaslar, tapsiriqlar, stok_az.
YAZ: qiymet_deyis, mehsul_yarat, musteri_yarat, satis_yarat, xerc_yarat, tapsiriq_yarat, tapsiriq_tamamla, stok_duzelis, mehsul_sil, lead_yarat.

TƏSDİQ PROTOKOLU (MƏCBURİ): yazma alətini ƏVVƏLCƏ tesdiq parametrsiz çağır — server icra etmədən xülasə qaytaracaq. Xülasəni istifadəçiyə göstər və "Təsdiq edirsiniz?" soruş. YALNIZ istifadəçinin NÖVBƏTİ mesajı açıq təsdiqdirsə (bəli, təsdiq, elə, davam) eyni aləti EYNİ parametrlərlə + tesdiq=true ilə çağır. İstifadəçi imtina etsə heç nə etmə. Əməliyyatdan sonra nəticəni (sənəd nömrəsi, link, köhnə→yeni) konkret bildir.`
      : "";
    const system = businessCtx
      ? `Sən 360Biznes ERP sistemində ${baseRole}\n\nCavabını Azərbaycan dilində ver. Aşağıdakı real data-dan istifadə edib konkret rəqəmlərlə cavab ver. Heç vaxt "məlumatım yoxdur" demə.${agentNote}\n\n${businessCtx}\n\nQısa ol (3-4 abzas). Markdown bullet işlət. JSON/HTML/kod blok QAYTARMA.`
      : `Sən 360Biznes ERP sistemində ${baseRole}${agentNote} Cavabını Azərbaycan dilində ver. Qısa və faydalı ol.`;

    let result;
    try {
      result = isAgent
        ? await chatWithTools(history, {
            system,
            tools: [...READ_TOOLS, ...WRITE_TOOLS],
            executeTool: (name, input) => executeAgentTool(name, input, { allowWrite: true }),
          })
        : await chatCompletion(history, { system });
    } catch (e) {
      console.error("[sendMessage] chatCompletion threw", e);
      return { ok: false, error: "AI servisi cavab vermir, bir az sonra cəhd edin" };
    }

    // 5) DB-yə yaz (model + token istifadəsi sayğacı `niyyet`-də saxlanır)
    const niyyet = result.input_tokens != null && result.output_tokens != null
      ? `i:${result.input_tokens}/o:${result.output_tokens}`
      : null;
    try {
      await prisma.ai_sohbet_loq.create({
        data: {
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          prompt: parsed.data.message,
          cavab: result.text,
          model: result.model,
          kanal,
          niyyet,
        },
      });
    } catch (e) {
      console.warn("[sendMessage] log write failed", e);
    }

    // 6) Audit log — token + model + mode görsənsin
    try {
      await audit("ai_chat", "ai_sohbet", null, {
        yeni_data: {
          mode: effectiveMode,
          model: result.model,
          is_mock: result.is_mock,
          input_tokens: result.input_tokens ?? null,
          output_tokens: result.output_tokens ?? null,
          message_length: parsed.data.message.length,
          reply_length: result.text.length,
        },
      });
    } catch { /* audit failure non-fatal */ }

    revalidatePath("/komekci");
    revalidatePath("/sahibkar/ai");
    return { ok: true, reply: result.text, is_mock: result.is_mock };
  });
}

export async function clearHistory(mode: "owner" | "employee" = "employee"): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };

  return withTenant(async () => {
    const { istifadeciId, rolAd } = requireTenant();
    const effective = mode === "owner" && canUseOwnerMode(rolAd) ? "owner" : "employee";
    const kanal = effective === "owner" ? "sahibkar" : "panel";
    try {
      const result = await prisma.ai_sohbet_loq.deleteMany({
        where: { istifadeci_id: istifadeciId, kanal },
      });
      revalidatePath("/komekci");
      revalidatePath("/sahibkar/ai");
      try {
        await audit("ai_chat_sil", "ai_sohbet", null, {
          yeni_data: { kanal, silinen_mesaj: result.count },
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[clearHistory]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tarixçə silinmədi: ${msg}` };
    }
  });
}
