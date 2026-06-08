"use server";

import {
  searchProducts,
  lookupByBarcode,
  searchCustomers,
  type ProductRow,
  type CustomerRow,
} from "./sale-queries";
import { canViewCost } from "@/features/anbar/access-guard";

/**
 * Maya qiymətini icazəsi olmayan istifadəçilər üçün 0 ilə əvəz et.
 *
 * Bu funksiya yalnız SATIŞ kontekstində çağırılır. Alış formaları üçün
 * `alish_qiymeti` faktiki tranzaksiya qiymətidir — gizlədilməməlidir.
 */
function redactProductCost(rows: ProductRow[], canSee: boolean): ProductRow[] {
  if (canSee) return rows;
  return rows.map((r) => ({ ...r, alish_qiymeti: 0 }));
}

/**
 * SATIŞ kontekstində məhsul axtarış — maya icazəsi yoxdursa redact olunur.
 * Sale-side komponentlər (yeni-satis-modal, pos, market-satis) bunu istifadə edir.
 */
export async function searchProductsAction(q: string, anbarId?: number): Promise<ProductRow[]> {
  const [rows, canSee] = await Promise.all([
    searchProducts(q, anbarId, 12),
    canViewCost(),
  ]);
  return redactProductCost(rows, canSee);
}

export async function lookupBarcodeAction(barcode: string, anbarId?: number): Promise<ProductRow | null> {
  const [row, canSee] = await Promise.all([
    lookupByBarcode(barcode, anbarId),
    canViewCost(),
  ]);
  if (!row) return null;
  if (canSee) return row;
  return { ...row, alish_qiymeti: 0 };
}

/**
 * ALIŞ kontekstində məhsul axtarış — maya (alish_qiymeti) həmişə tam görünür,
 * çünki o, alış tranzaksiyasının qiymət təklifidir.
 *
 * Yalnız `alis.yarat` icazəsi olan istifadəçilər bu səhifələrə girə bilər,
 * bu da maya görünüşünü dolayı yolla qoruyur.
 */
export async function searchProductsForPurchaseAction(
  q: string,
  anbarId?: number,
): Promise<ProductRow[]> {
  return searchProducts(q, anbarId, 12);
}

export async function searchCustomersAction(q: string): Promise<CustomerRow[]> {
  return searchCustomers(q, 10);
}

/**
 * Cari istifadəçinin maya görmə icazəsini client-ə qaytaran helper.
 * Komponentlər bunu mount zamanı oxuyub maya/mənfəət sütunlarını show/hide edirlər.
 */
export async function getCanViewCostAction(): Promise<boolean> {
  return canViewCost();
}
