// Next.js 16+ renamed `middleware` to `proxy`. The file must export the
// handler as `default` or named `proxy`. We delegate to NextAuth's `auth`
// helper which performs authentication and route gating (see auth.ts).
export { auth as proxy } from "@/auth";

export const config = {
  // Exclude all static asset paths — proxy must NEVER run for images, fonts,
  // PWA manifest, robots, or sitemap. Each invocation re-runs auth() and
  // adds tens of ms on the critical path.
  matcher: [
    "/((?!api/auth|api/webhook/v1|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|assets|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|eot|map)$).*)",
  ],
};
