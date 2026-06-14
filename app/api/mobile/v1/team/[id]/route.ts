import { NextRequest } from "next/server";
import { z } from "zod";
import { withMobile } from "@/lib/mobile/session";
import { getChannelMessages, getChannelDetail } from "@/features/team/queries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/** GET — kanal mesajları + kanal adı + cari istifadəçi id (öz mesajını sağda göstərmək üçün). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMobile(req, async (ctx) => {
    const { id } = await params;
    const kanalId = Number(id);
    if (!Number.isFinite(kanalId)) return { error: "Yanlış kanal" };

    const [detail, msgs] = await Promise.all([
      getChannelDetail(kanalId).catch(() => null),
      getChannelMessages(kanalId, 200).catch(() => []),
    ]);

    const messages = msgs.map((m) => {
      const locked = !!(m.kilid_sifre_hash || m.bir_dafelik || m.gizli);
      return {
        id: m.id,
        gonderici_id: m.gonderici_id,
        gonderici_ad: m.gonderici?.ad_soyad ?? "",
        mesaj: m.silindi ? "🗑 silindi" : locked ? "🔒 Qorunan mesaj (web-də açın)" : m.mesaj,
        yaradildi: m.yaradildi,
        silindi: m.silindi,
      };
    });

    return {
      meId: ctx.istifadeciId,
      channel: detail ? { id: detail.id, ad: detail.ad, novu: detail.novu } : { id: kanalId, ad: "Söhbət", novu: "channel" },
      messages,
    };
  });
}

const SendSchema = z.object({ mesaj: z.string().trim().min(1).max(4000) });

/** POST — mesaj göndər (fokuslu: üzvlük yoxlaması + insert + kanal/oxunma yenilə). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMobile(req, async () => {
    const { id } = await params;
    const kanalId = Number(id);
    if (!Number.isFinite(kanalId)) return { error: "Yanlış kanal" };
    const body = await req.json().catch(() => ({}));
    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) return { error: "Mesaj boş ola bilməz" };
    const { sahibkarId, istifadeciId } = requireTenant();

    const kanal = await prisma.team_kanal.findFirst({ where: { id: kanalId, sahibkar_id: sahibkarId } });
    if (!kanal) return { error: "Kanal tapılmadı" };
    if (kanal.arxivlendi) return { error: "Arxivlənmiş kanala mesaj göndərilə bilməz" };

    const member = await prisma.team_uzv.findUnique({
      where: { kanal_id_istifadeci_id: { kanal_id: kanalId, istifadeci_id: istifadeciId } },
    });
    if (!member && kanal.qapali) return { error: "Kanala üzv deyilsiniz" };
    if (!member && !kanal.qapali) {
      await prisma.team_uzv.create({ data: { kanal_id: kanalId, istifadeci_id: istifadeciId, rolu: "uzv" } });
    }

    const created = await prisma.team_mesaj.create({
      data: { kanal_id: kanalId, gonderici_id: istifadeciId, mesaj: parsed.data.mesaj },
      select: { id: true },
    });
    await Promise.all([
      prisma.team_kanal.update({ where: { id: kanalId }, data: { son_mesaj_de: new Date(), yenilendi: new Date() } }),
      prisma.team_uzv.update({
        where: { kanal_id_istifadeci_id: { kanal_id: kanalId, istifadeci_id: istifadeciId } },
        data: { son_oxudu_de: new Date() },
      }).catch(() => null),
    ]);

    return { ok: true, id: created.id };
  });
}
