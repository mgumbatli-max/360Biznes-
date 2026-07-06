"use server";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { permGate } from "@/lib/auth/role-check";
import { revalidatePath } from "next/cache";
import { XERC_BUDCE_QRUP, XERC_BUDCE_ACAR_PREFIX } from "./xerc-budce";

/** Bir xərc kateqoriyasının aylıq büdcəsini təyin et (0 → sil). */
export async function setExpenseBudget(
  kateqoriyaId: number,
  value: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const g = permGate("xerc.idare", "maliyye.idare", "ayarlar.idare");
    if (!g.ok) return g;
    if (!Number.isFinite(value) || value < 0 || value > 100_000_000) {
      return { ok: false, error: "Büdcə 0–100.000.000 aralığında olmalıdır" };
    }
    const acar = XERC_BUDCE_ACAR_PREFIX + kateqoriyaId;
    if (value === 0) {
      await prisma.ayarlar.deleteMany({ where: { sahibkar_id: sahibkarId, qrup: XERC_BUDCE_QRUP, acar } });
    } else {
      await prisma.ayarlar.upsert({
        where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: XERC_BUDCE_QRUP, acar } },
        update: { deyer: String(value), yenilendi: new Date() },
        // ⚠️ nov="decimal" (number YOX — ayarlar_nov_check rədd edir)
        create: { sahibkar_id: sahibkarId, qrup: XERC_BUDCE_QRUP, acar, deyer: String(value), nov: "decimal", tesvir: "Xərc kateqoriya aylıq büdcəsi" },
      });
    }
    revalidatePath("/maliyye/budce");
    return { ok: true };
  });
}
