import "server-only";

/**
 * Email adapter — provayder-agnostik abstraksiya.
 *
 * Hazırda dəstəklənir:
 *  - "mock"     — heç bir şey göndərmir, console-a yazır (DEFAULT)
 *  - "resend"   — Resend.com (env RESEND_API_KEY + RESEND_FROM)
 *  - "sendgrid" — SendGrid (env SENDGRID_API_KEY + SENDGRID_FROM)
 *  - "smtp"     — Generic SMTP (env SMTP_HOST + USER + PASS + FROM)
 *
 * SMS adapter ilə eyni pattern — env-də provider varsa avtomatik aktiv olur.
 * Yoxsa mock — DB-də log saxlanılır amma real göndərilmir.
 */

export type EmailProvider = "mock" | "resend" | "sendgrid" | "smtp";

export type EmailResult =
  | { ok: true; provider: EmailProvider; message_id: string | null; is_mock: boolean }
  | { ok: false; provider: EmailProvider; error: string };

export type EmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;        // plain-text fallback (yoxsa HTML-dən çıxarılır)
  from?: string;        // override (yoxsa env-dən)
  replyTo?: string;
};

export function getActiveEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) return "resend";
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) return "sendgrid";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM) {
    return "smtp";
  }
  return "mock";
}

export function isEmailRealMode(): boolean {
  return getActiveEmailProvider() !== "mock";
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const provider = getActiveEmailProvider();
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const valid = to.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (valid.length === 0) {
    return { ok: false, provider, error: "Etibarlı email ünvanı yoxdur" };
  }
  if (!input.subject?.trim()) return { ok: false, provider, error: "Subject boşdur" };
  if (!input.html?.trim()) return { ok: false, provider, error: "HTML body boşdur" };

  switch (provider) {
    case "resend":
      return sendViaResend(valid, input);
    case "sendgrid":
      return sendViaSendGrid(valid, input);
    case "smtp":
      return sendViaSmtp(valid, input);
    case "mock":
    default:
      console.log(
        `[email:mock] to=${valid.join(",")} subject="${input.subject.slice(0, 60)}"`,
      );
      return { ok: true, provider: "mock", message_id: null, is_mock: true };
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ───────────────────────── PROVIDER IMPLEMENTATIONS ──────────────────────── */

async function sendViaResend(to: string[], input: EmailInput): Promise<EmailResult> {
  try {
    const key = process.env.RESEND_API_KEY!;
    const from = input.from ?? process.env.RESEND_FROM!;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? htmlToText(input.html),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[email:resend] failed:", data);
      return {
        ok: false,
        provider: "resend",
        error: data?.message ?? `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, provider: "resend", message_id: data?.id ?? null, is_mock: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email:resend] exception:", msg);
    return { ok: false, provider: "resend", error: msg };
  }
}

async function sendViaSendGrid(to: string[], input: EmailInput): Promise<EmailResult> {
  try {
    const key = process.env.SENDGRID_API_KEY!;
    const from = input.from ?? process.env.SENDGRID_FROM!;
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: to.map((e) => ({ email: e })) }],
        from: { email: from },
        subject: input.subject,
        content: [
          { type: "text/plain", value: input.text ?? htmlToText(input.html) },
          { type: "text/html", value: input.html },
        ],
        ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[email:sendgrid] failed:", errText);
      return { ok: false, provider: "sendgrid", error: `SendGrid HTTP ${res.status}` };
    }
    const msgId = res.headers.get("x-message-id");
    return { ok: true, provider: "sendgrid", message_id: msgId ?? null, is_mock: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email:sendgrid] exception:", msg);
    return { ok: false, provider: "sendgrid", error: msg };
  }
}

async function sendViaSmtp(_to: string[], _input: EmailInput): Promise<EmailResult> {
  // SMTP nodemailer paketini avtomatik daxil etmir — opt-in dependency.
  // Hazırda warning, nodemailer əlavə edilsə bu kod aktivləşir.
  console.warn("[email:smtp] SMTP provider hələ tətbiq olunmayıb — Resend ya SendGrid istifadə edin");
  return { ok: false, provider: "smtp", error: "SMTP adapter hələ tətbiq olunmayıb (npm i nodemailer)" };
}
