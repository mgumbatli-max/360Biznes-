import "server-only";
import { cookies, headers } from "next/headers";

/**
 * Qlobal Lite / Pro rejimi — bütün saytda (təkcə POS yox).
 *
 * - **Lite**: yalnız ən vacib məlumat və funksiyalar, sadə formada — sahibkar
 *   rahat görsün/analiz etsin. Telefonda default.
 * - **Pro**: tam funksional, bütün detallar, qrafiklər, qabaqcıl filtirlər.
 *
 * Rejim `app-mode` cookie-sində saxlanır (proxy ilkin dəyəri UA-ya görə təyin
 * edir). Server Component-lər `getAppMode()` ilə oxuyur → Lite-da ağır bölmələr
 * heç render olunmur (tam sürətli). Client `useAppMode` eyni cookie-ni oxuyur.
 */
export type AppMode = "lite" | "pro";

export const APP_MODE_COOKIE = "app-mode";

export async function getAppMode(): Promise<AppMode> {
  const c = (await cookies()).get(APP_MODE_COOKIE)?.value;
  if (c === "lite" || c === "pro") return c;
  // Cookie hələ yoxdursa (ilk request — proxy cavabda təyin edir): UA fallback.
  const ua = (await headers()).get("user-agent") ?? "";
  return /Mobile|Android|iPhone|iPad|iPod|Mobi/i.test(ua) ? "lite" : "pro";
}
