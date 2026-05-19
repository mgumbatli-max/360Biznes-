import "server-only";
import { cookies } from "next/headers";

export type StealthState = {
  aktiv: boolean;
  scale: number;       // 0 < scale < 1 (məs. 0.2 = 20% göstər)
  realScale: 1;        // həmişə 1 — eksport / hesabat üçün
};

/**
 * Gizli rejimin cari halını oxuyur. Cookie-dən gəlir.
 * Real data heç vaxt dəyişmir — yalnız UI rəqəmləri scale × value göstərilir.
 *
 * Vacib: Bu funksiya YALNIZ ekran göstərmə üçün istifadə edilməlidir.
 * Bank inteqrasiyası, vergi hesabatı, kassa-bank uzlaşma, Excel eksport
 * MƏCBURI realScale=1 istifadə etməlidir.
 */
export async function getStealthState(): Promise<StealthState> {
  try {
    const c = await cookies();
    const aktiv = c.get("stealth_mode")?.value === "1";
    const scaleRaw = c.get("stealth_scale")?.value;
    let scale = 0.2;
    if (scaleRaw) {
      const n = Number(scaleRaw);
      if (Number.isFinite(n) && n > 0 && n < 1) scale = n;
    }
    return {
      aktiv,
      scale: aktiv ? scale : 1,
      realScale: 1,
    };
  } catch {
    return { aktiv: false, scale: 1, realScale: 1 };
  }
}

/**
 * Tezgah istifadəsi: rəqəmi scale əmsalı ilə vurub qaytarır.
 * Gizli rejim aktivdirsə kiçildir, aktiv deyilsə dəyişməz qaytarır.
 */
export function applyStealth(value: number, state: StealthState): number {
  if (!state.aktiv) return value;
  return value * state.scale;
}
