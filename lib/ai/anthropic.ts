import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic client wrapper with mock fallback.
 *
 * If ANTHROPIC_API_KEY is set, makes real API calls.
 * Otherwise returns canned responses so the UI is usable in development.
 */

const DEFAULT_MODEL = process.env.AI_MODEL || "claude-haiku-4-5-20251001";

function hasKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CompletionResult = {
  text: string;
  model: string;
  is_mock: boolean;
  input_tokens?: number;
  output_tokens?: number;
};

const SYSTEM_PROMPT_AZ = `Sən 360Biznes ERP sistemində biznes sahibinə kömək edən AI köməkçisən.

Cavablarını Azərbaycan dilində ver. Qısa və faydalı ol. Konkret rəqəm və tövsiyə verməyə çalış.
Anbar, satış, maliyyə, müştəri, marketinq kimi sahələrdə suallara cavab ver.

Sistemin terminləri:
- Sahibkar = biznes sahibi
- Anbar = inventar/məhsul
- Müştəri/Kontragent = customer
- Təchizatçı = supplier
- Satış sifarişi = sales order
- Kassa = cash register
- POS = point of sale
- Marjıan / Maya = cost / margin

Cavab uzunluğu: maksimum 3-4 qısa abzas. Heç vaxt JSON, kod blok və ya HTML qaytarma — sadə mətn ver.`;

/**
 * Anthropic API çağırışı — 429/503 (overload/rate-limit) üçün
 * exponential backoff ilə 2 retry.
 *
 * Kalıcı xəta halında call-er tərəfindən throw edilir — UI istifadəçiyə
 * konkret mesajla göstərir (mock-fallback YOX, çünki user səhvi gizli qalmasın).
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { system?: string; max_tokens?: number }
): Promise<CompletionResult> {
  if (!hasKey()) return mockResponse(messages);

  const MAX_ATTEMPTS = 3;
  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      const response = await getClient().messages.create({
        model: DEFAULT_MODEL,
        max_tokens: opts?.max_tokens ?? 600,
        system: opts?.system ?? SYSTEM_PROMPT_AZ,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const text = response.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .filter(Boolean)
        .join("\n");
      return {
        text,
        model: response.model,
        is_mock: false,
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
      };
    } catch (e) {
      lastErr = e;
      // Yalnız retryable status-larda yenidən cəhd: 429 (rate limit), 503 (overload), network
      const status = (e as { status?: number; statusCode?: number })?.status
        ?? (e as { statusCode?: number })?.statusCode;
      const retryable = status === 429 || status === 503 || status === 502 || status === 504 || status === undefined;
      if (!retryable || attempt >= MAX_ATTEMPTS) break;
      const backoffMs = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  console.error("[anthropic] all retries failed", lastErr);
  const status = (lastErr as { status?: number })?.status;
  const errMsg =
    status === 429 ? "AI servisinin saatlıq limit-i aşıldı, 1 dəq sonra cəhd edin"
    : status === 503 ? "AI servisi həddən artıq yüklüdür, qısa müddət sonra cəhd edin"
    : status === 401 ? "AI servisi açarı qəbul etmir — admin ilə əlaqə saxlayın"
    : "AI cavabını almaq mümkün olmadı, bir az sonra yenidən cəhd edin";
  throw new Error(errMsg);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tool-use (agent) rejimi — AI alətlər çağıraraq DB-dən oxuyur və
 * (sahibkar rejimində) əməliyyat edir. Maks 6 iterasiyalı loop.
 * ────────────────────────────────────────────────────────────────────────── */
export type AgentToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export async function chatWithTools(
  messages: ChatMessage[],
  opts: {
    system: string;
    tools: AgentToolDef[];
    executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
    max_tokens?: number;
  },
): Promise<CompletionResult & { tool_calls: number }> {
  if (!hasKey()) return { ...mockResponse(messages), tool_calls: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let msgs: any[] = messages.map((m) => ({ role: m.role, content: m.content }));
  let toolCalls = 0;
  let inTok = 0;
  let outTok = 0;

  for (let iter = 0; iter < 6; iter++) {
    let response;
    try {
      response = await getClient().messages.create({
        model: DEFAULT_MODEL,
        max_tokens: opts.max_tokens ?? 1200,
        system: opts.system,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: opts.tools as any,
        messages: msgs,
      });
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 429 || status === 503) {
        await new Promise((r) => setTimeout(r, 800));
        response = await getClient().messages.create({
          model: DEFAULT_MODEL,
          max_tokens: opts.max_tokens ?? 1200,
          system: opts.system,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: opts.tools as any,
          messages: msgs,
        });
      } else {
        throw e;
      }
    }
    inTok += response.usage?.input_tokens ?? 0;
    outTok += response.usage?.output_tokens ?? 0;

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter((c) => c.type === "tool_use");
      msgs.push({ role: "assistant", content: response.content });
      const results = [];
      for (const tu of toolUses) {
        toolCalls++;
        let out: unknown;
        try {
          out = await opts.executeTool(tu.name, (tu.input ?? {}) as Record<string, unknown>);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : "Alət xətası" };
        }
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(out).slice(0, 6000),
        });
      }
      msgs.push({ role: "user", content: results });
      continue;
    }

    const text = response.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
    return {
      text,
      model: response.model,
      is_mock: false,
      input_tokens: inTok,
      output_tokens: outTok,
      tool_calls: toolCalls,
    };
  }
  return {
    text: "Sorğu çox mürəkkəb alət zənciri tələb etdi — sualı sadələşdirib yenidən cəhd edin.",
    model: DEFAULT_MODEL,
    is_mock: false,
    input_tokens: inTok,
    output_tokens: outTok,
    tool_calls: toolCalls,
  };
}

/* Local mock — produces a context-aware response based on keywords. */
function mockResponse(messages: ChatMessage[]): CompletionResult {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
  const text = pickMockReply(last);
  return { text, model: "mock", is_mock: true };
}

function pickMockReply(q: string): string {
  if (/salam|hello|merhaba/.test(q)) {
    return "Salam! 👋 Sizə nə ilə kömək edə bilərəm? Anbar, satış, maliyyə və ya müştəri haqqında sual verə bilərsiniz.";
  }
  if (/stok|anbar|məhsul/.test(q)) {
    return [
      "Stok idarəsi üçün bir neçə tövsiyə:",
      "",
      "• Hər məhsul üçün kritik stok səviyyəsi (`kritik_stok` sahəsi) qurmaq vacibdir — sistem stok azalanda xəbərdarlıq göndərir.",
      "• Ölü stoku müntəzəm yoxlayın (60 gündür satılmayan). Hesabatlar → Məhsul → Ölü stok bölməsində görə bilərsiniz.",
      "• Satılmayan məhsullara endirim tətbiq edib dövriyyəni sürətləndirin.",
    ].join("\n");
  }
  if (/satış|sat|sales/.test(q)) {
    return "Bu ayın satışlarına Hesabatlar → Satış bölməsindən baxa bilərsiniz: top məhsul, top müştəri, top satıcı və ödəniş növü üzrə bölgü. Maya altı satışları izləmək üçün Dashboard-da `Maya altı` filtrini istifadə edin.";
  }
  if (/maliyyə|maliye|gəlir|xərc|maya|profit/.test(q)) {
    return [
      "Maliyyə vəziyyətini qiymətləndirmək üçün:",
      "",
      "• **Brüt margin** ≥ 30% saxlamaq lazımdır.",
      "• **OPEX** gəlirin 25%-dən çox olmamalıdır.",
      "• **Aylıq net mənfəət** mənfi olmamalıdır.",
      "",
      "Hesabatlar → Maliyyə (P&L) bölməsində bu rəqəmləri görə bilərsiniz.",
    ].join("\n");
  }
  if (/müştəri|musteri|borc|debt/.test(q)) {
    return "Müştəri borc analizi üçün: Maliyyə → Debitor bölməsində bütün borclu müştəriləri görəcəksiniz. 30 gündən çox gecikən borcları SMS/WhatsApp xatırlatma şablonu ilə avtomatik xatırlatmaq olar (CRM → Mesaj şablonları).";
  }
  if (/marketinq|reklam|marketing/.test(q)) {
    return "Marketinq fəaliyyətinizi ölçmək üçün: 1) Lead konversiya nisbətini izləyin (CRM dashboard), 2) Mənbə üzrə leadlərə baxın (Instagram, Reklam, Tövsiyə), 3) Şablon mesajlarla broadcast göndərin (`CRM → Broadcast`).";
  }
  return [
    "Sualınızı tam başa düşmədim, amma 360Biznes-də sizə kömək edə bilərəm:",
    "",
    "• 📦 **Anbar** — stok analizi, ölü stok, kritik səviyyə",
    "• 💰 **Satış və maliyyə** — gəlir, margin, P&L hesabatı",
    "• 👥 **Müştərilər** — borc izi, CRM, follow-up",
    "• 📊 **Hesabatlar** — top məhsul, satıcı performansı",
    "",
    "Daha konkret sual versəniz daha yaxşı cavab verə bilərəm.",
    "",
    "*Qeyd: hazırda mock-mode aktivdir. Real Claude AI cavablar üçün `.env` faylına `ANTHROPIC_API_KEY` əlavə edin.*",
  ].join("\n");
}

export function isMockMode(): boolean {
  return !hasKey();
}
