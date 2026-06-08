"use server";

import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import {
  getOpenSalesForCustomer,
  getOpenPurchasesForSupplier,
  type OpenSaleOpt,
  type OpenPurchaseOpt,
} from "./queries";

/**
 * Müştərinin açıq qaimələrini lazy-load et — debitor səhifəsində row expand
 * action ilə çağırılır.
 */
export async function loadCustomerOpenInvoices(
  musteriId: string,
): Promise<{ ok: true; data: OpenSaleOpt[] } | { ok: false; error: string }> {
  if (!musteriId) return { ok: false, error: "Müştəri ID yoxdur" };
  try {
    const data = await getOpenSalesForCustomer(musteriId, 100);
    return { ok: true, data };
  } catch (e) {
    console.error("[loadCustomerOpenInvoices]", e);
    return { ok: false, error: "Açıq qaimələr yüklənmədi" };
  }
}

/**
 * Təchizatçının açıq alış qaimələrini lazy-load et — kreditor səhifəsində
 * row expand action.
 */
export async function loadSupplierOpenInvoices(
  techizatciId: string,
): Promise<{ ok: true; data: OpenPurchaseOpt[] } | { ok: false; error: string }> {
  if (!techizatciId) return { ok: false, error: "Təchizatçı ID yoxdur" };
  try {
    const data = await getOpenPurchasesForSupplier(techizatciId, 100);
    return { ok: true, data };
  } catch (e) {
    console.error("[loadSupplierOpenInvoices]", e);
    return { ok: false, error: "Açıq alışlar yüklənmədi" };
  }
}
