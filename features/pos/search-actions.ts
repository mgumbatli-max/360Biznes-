"use server";

import {
  searchProducts,
  lookupByBarcode,
  searchCustomers,
  type ProductRow,
  type CustomerRow,
} from "./sale-queries";

export async function searchProductsAction(q: string, anbarId?: number): Promise<ProductRow[]> {
  return searchProducts(q, anbarId, 12);
}

export async function lookupBarcodeAction(barcode: string, anbarId?: number): Promise<ProductRow | null> {
  return lookupByBarcode(barcode, anbarId);
}

export async function searchCustomersAction(q: string): Promise<CustomerRow[]> {
  return searchCustomers(q, 10);
}
