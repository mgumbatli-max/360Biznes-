import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getActiveKassa } from "@/features/pos/session-queries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * GET — POS konteksti: cari istifadəçinin açıq kassası (yoxdursa null),
 * anbar siyahısı + default, şirkət adı və valyuta. Mobil POS ekranı bunu
 * açılışda yükləyir.
 */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "pos.satis", "satis.yarat", "satis.idare", "satis.oxu")) {
      return { error: "İcazə yoxdur" };
    }
    const { sahibkarId } = requireTenant();
    const [kassa, anbarlar, sahibkar] = await Promise.all([
      getActiveKassa().catch(() => null),
      prisma.anbarlar.findMany({
        where: { aktiv: { not: false } },
        orderBy: { id: "asc" },
        select: { id: true, ad: true },
      }).catch(() => []),
      prisma.sahibkarlar.findUnique({ where: { id: sahibkarId }, select: { ad: true } }).catch(() => null),
    ]);
    return {
      kassa,
      anbarlar,
      default_anbar_id: anbarlar[0]?.id ?? null,
      valyuta: "AZN",
      sirket_ad: sahibkar?.ad ?? "",
      can_open_kassa: mobilePerm(ctx, "pos.satis", "satis.idare"),
    };
  });
}
