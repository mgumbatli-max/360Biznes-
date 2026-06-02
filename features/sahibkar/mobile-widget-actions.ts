"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const QRUP = "sahibkar_mobile";
const ACAR = "widgets";

/**
 * Sahibkar mobil panel widget seçimini DB-də (ayarlar cədvəlində) saxlayır.
 * Bu cihazlar arası sinxronlaşma deməkdir — sahibkar telefondan dəyişsə,
 * masaüstündə də eyni görsənir (əvvəlcə localStorage idi, qarışıqlıq yaradırdı).
 */
export async function saveMobileWidgets(keys: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(keys) || keys.some((k) => typeof k !== "string")) {
    return { ok: false, error: "Yanlış format" };
  }
  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar" };

    const existing = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR },
    });
    const json = JSON.stringify(keys);
    if (existing) {
      await prisma.ayarlar.update({ where: { id: existing.id }, data: { deyer: json } });
    } else {
      await prisma.ayarlar.create({
        data: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR, deyer: json },
      });
    }
    revalidatePath("/sahibkar/mobile");
    return { ok: true };
  });
}

export async function getMobileWidgets(): Promise<string[] | null> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: QRUP, acar: ACAR },
      select: { deyer: true },
    });
    if (!row?.deyer) return null;
    try {
      const parsed = JSON.parse(row.deyer);
      if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
        return parsed;
      }
    } catch { /* corrupt — fall through */ }
    return null;
  });
}
