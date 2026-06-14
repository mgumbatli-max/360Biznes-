import { NextRequest } from "next/server";
import { z } from "zod";
import { withMobile } from "@/lib/mobile/session";
import { getMyChannels } from "@/features/team/queries";
import { createChannelCore } from "@/features/team/actions";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/** GET — istifadəçinin söhbət kanalları (son mesaj + oxunmamış sayı). */
export async function GET(req: NextRequest) {
  return withMobile(req, async () => {
    const rows = await getMyChannels().catch(() => []);
    const channels = rows.map((r) => {
      const isDirect = r.kanal.novu === "direct";
      const name = isDirect ? (r.otherUser?.ad_soyad ?? "Şəxsi söhbət") : r.kanal.ad;
      return {
        id: r.kanal.id,
        ad: name,
        novu: r.kanal.novu,
        unread: r.unread,
        uzv_say: r.kanal._count?.uzvler ?? 0,
        son_mesaj_de: r.kanal.son_mesaj_de,
        lastMessage: r.lastMessage
          ? {
              mesaj: r.lastMessage.mesaj,
              gonderici_ad: r.lastMessage.gonderici?.ad_soyad ?? "",
              yaradildi: r.lastMessage.yaradildi,
            }
          : null,
      };
    });
    return { channels };
  });
}

const DmSchema = z.object({ userId: z.string().uuid() });
const GroupSchema = z.object({
  ad: z.string().trim().min(2, "Qrup adı ən az 2 simvol").max(150),
  uzv_ids: z.array(z.string().uuid()).min(1, "Ən az 1 üzv seçin"),
});

/** POST — qrup (ad + uzv_ids) yarat, və ya istifadəçi ilə birbaşa söhbət (DM). */
export async function POST(req: NextRequest) {
  return withMobile(req, async () => {
    const body = await req.json().catch(() => ({}));

    // Qrup yaratma — createChannelCore (web ilə eyni nüvə) reuse olunur
    const g = GroupSchema.safeParse(body);
    if (g.success) {
      const res = await createChannelCore({ ad: g.data.ad, tesvir: "", novu: "kanal", qapali: true, uzv_ids: g.data.uzv_ids.join(","), filial_id: undefined });
      if (res.ok) return { ok: true, id: (res.data as { id?: number } | undefined)?.id };
      return { error: res.error };
    }

    const parsed = DmSchema.safeParse(body);
    if (!parsed.success) return { error: "Yanlış data" };
    const { sahibkarId, istifadeciId } = requireTenant();
    const other = parsed.data.userId;
    if (other === istifadeciId) return { error: "Özünüzlə söhbət yarada bilməzsiniz" };

    const valid = await prisma.istifadeciler.findFirst({
      where: { id: other, sahibkar_id: sahibkarId, aktiv: true },
      select: { id: true, ad_soyad: true },
    });
    if (!valid) return { error: "İstifadəçi tapılmadı" };

    // Mövcud DM varsa onu qaytar
    const existing = await prisma.team_kanal.findFirst({
      where: {
        sahibkar_id: sahibkarId,
        novu: "direct",
        AND: [
          { uzvler: { some: { istifadeci_id: istifadeciId } } },
          { uzvler: { some: { istifadeci_id: other } } },
        ],
      },
      select: { id: true },
    });
    if (existing) return { ok: true, id: existing.id };

    const kanal = await prisma.team_kanal.create({
      data: {
        sahibkar_id: sahibkarId,
        ad: valid.ad_soyad ?? "Şəxsi söhbət",
        novu: "direct",
        qapali: true,
        yaradan_id: istifadeciId,
        uzvler: {
          create: [
            { istifadeci_id: istifadeciId, rolu: "admin" },
            { istifadeci_id: other, rolu: "uzv" },
          ],
        },
      },
      select: { id: true },
    });
    return { ok: true, id: kanal.id };
  });
}
