"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { chatCompletion, type ChatMessage } from "@/lib/ai/anthropic";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { checkAiRateLimit } from "@/features/ai/rate-limit";
import { MOVZULAR, KATEQORIYA_LABEL, type KomekciMovzu } from "./topics";

const AskSchema = z.object({
  question: z.string().trim().min(2).max(500),
  /** Əvvəlki söhbət — son 4 mesaj */
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(8).optional(),
});

type AskResult =
  | { ok: true; reply: string; suggestedTopics: { id: string; basliq: string; href: string }[]; isMock?: boolean }
  | { ok: false; error: string };

/**
 * Sualdan açar sözlər çıxarıb mövzuları sıralayır. Yalnız top 12 mövzu
 * sistem prompt-una qoşulur — bu, 50K-dan ~5K token-ə qədər azaldır.
 */
function rankTopicsByQuery(question: string, history: ChatMessage[]): KomekciMovzu[] {
  const haystack = (
    question + " " + history.slice(-2).map((h) => h.content).join(" ")
  ).toLowerCase();

  const scored = MOVZULAR.map((mz) => {
    let score = 0;
    // Açar sözlər
    for (const kw of mz.achar_sozler) {
      if (haystack.includes(kw.toLowerCase())) score += 4;
    }
    // Başlıq tam uyğun gəlirsə
    if (haystack.includes(mz.basliq.toLowerCase())) score += 8;
    // Kateqoriya
    if (haystack.includes(mz.kateqoriya.toLowerCase())) score += 2;
    // Səhifə URL-i sualda görünsə
    if (mz.sehife_url && haystack.includes(mz.sehife_url.toLowerCase())) score += 6;
    return { mz, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Heç bir uyğun mövzu yoxdursa: əsas 8 daimi mövzunu götür (məs. dashboard, anbar, satış)
  if (scored.length === 0) {
    return MOVZULAR.slice(0, 8);
  }
  // Top 12 — heç vaxt daha çox deyil
  return scored.slice(0, 12).map((x) => x.mz);
}

function buildTopicsCtx(topics: KomekciMovzu[]): string {
  return topics.map((m) => {
    const cat = KATEQORIYA_LABEL[m.kateqoriya]?.label ?? m.kateqoriya;
    const addimlar = m.necə_istifade.slice(0, 4).map((s, i) => `  ${i + 1}. ${s}`).join("\n");
    return `[${m.id}] ${m.basliq}
Kateqoriya: ${cat}
Səhifə: ${m.sehife_url}
Xülasə: ${m.qisa}
Addımlar:
${addimlar}`;
  }).join("\n\n");
}

/**
 * ERP-də necə işləmək haqqında sahibkar/əməkdaşa cavab verən AI köməkçi.
 * - Sistem promptu yalnız 360biznes ERP-yə fokuslanır
 * - Sualla uyğun gələn top 12 mövzu kontekstə inject olunur (RAG)
 * - Cavab Az dilində, qısa, addım-addım və link təqdim edir
 */
export async function askErpHelper(input: z.input<typeof AskSchema>): Promise<AskResult> {
  // 1) Auth
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };

  const parsed = AskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sual çox qısa və ya çox uzundur (2–500 simvol)" };
  const { question, history = [] } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();

    // 2) Rate limit
    const rate = await checkAiRateLimit();
    if (!rate.ok) return { ok: false, error: rate.error };

    // 3) RAG — yalnız uyğun mövzuları inject et
    const messages: ChatMessage[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: question },
    ];
    const topTopics = rankTopicsByQuery(question, messages);
    const topicsCtx = buildTopicsCtx(topTopics);

    // QA: rol adı klonlarda böyük hərfli/fərqli ola bilər — strict bərabərlik yox
    const rolLower = (rolAd ?? "").toLowerCase();
    const role =
      rolLower.includes("sahibkar") || rolLower.includes("admin") || rolLower.includes("direktor")
        ? "biznes sahibi"
        : "əməkdaş";
    const system = `Sən 360biznes ERP sisteminə qoşulmuş AI köməkçisən. İstifadəçi (${role}) sistemin hansı bölməsində nə edəcəyini öyrənmək üçün sual verir.

VƏZIFƏN: Konkret, addım-addım Azərbaycanca cavab ver. Hər cavab:
1. 1-2 cümlədən ibarət qısa giriş
2. **Addımlar** (nömrəli siyahı, hər addım bir cümlə)
3. Səhifə linkini göstər: \`[Səhifəyə keç](URL)\` formatında
4. Lazımdırsa "⚠ Vacib" qeyd əlavə et (1 cümlə)

QAYDA: Yalnız aşağıdakı bilik bazasından istifadə et. ERP-də olmayan funksiyalar haqqında "Bu funksiya sistemdə yoxdur" de və yaxınını tövsiyə et.

══════ BİLİK BAZASI ══════
${topicsCtx}
══════════════════════════

Yazma stili: Qısa (maks 200 söz), səmimi "siz" formasında, kod blok yox, markdown bullet OK.`;

    // 4) AI çağırışı — chatCompletion artıq retry + throw edir
    let result;
    try {
      result = await chatCompletion(messages, { system });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI cavab vermir";
      return { ok: false, error: msg };
    }

    // 5) Cavabdan id-lərlə işarələnmiş mövzuları çıxarıb tövsiyə kimi göstər
    const idRegex = /\[([a-z][a-z0-9-]+)\]/gi;
    const seenIds = new Set<string>();
    let m;
    while ((m = idRegex.exec(result.text)) !== null) seenIds.add(m[1]);
    const haystack = (question + " " + result.text).toLowerCase();
    const scored = MOVZULAR.map((mz) => {
      let score = 0;
      if (seenIds.has(mz.id)) score += 100;
      for (const kw of mz.achar_sozler) {
        if (haystack.includes(kw.toLowerCase())) score += 3;
      }
      if (haystack.includes(mz.basliq.toLowerCase())) score += 5;
      return { mz, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    const cleanReply = result.text.replace(/\[[a-z][a-z0-9-]+\]\s*/gi, "").trim();

    // 6) Audit + tarixçə log
    try {
      await audit("ai_komekci", "ai_sohbet", null, {
        yeni_data: {
          is_mock: result.is_mock,
          input_tokens: result.input_tokens ?? null,
          output_tokens: result.output_tokens ?? null,
          model: result.model,
          movzu_say: topTopics.length,
          sual_uzunluq: question.length,
        },
      });
      // ai_sohbet_loq-a yaz (kanal = "komekci")
      const { prisma } = await import("@/lib/db/prisma");
      const niyyet = result.input_tokens != null && result.output_tokens != null
        ? `i:${result.input_tokens}/o:${result.output_tokens}`
        : null;
      await prisma.ai_sohbet_loq.create({
        data: {
          sahibkar_id: sahibkarId,
          istifadeci_id: requireTenant().istifadeciId,
          prompt: question,
          cavab: cleanReply,
          model: result.model,
          kanal: "komekci",
          niyyet,
        },
      });
    } catch (e) {
      console.warn("[askErpHelper] log/audit skipped", e);
    }

    return {
      ok: true,
      reply: cleanReply,
      suggestedTopics: scored.map(({ mz }) => ({ id: mz.id, basliq: mz.basliq, href: mz.sehife_url })),
      isMock: result.is_mock,
    };
  });
}
