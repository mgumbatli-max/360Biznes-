"use server";

import { getServisQeydleriByProduct, getProductServisTrend } from "./queries";
import type { ServisRow } from "./types";

export async function fetchProblemMehsulRows(opts: {
  mehsul_id: string | null;
  mehsul_ad: string | null;
}): Promise<{ ok: true; rows: ServisRow[] } | { ok: false; error: string }> {
  try {
    const rows = await getServisQeydleriByProduct({
      mehsul_id: opts.mehsul_id,
      mehsul_ad: opts.mehsul_ad,
    });
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Servis qeydləri yüklənmədi" };
  }
}

export async function fetchProductServisTrend(opts: {
  mehsul_id: string | null;
  mehsul_ad: string | null;
}): Promise<
  | { ok: true; trend: { ay: string; say: number }[]; defekt: { ad: string; say: number }[] }
  | { ok: false; error: string }
> {
  try {
    const data = await getProductServisTrend(opts.mehsul_id, opts.mehsul_ad);
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Trend yüklənmədi" };
  }
}
