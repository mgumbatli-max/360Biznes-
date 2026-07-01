import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getTaskDetail(id: string) {
  return withTenant(async () => {
    const { istifadeciId, rolAd, icazeler } = requireTenant();
    const task = await prisma.tapshiriqlar.findUnique({
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
    if (!task) return null;
    // 🔒 Üzvlük yoxlaması — privileged/tapshiriq.idare olmayan yalnız öz tapşırığını görər.
    const canSeeAll =
      /(sahibkar|admin|owner)/.test((rolAd ?? "").toLowerCase()) ||
      (icazeler ?? []).includes("tapshiriq.idare");
    if (!canSeeAll) {
      const isMember =
        task.mesul_id === istifadeciId ||
        task.yaradan_id === istifadeciId ||
        task.tapshiriq_iscilier?.some((i) => i.istifadeci_id === istifadeciId);
      if (!isMember) return null;
    }
    return task;
  });
}
