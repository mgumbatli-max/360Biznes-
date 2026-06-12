import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import {
  getCategoryOptions,
  getBrandOptions,
  getUnitOptions,
} from "@/features/anbar/queries";

/**
 * GET — məhsul forması üçün referans seçimləri (kateqoriya / marka / vahid).
 * Yalnız autentifikasiya tələb edir (referans siyahıları həssas deyil);
 * funksiyalar tenant-aware və cache-lidir.
 */
export async function GET(req: NextRequest) {
  return withMobile(req, async () => {
    const [kateqoriyalar, markalar, vahidler] = await Promise.all([
      getCategoryOptions(),
      getBrandOptions(),
      getUnitOptions(),
    ]);
    return { kateqoriyalar, markalar, vahidler };
  });
}
