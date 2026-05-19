"use server";

import { findSaleByCode, type SaleByCodeResult } from "@/features/ticaret/sale-lookup";

/**
 * Bank reconciliation helpers.
 *
 * When the bank-feed import (future feature) parses incoming transactions,
 * it will scan the transaction `description` for marketplace order codes
 * (e.g. "WLT-12345", "BF-998877") or qaimə/internal sale numbers and use
 * this helper to resolve the matching sale, then auto-close the
 * customer debt (borc) by creating a finance_operations row linked to
 * that sale.
 *
 * This is a thin re-export of `findSaleByCode` so callers in the maliyye
 * module don't need to reach into features/ticaret directly.
 *
 * Usage (sketch):
 *   for (const tx of incomingBankTransactions) {
 *     const code = extractCodeFromDescription(tx.description);
 *     if (!code) continue;
 *     const sale = await findSaleByExternalCode(code);
 *     if (sale) {
 *       // ...write finance_operations row → satis_id = sale.id
 *     }
 *   }
 */
export async function findSaleByExternalCode(
  code: string,
): Promise<SaleByCodeResult | null> {
  return findSaleByCode(code);
}
