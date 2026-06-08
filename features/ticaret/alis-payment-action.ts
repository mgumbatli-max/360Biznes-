"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTicaretActionPerm } from "./access-guard";

export type PayablePurchaseInfo =
  | {
      ok: true;
      techizatci_id: string;
      qaliq: number;
      hesablar: Array<{ id: string; ad: string; nov: string; qaliq: number }>;
    }
  | { ok: false; error: string };

/**
 * Alış sənədi üçün ödəniş dialoqunun açılışında lazımi məlumat:
 * təchizatçı id, hazırkı borc qalıq, aktiv hesab siyahısı.
 */
export async function getPayablePurchaseInfoAction(
  purchaseId: string,
): Promise<PayablePurchaseInfo> {
  // Hesab qaliqları döndürüldüyü üçün strictər icazə tələb olunur.
  // Yalnız alış oxuyan yox, ödəniş edə bilən rollar (kassa.idare, maliyye.idare)
  const check = await requireTicaretActionPerm([
    "alis.odenis",
    "alis.idare",
    "kassa.idare",
    "maliyye.idare",
  ]);
  if (!check.ok) return { ok: false, error: check.error };

  return withTenant(async () => {
    const purchase = await prisma.alis_sifarisleri.findUnique({
      where: { id: purchaseId },
      select: {
        techiazatci_id: true,
        umumi_mebleg: true,
        odenilmis: true,
        status: true,
      },
    });
    if (!purchase) return { ok: false, error: "Alış tapılmadı" };
    if (purchase.status === "legv") {
      return { ok: false, error: "Ləğv edilmiş alışa ödəniş edilə bilməz" };
    }
    if (!purchase.techiazatci_id) {
      return { ok: false, error: "Təchizatçı təyin olunmayıb" };
    }
    const qaliq = Math.max(
      0,
      Number(purchase.umumi_mebleg ?? 0) - Number(purchase.odenilmis ?? 0),
    );
    if (qaliq <= 0) {
      return { ok: false, error: "Bu alış artıq tam ödənilib" };
    }

    const hesablar = await prisma.maliye_hesablari.findMany({
      where: { aktiv: true },
      orderBy: [{ nov: "asc" }, { ad: "asc" }],
      select: { id: true, ad: true, nov: true, qaliq: true },
    });

    return {
      ok: true,
      techizatci_id: purchase.techiazatci_id,
      qaliq,
      hesablar: hesablar.map((h) => ({
        id: h.id,
        ad: h.ad,
        nov: h.nov,
        qaliq: Number(h.qaliq ?? 0),
      })),
    };
  });
}
