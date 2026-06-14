import { NextRequest } from "next/server";
import { z } from "zod";
import { withMobile } from "@/lib/mobile/session";
import { sendMessageCore } from "@/features/ai/actions";
import { getChatHistory, canUseOwnerMode, getMockStatus } from "@/features/ai/queries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";

/**
 * Mobil AI köməkçi — web `sendMessage`-in token versiyası.
 *
 * Rejim SERVERdə təyin olunur: sahibkar/admin/direktor → owner (alətlərlə agent),
 * əməkdaş → employee (məhdud məsləhətçi). Müştəri rejimi seçə bilməz — beləcə
 * əməkdaş heç vaxt sahibkar datasına çıxa bilmir (sendMessageCore yenidən yoxlayır).
 */

/** GET — söhbət tarixçəsi + rejim/mock bayraqları. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const mode: "owner" | "employee" = canUseOwnerMode(ctx.rolAd) ? "owner" : "employee";
    const rows = await getChatHistory(50, mode).catch(() => []);
    return {
      mode,
      canOwner: mode === "owner",
      is_mock: getMockStatus(),
      messages: rows.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        cavab: r.cavab,
        yaradildi: r.yaradildi,
        is_mock: r.is_mock,
      })),
    };
  });
}

const SendSchema = z.object({ message: z.string().trim().min(1).max(4000) });

/** POST — AI-ya mesaj göndər. Rejim ctx-dən (rol) gəlir, body-dən YOX. */
export async function POST(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const body = await req.json().catch(() => ({}));
    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: "Mesaj boş və ya çox uzundur (max 4000 simvol)" };
    }
    const mode: "owner" | "employee" = canUseOwnerMode(ctx.rolAd) ? "owner" : "employee";
    return sendMessageCore(parsed.data.message, mode);
  });
}

/** DELETE — cari rejimin söhbət tarixçəsini sil. */
export async function DELETE(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const { istifadeciId } = requireTenant();
    const mode: "owner" | "employee" = canUseOwnerMode(ctx.rolAd) ? "owner" : "employee";
    const kanal = mode === "owner" ? "sahibkar" : "panel";
    const res = await prisma.ai_sohbet_loq.deleteMany({
      where: { istifadeci_id: istifadeciId, kanal },
    });
    try {
      await audit("ai_chat_sil", "ai_sohbet", null, { yeni_data: { kanal, silinen_mesaj: res.count, mobil: true } });
    } catch { /* non-fatal */ }
    return { ok: true, silinen: res.count };
  });
}
