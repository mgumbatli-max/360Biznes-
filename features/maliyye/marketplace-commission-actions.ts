"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit/log";

const GROUP = "marketplace_komissiya";

export async function setMarketplaceCommission(
  platform: string,
  faiz: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (faiz < 0 || faiz > 100) return { ok: false, error: "Faiz 0-100 aralığında olmalıdır" };
  if (!platform || platform.length > 50) return { ok: false, error: "Platforma kodu yanlışdır" };

  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    const r = (rolAd ?? "").toLowerCase();
    if (!(r.includes("sahibkar") || r.includes("owner") || r.includes("admin"))) {
      return { ok: false, error: "Yalnız sahibkar/admin platforma komissiyasını dəyişə bilər" };
    }
    try {
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: {
            sahibkar_id: sahibkarId,
            qrup: GROUP,
            acar: platform,
          },
        },
        create: {
          sahibkar_id: sahibkarId,
          qrup: GROUP,
          acar: platform,
          deyer: String(faiz),
          nov: "number",
          tesvir: "Marketplace platforması default komissiya faizi",
        },
        update: {
          deyer: String(faiz),
          yenilendi: new Date(),
        },
      });
      await audit("yenile", "marketplace_komissiya", null, {
        yeni_data: { platform, faiz },
        sebeb: `Platform "${platform}" default komissiyası: ${faiz}%`,
      });
      revalidatePath("/maliyye/marketplace");
      revalidatePath("/ticaret/market-satis");
      return { ok: true };
    } catch (e) {
      console.error("[setMarketplaceCommission]", e);
      const { safeUserMessage } = await import("@/lib/error/user-message");
      return { ok: false, error: safeUserMessage(e, "Komissiya yenilənmədi") };
    }
  });
}
