import "server-only";

/**
 * Telegram bot notifier — server-side message göndərmək üçün.
 *
 * Konfiqurasiya:
 *  - Env: TELEGRAM_BOT_TOKEN (paylaşılan, bütün sahibkarlar üçün bir bot)
 *  - Per-sahibkar chat_id: `ayarlar` cədvəlində (qrup="telegram", acar="chat_id")
 *
 * Hər sahibkar @BotFather-də öz bot-unu yarada bilər və ya paylaşılan bot
 * istifadə edə bilər. Bot chat-ə əlavə olunmalıdır və chat_id ayarlar-da qoyulmalıdır.
 */

export type TelegramResult =
  | { ok: true; message_id: number }
  | { ok: false; error: string };

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

/**
 * Markdown-formatlı mesaj göndər.
 * `text` Telegram MarkdownV2 ya HTML formatında ola bilər (parseMode parametrli).
 */
export async function sendTelegramMessage(opts: {
  chatId: string | number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2" | null;
  disableWebPreview?: boolean;
  /** Buton-ların inline JSON-u (Telegram InlineKeyboardMarkup). */
  inlineKeyboard?: Array<Array<{ text: string; url: string }>>;
}): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN env yoxdur" };
  if (!opts.chatId) return { ok: false, error: "chat_id boşdur" };
  if (!opts.text?.trim()) return { ok: false, error: "Mətn boşdur" };

  try {
    const payload: Record<string, unknown> = {
      chat_id: opts.chatId,
      text: opts.text,
      disable_web_page_preview: opts.disableWebPreview ?? true,
    };
    if (opts.parseMode) payload.parse_mode = opts.parseMode;
    if (opts.inlineKeyboard) payload.reply_markup = { inline_keyboard: opts.inlineKeyboard };

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      const desc = data?.description ?? `Telegram HTTP ${res.status}`;
      console.error("[telegram] failed:", desc);
      return { ok: false, error: desc };
    }
    return { ok: true, message_id: data.result?.message_id ?? 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[telegram] exception:", msg);
    return { ok: false, error: msg };
  }
}

/** Sadə HTML escape — istifadəçi inputu Telegram HTML-də göndərilərkən. */
export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
