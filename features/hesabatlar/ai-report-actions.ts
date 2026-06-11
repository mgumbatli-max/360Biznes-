"use server";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { chatWithTools, type ChatMessage } from "@/lib/ai/anthropic";
import { READ_TOOLS, executeAgentTool } from "@/features/ai/agent-tools";
import { getBusinessContext, canUseOwnerMode } from "@/features/ai/queries";
import { checkAiRateLimit } from "@/features/ai/rate-limit";
import { audit } from "@/lib/audit/log";

/**
 * Hesabat AI — Faza A (#14): təbii dildə hesabat soruş, agent mövcud OXU
 * alətləri ilə real datadan cədvəl/markdown cavab qaytarır. YAZMA YOXDUR
 * (allowWrite:false) — hesabat sorğusu heç nəyi dəyişmir. Yalnız owner/direktor
 * (canUseOwnerMode) — hesabatlar həssasdır (mənfəət, maya, kassa).
 */

export type ReportAskResult =
  | { ok: true; reply: string; is_mock: boolean }
  | { ok: false; error: string };

const REPORT_SYSTEM = `Sən 360Biznes ERP-də biznes sahibinə HESABAT hazırlayan AI analitiksən.
Yalnız OXU alətlərin var — heç nə yaratma və ya dəyişmə.
Mövcud alətlər: satis_hesabati (dövr üzrə satış), xerc_hesabati (xərclər), borclular, son_satislar,
kassa_hesablar (qalıqlar), stok_az (kritik stok), emekdaslar, mehsul_axtar, musteri_axtar.

Qaydalar:
- İstifadəçi hansı hesabatı istəsə, uyğun aləti ÇAĞIR — rəqəmləri TƏXMİN ETMƏ.
- Dövr göstərilməyibsə son 30 günü götür; "bu ay/keçən ay" deyilsə uyğun gün sayı seç.
- Cavabı Azərbaycan dilində, peşəkar, markdown cədvəl və ya bullet ilə, konkret rəqəmlərlə ver.
- Lazım gələrsə bir neçə aləti ardıcıl çağır və nəticələri birləşdir.
- JSON/HTML/kod blok qaytarma — yalnız oxunaqlı hesabat mətni.`;

export async function askReport(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<ReportAskResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };

  const msg = String(message ?? "").trim();
  if (!msg) return { ok: false, error: "Sual boşdur" };
  if (msg.length > 4000) return { ok: false, error: "Sual çox uzundur (max 4000 simvol)" };

  return withTenant(async () => {
    const { rolAd } = requireTenant();
    if (!canUseOwnerMode(rolAd)) {
      return { ok: false, error: "Hesabat AI yalnız sahibkar/direktor rolları üçündür" };
    }

    const rl = await checkAiRateLimit().catch(() => null);
    if (rl && rl.ok === false) {
      return { ok: false, error: rl.error ?? "AI limit aşıldı, bir az sonra cəhd edin" };
    }

    const businessCtx = await getBusinessContext("owner").catch(() => "");
    const system = businessCtx ? `${REPORT_SYSTEM}\n\n${businessCtx}` : REPORT_SYSTEM;

    const messages: ChatMessage[] = [
      ...history
        .slice(-10)
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim()),
      { role: "user", content: msg },
    ];

    try {
      const r = await chatWithTools(messages, {
        system,
        tools: READ_TOOLS,
        executeTool: (name, input) => executeAgentTool(name, input, { allowWrite: false }),
      });
      try {
        await audit("ai_chat", "ai_hesabat", null, {
          yeni_data: { message_length: msg.length, reply_length: r.text.length, model: r.model },
        });
      } catch { /* audit non-fatal */ }
      return { ok: true, reply: r.text, is_mock: r.is_mock };
    } catch (e) {
      console.error("[askReport]", e);
      return { ok: false, error: "AI hesabat servisi cavab vermir, bir az sonra cəhd edin" };
    }
  });
}
