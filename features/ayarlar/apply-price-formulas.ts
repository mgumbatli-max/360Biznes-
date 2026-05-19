import "server-only";
import { prisma } from "@/lib/db/prisma";
import { computeFormulaPrice } from "./qiymet-formula";

/**
 * Apply active price-type formulas to a product's price columns.
 * Returns an updated price object that callers should merge into mehsullar update/create data.
 *
 * Maps price-type `kod` to a column:
 *   - "topdan"   → topdan_qiymeti
 *   - "vip"      → vip_qiymeti
 *   - "partnyor" → partnyor_qiymeti
 *   - "endirim"  → endirimli_qiymet
 *
 * Other codes are ignored (custom codes can be applied manually).
 */
export async function applyPriceFormulas(
  sahibkarId: string,
  input: {
    alish_qiymeti?: number | null;
    satis_qiymeti?: number | null;
    topdan_qiymeti?: number | null;
    vip_qiymeti?: number | null;
    partnyor_qiymeti?: number | null;
    endirimli_qiymet?: number | null;
  }
): Promise<{
  topdan_qiymeti?: number | null;
  vip_qiymeti?: number | null;
  partnyor_qiymeti?: number | null;
  endirimli_qiymet?: number | null;
}> {
  const types = await prisma.qiymet_novleri.findMany({
    where: {
      OR: [{ sahibkar_id: sahibkarId }, { sahibkar_id: null }],
      aktiv: true,
      formula_novu: { not: "yox" },
    },
  });

  if (types.length === 0) return {};

  const result: Record<string, number | null> = {};

  for (const t of types) {
    const kod = t.kod.toLowerCase();
    const column =
      kod === "topdan" ? "topdan_qiymeti"
      : kod === "vip" ? "vip_qiymeti"
      : kod === "partnyor" ? "partnyor_qiymeti"
      : kod === "endirim" ? "endirimli_qiymet"
      : null;
    if (!column) continue;

    // Don't overwrite a manually-entered price (non-zero, non-null)
    const existing = (input as Record<string, number | null | undefined>)[column];
    if (existing != null && existing > 0) continue;

    const calc = computeFormulaPrice(
      t.formula_novu,
      t.formula_baza,
      t.formula_faiz ? Number(t.formula_faiz) : 0,
      t.yuvarla ? Number(t.yuvarla) : 0,
      {
        maya: input.alish_qiymeti ?? null,
        satis: input.satis_qiymeti ?? null,
        topdan: input.topdan_qiymeti ?? null,
      }
    );

    if (calc.value != null) {
      result[column] = calc.value;
    }
  }

  return result;
}
