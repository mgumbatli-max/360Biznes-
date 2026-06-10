// Next.js 16+ renamed `middleware` to `proxy`. NextAuth v5-də mövcud
// canonical pattern: `auth()`-i callback ilə wrap et — callback `NextResponse`-ə
// header inject edə bilər. Bu yolla auth gating saxlanır VƏ x-pathname header
// inject olunur (layout-da route-based icazə yoxlaması üçün).

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Qlobal Lite/Pro rejimi — cookie yoxdursa cihaza görə ilkin təyin et:
  // mobil (telefon/tablet) → lite (sadə, sürətli), masaüstü → pro (tam).
  // Bundan sonra həm server (getAppMode), həm client eyni cookie-ni oxuyur.
  if (!req.cookies.get("app-mode")) {
    const ua = req.headers.get("user-agent") ?? "";
    const mode = /Mobile|Android|iPhone|iPad|iPod|Mobi/i.test(ua) ? "lite" : "pro";
    res.cookies.set("app-mode", mode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return res;
});

export const config = {
  // Exclude all static asset paths — proxy must NEVER run for images, fonts,
  // PWA manifest, robots, or sitemap. Each invocation re-runs auth() and
  // adds tens of ms on the critical path.
  matcher: [
    "/((?!api/auth|api/webhook/v1|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|wasm|assets|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|eot|map|wasm)$).*)",
  ],
};
