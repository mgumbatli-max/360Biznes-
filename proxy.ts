// Next.js 16+ renamed `middleware` to `proxy`. The file must export the
// handler as `default` or named `proxy`. We delegate to NextAuth's `auth`
// helper which performs authentication and route gating (see auth.ts).
export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/webhook/v1|_next/static|_next/image|favicon.ico|assets).*)",
  ],
};
