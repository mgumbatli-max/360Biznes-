// Next.js 16+ renamed `middleware` to `proxy`. NextAuth v5-də mövcud
// canonical pattern: `auth()`-i callback ilə wrap et — callback `NextResponse`-ə
// header inject edə bilər. Bu yolla auth gating saxlanır VƏ x-pathname header
// inject olunur (layout-da route-based icazə yoxlaması üçün).

import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  // Exclude all static asset paths — proxy must NEVER run for images, fonts,
  // PWA manifest, robots, or sitemap. Each invocation re-runs auth() and
  // adds tens of ms on the critical path.
  matcher: [
    "/((?!api/auth|api/webhook/v1|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|assets|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|eot|map)$).*)",
  ],
};
