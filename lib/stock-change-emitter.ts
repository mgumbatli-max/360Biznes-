import "server-only";
import { after } from "next/server";
import { requireTenant, runWithTenant } from "@/lib/db/tenant-context";

/**
 * Universal stok-dəyişikliyi event-i — hər hansı bir action stoku dəyişdirdikdə
 * (POS satış, alış qəbulu, qaytarma, transfer, inventarizasiya, manual adjustment)
 * bu helper çağırılır.
 *
 * Davranış:
 *  - Cavab vermədən asinxron (after()) işləyir, action-ı bloklamır
 *  - Tenant context snapshot bağlanır (after-də context yox olur)
 *  - autoPushAfterSale çağırılır → auto_push_on_sale olan kanallara delta göndərir
 *
 * İstifadə pattern:
 *   await tx.mehsullar.update({ ... });  // stok azalır
 *   emitStockChange([productId]);         // arxa fonda kanallara push
 */
export function emitStockChange(productIds: string[]): void {
  if (productIds.length === 0) return;
  // Tenant snapshot — after-də context yox olur
  let tenant;
  try {
    tenant = requireTenant();
  } catch {
    console.warn("[emitStockChange] tenant context yoxdur — skip");
    return;
  }
  const ids = [...new Set(productIds.filter(Boolean))];
  after(async () => {
    try {
      const { autoPushAfterSale } = await import("@/features/qiymet-kanal/outbound-actions");
      await runWithTenant(tenant, () => autoPushAfterSale(ids));
    } catch (e) {
      console.error("[emitStockChange]", e);
    }
  });
}
