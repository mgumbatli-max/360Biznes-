import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Bir partiya üçün tam detal — özü, məhsullar, xərclər, sənədlər, mağaza
 * paylanması və əgər varsa alış sifariş bağlantısı.
 */
export async function getPartiyaDetail(partiyaId: number) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const partiya = await prisma.sahibkar_partiya.findFirst({
      where: { id: partiyaId, sahibkar_id: sahibkarId },
      include: {
        sahibkar_techizatci: { select: { ad: true, telefon: true, email: true, olke: true } },
        sahibkar_alici: { select: { ad: true, telefon: true } },
        alis_sifarisleri: { select: { id: true, nomre: true, tarix: true, umumi_mebleg: true, qaime_nomre: true } },
        sahibkar_partiya_mehsul: {
          include: {
            mehsullar: { select: { id: true, ad: true, kod: true, sekil_url: true } },
            sahibkar_partiya_magaza: { select: { id: true, ad: true, olke: true } },
          },
          orderBy: { id: "asc" },
        },
        sahibkar_partiya_xerc: { orderBy: { id: "asc" } },
        sahibkar_partiya_sened: { orderBy: { yuklendi: "desc" } },
        sahibkar_partiya_magaza: { orderBy: { id: "asc" } },
      },
    });

    return partiya;
  });
}
