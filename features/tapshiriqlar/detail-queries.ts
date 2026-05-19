import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export async function getTaskDetail(id: string) {
  return withTenant(async () => {
    return prisma.tapshiriqlar.findUnique({
      where: { id },
      include: {
        istifadeciler_tapshiriqlar_mesul_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        istifadeciler_tapshiriqlar_yaradan_idToistifadeciler: { select: { id: true, ad_soyad: true } },
        tapshiriq_iscilier: { include: { istifadeciler: { select: { id: true, ad_soyad: true } } } },
        tapshiriq_checklist: { orderBy: { sira: "asc" } },
        tapshiriq_kommentleri: {
          orderBy: { yaradildi: "desc" },
          include: { istifadeciler: { select: { ad_soyad: true } } },
        },
      },
    });
  });
}
