"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import {
  LITE_CONFIG_GROUP,
  LITE_CONFIG_KEY,
  defaultLiteConfig,
  type LiteConfig,
} from "@/lib/lite/config";
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  LITE_MODULES,
  MOBILE_LAYOUT_OPTIONS,
} from "@/lib/lite/registry";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Gələn config-i registry-yə görə təmizlə — yalnız tanınan dəyərlər saxlanır. */
function sanitize(input: any): LiteConfig {
  const def = defaultLiteConfig();
  const pick = (val: any, opts: readonly { kod: string }[], fb: string) =>
    opts.some((o) => o.kod === val) ? val : fb;
  const d = input?.design ?? {};
  const design = {
    density: pick(d.density, DENSITY_OPTIONS, def.design.density),
    mobileLayout: pick(d.mobileLayout, MOBILE_LAYOUT_OPTIONS, def.design.mobileLayout),
    fontScale: pick(d.fontScale, FONT_OPTIONS, def.design.fontScale),
    accent: pick(d.accent, ACCENT_OPTIONS, def.design.accent),
  } as LiteConfig["design"];

  const modules: LiteConfig["modules"] = {};
  for (const m of LITE_MODULES) {
    const sm = input?.modules?.[m.kod] ?? {};
    const blocks: Record<string, boolean> = {};
    for (const b of m.bloklar) {
      blocks[b.kod] =
        typeof sm.blocks?.[b.kod] === "boolean" ? sm.blocks[b.kod] : b.liteDefault;
    }
    modules[m.kod] = {
      enabled: typeof sm.enabled === "boolean" ? sm.enabled : true,
      blocks,
    };
  }
  return { design, modules };
}

export async function saveLiteConfig(
  input: LiteConfig,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = ((session.user as { rol_ad?: string }).rol_ad ?? "").toLowerCase();
  // Biznes üzrə ayardır — yalnız sahibkar/admin dəyişə bilər.
  if (rolAd !== "sahibkar" && rolAd !== "admin") {
    return { ok: false, error: "Yalnız sahibkar/admin dəyişə bilər" };
  }

  const clean = sanitize(input);
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: {
          sahibkar_id: sahibkarId,
          qrup: LITE_CONFIG_GROUP,
          acar: LITE_CONFIG_KEY,
        },
      },
      create: {
        sahibkar_id: sahibkarId,
        qrup: LITE_CONFIG_GROUP,
        acar: LITE_CONFIG_KEY,
        deyer: JSON.stringify(clean),
        nov: "json",
      },
      update: { deyer: JSON.stringify(clean), yenilendi: new Date() },
    });
    // Config bütün səhifələrə təsir edir — hamısını yenilə.
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
