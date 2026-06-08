"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { sendTelegramMessage, isTelegramConfigured } from "@/lib/telegram/notifier";
import { encryptString, decryptString, maskSecret } from "@/lib/security/encrypt";
import { requireAyarActionPerm, bustAyarCache } from "@/features/ayarlar/access-guard";

const QRUP = "telegram";

type Result = { ok: true } | { ok: false; error: string };

const ChatIdSchema = z.object({
  chat_id: z.string().trim().min(1).max(40),
  /** Bildiriş növləri — boş array hamısını söndürür. */
  events: z.array(z.enum(["webhook_order", "stok_alert", "low_stock", "yeni_satis"])).default([]),
});

export type TelegramSettings = {
  chat_id: string | null;
  events: string[];
  bot_configured: boolean;
};

export async function getTelegramSettings(): Promise<TelegramSettings> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
      select: { deyer: true },
    });
    let chat_id: string | null = null;
    let events: string[] = [];
    if (row?.deyer) {
      try {
        const p = JSON.parse(row.deyer) as { chat_id?: string; events?: string[] };
        // Encrypted chat_id-i decrypt et (köhnə plaintext də çalışır)
        chat_id = p.chat_id ? decryptString(p.chat_id) : null;
        events = Array.isArray(p.events) ? p.events : [];
      } catch {}
    }
    return { chat_id, events, bot_configured: isTelegramConfigured() };
  });
}

export async function saveTelegramSettings(input: z.input<typeof ChatIdSchema>): Promise<Result> {
  const permCheck = await requireAyarActionPerm(["ayar.kanal", "ayar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ChatIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Yanlış: chat_id və ya events" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // 🔒 chat_id-i encrypt et — DB sızması halında açıq olmasın
    const encryptedChatId = encryptString(parsed.data.chat_id);
    const payload = JSON.stringify({ chat_id: encryptedChatId, events: parsed.data.events });
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
      create: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config", deyer: payload, nov: "string" },
      update: { deyer: payload, yenilendi: new Date() },
    });
    revalidatePath("/ayarlar/telegram");
    bustAyarCache();
    await audit("yenile", "telegram_ayar", null, {
      yeni_data: { chat_id_mask: maskSecret(parsed.data.chat_id), events: parsed.data.events },
      sebeb: "Telegram ayarları yeniləndi",
    });
    return { ok: true };
  });
}

export async function sendTestTelegram(): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
      select: { deyer: true },
    });
    if (!row?.deyer) return { ok: false, error: "Əvvəlcə chat_id qoyub saxlayın" };
    let chatId: string | null = null;
    try {
      const stored = (JSON.parse(row.deyer) as { chat_id?: string }).chat_id ?? null;
      chatId = stored ? decryptString(stored) : null;
    } catch {}
    if (!chatId) return { ok: false, error: "chat_id boşdur" };
    const res = await sendTelegramMessage({
      chatId,
      text: `🧪 *360biznes test bildirişi*\nSistem işləyir, chat ID doğru qurulub.\nVaxt: ${new Date().toLocaleString("az-AZ")}`,
      parseMode: "MarkdownV2",
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true };
  });
}

/** SERVER-ONLY (webhook endpoint daxili) — sahibkar üçün Telegram konfiqurasiyasını gətir. */
export async function getTelegramConfigForSahibkar(sahibkarId: string): Promise<{ chat_id: string | null; events: string[] }> {
  const row = await prisma.ayarlar.findUnique({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
    select: { deyer: true },
  });
  if (!row?.deyer) return { chat_id: null, events: [] };
  try {
    const p = JSON.parse(row.deyer) as { chat_id?: string; events?: string[] };
    // Encrypted chat_id-i decrypt et
    const chat_id = p.chat_id ? decryptString(p.chat_id) : null;
    return { chat_id, events: Array.isArray(p.events) ? p.events : [] };
  } catch {
    return { chat_id: null, events: [] };
  }
}
