import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { type PosPriceSettings, DEFAULTS } from "./pos-qiymet-types";

export { type PosPriceSettings, DEFAULTS };

const AYAR_QRUP = "pos_qiymet";

export async function getPosPriceSettings(): Promise<PosPriceSettings> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: AYAR_QRUP },
    });
    const map = new Map(rows.map((r) => [r.acar, r.deyer ?? ""]));
    const out: PosPriceSettings = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof PosPriceSettings)[]) {
      const raw = map.get(key);
      if (raw === undefined) continue;
      try {
        const v = JSON.parse(raw) as unknown;
        if (key === "default_tier" && typeof v === "string") {
          (out[key] as PosPriceSettings["default_tier"]) =
            v as PosPriceSettings["default_tier"];
        } else if (typeof v === "boolean") {
          (out as Record<string, unknown>)[key] = v;
        }
      } catch {
        /* keep default */
      }
    }
    return out;
  });
}

export async function setPosPriceSettings(
  input: Partial<PosPriceSettings>,
): Promise<void> {
  await withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const entries = Object.entries(input) as [
      keyof PosPriceSettings,
      PosPriceSettings[keyof PosPriceSettings],
    ][];
    for (const [acar, deyer] of entries) {
      if (!(acar in DEFAULTS)) continue;
      const value = JSON.stringify(deyer);
      await prisma.ayarlar.upsert({
        where: {
          sahibkar_id_qrup_acar: {
            sahibkar_id: sahibkarId,
            qrup: AYAR_QRUP,
            acar,
          },
        },
        update: { deyer: value, nov: "json", yenilendi: new Date() },
        create: {
          sahibkar_id: sahibkarId,
          qrup: AYAR_QRUP,
          acar,
          deyer: value,
          nov: "json",
          tesvir: `POS qiymət ayarı — ${acar}`,
        },
      });
    }
  });
}
