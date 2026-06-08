"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireAyarActionPerm, bustAyarCache } from "./access-guard";

type ActionResult = { ok: true } | { ok: false; error: string };

const Schema = z.object({
  platform: z.string().min(1).max(30).regex(/^[a-z0-9_]+$/i, "Platform yanlışdır"),
  // 50%-dən böyük komisyon real biznesdə yoxdur
  faiz: z.coerce.number().min(0).max(50, "Komisyon 50%-dən böyük ola bilməz"),
  odenis_gun: z.coerce.number().int().min(0).max(31),
  default_edv: z.coerce.number().min(0).max(100),
  valyuta: z.string().min(1).max(10),
});

export async function saveMarketplaceCommission(input: FormData): Promise<ActionResult> {
  const permCheck = await requireAyarActionPerm("ayar.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = Schema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const payload = {
      faiz: d.faiz,
      odenis_gun: d.odenis_gun,
      default_edv: d.default_edv,
      valyuta: d.valyuta.trim().toUpperCase(),
    };
    try {
      // Köhnə dəyər — audit üçün
      const before = await prisma.ayarlar.findFirst({
        where: { sahibkar_id: sahibkarId, qrup: "mp_komisyon", acar: d.platform },
        select: { deyer: true },
      });
      let evvelki: Record<string, unknown> | null = null;
      if (before?.deyer) {
        try { evvelki = JSON.parse(before.deyer); } catch { /* skip */ }
      }
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "mp_komisyon", acar: d.platform },
        },
        update: { deyer: JSON.stringify(payload), nov: "json", yenilendi: new Date() },
        create: {
          sahibkar_id: sahibkarId,
          qrup: "mp_komisyon",
          acar: d.platform,
          deyer: JSON.stringify(payload),
          nov: "json",
        },
      });
      revalidatePath("/ayarlar/mp-komisyon");
      bustAyarCache();
      // 💰 Komisyon marjaya təsir edir — kritik audit
      await audit("yenile", "mp_komisyon", d.platform, {
        evvelki_data: evvelki,
        yeni_data: payload,
        sebeb: `Marketplace komisyon dəyişdi: ${d.platform} (${d.faiz}%)`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveMarketplaceCommission]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}
