import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { getMyChannels } from "@/features/team/queries";

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
