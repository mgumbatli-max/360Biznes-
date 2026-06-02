"use server";

import { z } from "zod";
import { chatCompletion, type ChatMessage } from "@/lib/ai/anthropic";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { MOVZULAR, KATEQORIYA_LABEL } from "./topics";

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
 * ERP-də necə işləmək haqqında sahibkar/əməkdaşa cavab verən AI köməkçi.
 * - Sistem promptu yalnız 360biznes ERP-yə fokuslanır
 * - Bütün help mövzuları kontekstə inject olunur (link və addımlar ilə)
 * - Cavab Az dilində, qısa, addım-addım və link təqdim edir
 *
 * "Necə yeni məhsul yaradım?" → "Anbar → Məhsullar → ... " + birbaşa link
 */
export async function askErpHelper(input: z.input<typeof AskSchema>): Promise<AskResult> {
  const parsed = AskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sual çox qısa və ya çox uzundur" };
  const { question, history = [] } = parsed.data;

  return withTenant(async () => {
    const { rolAd } = requireTenant();

    // Mövzuları kompakt mətnə çevir — AI-nin biliyi bunlardır
    const topicsCtx = MOVZULAR.map((m) => {
      const cat = KATEQORIYA_LABEL[m.kateqoriya]?.label ?? m.kateqoriya;
      const addimlar = m.necə_istifade.slice(0, 4).map((s, i) => `  ${i + 1}. ${s}`).join("\n");
      return `[${m.id}] ${m.basliq}
Kateqoriya: ${cat}
Səhifə: ${m.sehife_url}
Xülasə: ${m.qisa}
Addımlar:
${addimlar}`;
    }).join("\n\n");

    const role = rolAd === "sahibkar" ? "biznes sahibi" : "əməkdaş";
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

    const messages: ChatMessage[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: question },
    ];

    const result = await chatCompletion(messages, { system });

    // Cavabdan id-lərlə işarələnmiş mövzuları çıxarıb tövsiyə kimi göstər
    const idRegex = /\[([a-z][a-z0-9-]+)\]/gi;
    const seenIds = new Set<string>();
    let m;
    while ((m = idRegex.exec(result.text)) !== null) seenIds.add(m[1]);
    // Açar sözlərə görə ən uyğun mövzuları tap (sualdan + cavabdan)
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

    // Cavabdan id-tag-larını və ən üstdəki "ehtimal kobud cavab"-da link kələk-i çıxar
    const cleanReply = result.text.replace(/\[[a-z][a-z0-9-]+\]\s*/gi, "").trim();

    return {
      ok: true,
      reply: cleanReply,
      suggestedTopics: scored.map(({ mz }) => ({ id: mz.id, basliq: mz.basliq, href: mz.sehife_url })),
      isMock: result.is_mock,
    };
  });
}
