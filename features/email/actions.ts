"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { sendEmail, isEmailRealMode } from "@/lib/email/adapter";
import { formatDate } from "@/lib/utils";

const QRUP = "email_notification";

type Result = { ok: true } | { ok: false; error: string };

const EmailConfigSchema = z.object({
  recipient: z.string().trim().email().or(z.literal("")),
  events: z.array(z.enum(["webhook_order", "stok_alert", "low_stock", "daily_summary"])).default([]),
});

export type EmailSettings = {
  recipient: string | null;
  events: string[];
  provider_configured: boolean;
};

export async function getEmailSettings(): Promise<EmailSettings> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
      select: { deyer: true },
    });
    let recipient: string | null = null;
    let events: string[] = [];
    if (row?.deyer) {
      try {
        const p = JSON.parse(row.deyer) as { recipient?: string; events?: string[] };
        recipient = p.recipient ?? null;
        events = Array.isArray(p.events) ? p.events : [];
      } catch {}
    }
    return { recipient, events, provider_configured: isEmailRealMode() };
  });
}

export async function saveEmailSettings(input: z.input<typeof EmailConfigSchema>): Promise<Result> {
  const parsed = EmailConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Email ünvanı yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const payload = JSON.stringify({ recipient: parsed.data.recipient, events: parsed.data.events });
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
      create: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config", deyer: payload, nov: "string" },
      update: { deyer: payload, yenilendi: new Date() },
    });
    revalidatePath("/ayarlar/email");
    return { ok: true };
  });
}

export async function sendTestEmail(): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findUnique({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
      select: { deyer: true },
    });
    if (!row?.deyer) return { ok: false, error: "Əvvəlcə email qoyub saxlayın" };
    let recipient: string | null = null;
    try {
      recipient = (JSON.parse(row.deyer) as { recipient?: string }).recipient ?? null;
    } catch {}
    if (!recipient) return { ok: false, error: "Email boşdur" };
    const res = await sendEmail({
      to: recipient,
      subject: "360biznes — test bildirişi",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;padding:24px;background:#f8fafc">
          <h1 style="color:#0f172a">🧪 Test bildirişi</h1>
          <p style="color:#334155">Sistem işləyir, email ünvanınız düzgün qurulub.</p>
          <p style="color:#64748b;font-size:12px">Vaxt: ${formatDate(new Date(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>`,
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true };
  });
}

/** SERVER-ONLY (webhook endpoint daxili) */
export async function getEmailConfigForSahibkar(sahibkarId: string): Promise<{ recipient: string | null; events: string[] }> {
  const row = await prisma.ayarlar.findUnique({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: "config" } },
    select: { deyer: true },
  });
  if (!row?.deyer) return { recipient: null, events: [] };
  try {
    const p = JSON.parse(row.deyer) as { recipient?: string; events?: string[] };
    return { recipient: p.recipient ?? null, events: Array.isArray(p.events) ? p.events : [] };
  } catch {
    return { recipient: null, events: [] };
  }
}
