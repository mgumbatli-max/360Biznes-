import "server-only";

/**
 * SMS adapter — provayder-agnostik abstraksiya.
 *
 * Hazırda dəstəklənir:
 *  - "mock"     — heç bir şey göndərmir, console-a yazır (DEFAULT, env yoxdursa)
 *  - "twilio"   — Twilio Programmable SMS (gələcək — env TWILIO_ACCOUNT_SID + AUTH_TOKEN + FROM)
 *  - "msg91"    — MSG91 (gələcək)
 *  - "azercell" — AzerCell SMS (gələcək)
 *
 * Tipik istifadə server action daxilində:
 *   const res = await sendSms({ to: "+994501234567", body: "Borc xatırlatması..." });
 *   if (res.ok) { ... } else { return { ok: false, error: res.error } }
 */

export type SmsProvider = "mock" | "twilio" | "msg91" | "azercell";

export type SmsResult =
  | { ok: true; provider: SmsProvider; message_id: string | null; is_mock: boolean }
  | { ok: false; provider: SmsProvider; error: string };

export type SmsInput = {
  to: string;     // E.164 format (+994...)
  body: string;
};

/** Hazırkı aktiv provayder hansıdır — env-ə əsasən təyin olunur. */
export function getActiveSmsProvider(): SmsProvider {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    return "twilio";
  }
  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID) {
    return "msg91";
  }
  if (process.env.AZERCELL_API_KEY && process.env.AZERCELL_FROM) {
    return "azercell";
  }
  return "mock";
}

export function isSmsRealMode(): boolean {
  return getActiveSmsProvider() !== "mock";
}

/** SMS göndər. Provayder env-ə əsasən avtomatik seçilir. */
export async function sendSms(input: SmsInput): Promise<SmsResult> {
  const provider = getActiveSmsProvider();
  const to = normalizeAzPhone(input.to);
  if (!to) return { ok: false, provider, error: "Telefon nömrəsi formatı yanlışdır" };
  if (!input.body.trim()) return { ok: false, provider, error: "SMS mətni boşdur" };

  switch (provider) {
    case "twilio":
      return sendViaTwilio(to, input.body);
    case "msg91":
      return sendViaMsg91(to, input.body);
    case "azercell":
      return sendViaAzercell(to, input.body);
    case "mock":
    default:
      console.log(`[SMS:mock] to=${to} body=${input.body.slice(0, 60)}${input.body.length > 60 ? "..." : ""}`);
      return { ok: true, provider: "mock", message_id: null, is_mock: true };
  }
}

/** Azerbaijani telefon E.164 formatına çevir (məs "0501234567" → "+994501234567"). */
export function normalizeAzPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (/^\+994\d{9}$/.test(cleaned)) return cleaned;
  if (/^994\d{9}$/.test(cleaned)) return "+" + cleaned;
  if (/^0\d{9}$/.test(cleaned)) return "+994" + cleaned.slice(1);
  if (/^\d{9}$/.test(cleaned)) return "+994" + cleaned;
  return null;
}

/* ───────────────────────── PROVIDER IMPLEMENTATIONS ──────────────────────── */

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_FROM_NUMBER!;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[SMS:twilio] failed", data);
      return { ok: false, provider: "twilio", error: data?.message ?? `Twilio HTTP ${res.status}` };
    }
    return { ok: true, provider: "twilio", message_id: data?.sid ?? null, is_mock: false };
  } catch (e) {
    console.error("[SMS:twilio] exception", e);
    return { ok: false, provider: "twilio", error: String(e) };
  }
}

async function sendViaMsg91(to: string, body: string): Promise<SmsResult> {
  try {
    const key = process.env.MSG91_AUTH_KEY!;
    const sender = process.env.MSG91_SENDER_ID!;
    const res = await fetch("https://api.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: key },
      body: JSON.stringify({
        sender,
        route: "4",
        country: "994",
        sms: [{ message: body, to: [to.replace("+", "")] }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[SMS:msg91] failed", data);
      return { ok: false, provider: "msg91", error: data?.message ?? `MSG91 HTTP ${res.status}` };
    }
    return { ok: true, provider: "msg91", message_id: data?.message ?? null, is_mock: false };
  } catch (e) {
    console.error("[SMS:msg91] exception", e);
    return { ok: false, provider: "msg91", error: String(e) };
  }
}

async function sendViaAzercell(to: string, body: string): Promise<SmsResult> {
  // Placeholder — gerçək AzerCell B2B API endpoint və auth format ayrıca konfiqurasiya tələb edir.
  // Hazırda env var yoxsa bu funksiya çağırılmır.
  try {
    const key = process.env.AZERCELL_API_KEY!;
    const from = process.env.AZERCELL_FROM!;
    const res = await fetch("https://sms.azercell.com/api/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": key },
      body: JSON.stringify({ to, from, text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[SMS:azercell] failed", data);
      return { ok: false, provider: "azercell", error: data?.error ?? `AzerCell HTTP ${res.status}` };
    }
    return { ok: true, provider: "azercell", message_id: data?.id ?? null, is_mock: false };
  } catch (e) {
    console.error("[SMS:azercell] exception", e);
    return { ok: false, provider: "azercell", error: String(e) };
  }
}
