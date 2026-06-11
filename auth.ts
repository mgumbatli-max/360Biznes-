import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";
import { headers } from "next/headers";
import { authorizeUser } from "@/lib/auth/credentials-core";
import "@/lib/auth/types";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/qeydiyyat",
  "/paketler",
  "/demo",
  "/faq",
]);

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/webhook/v1",
  "/api/mobile", // mobil REST — route öz Bearer token-ini yoxlayır (NextAuth cookie tələb etmir)
  "/zemanet",
  "/servis-track",
  "/_next",
  "/favicon.ico",
  "/assets",
  "/uploads",
];

const config = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }, // 7 days
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Şifrə", type: "password" },
      },
      async authorize(raw) {
        // Request hint-ləri — rate limit və audit üçün
        let ip: string | null = null;
        let ua: string | null = null;
        try {
          const h = await headers();
          const xff = h.get("x-forwarded-for");
          ip = xff?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
          ua = h.get("user-agent") || null;
        } catch { /* request scope dışı — pas */ }

        const res = await authorizeUser(
          raw as { email?: unknown; password?: unknown },
          { ip, ua },
        );
        if (!res.ok) return null;
        return res.user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        Object.assign(token, user);
        (token as Record<string, unknown>).revalidatedAt = Date.now();
        return token;
      }
      // QA-K4: JWT 7 gün yaşayır — rol dəyişikliyi / deaktivasiya dərhal
      // qüvvəyə minsin deyə token 60 saniyədən bir DB ilə tutuşdurulur:
      //  - istifadəçi silinib/deaktivdirsə → sessiya LƏĞV (null);
      //  - rol dəyişibsə → token-dəki rol_id/rol_ad yenilənir.
      const t = token as Record<string, unknown>;
      const last = typeof t.revalidatedAt === "number" ? t.revalidatedAt : 0;
      if (t.id && Date.now() - last > 60_000) {
        try {
          const { prismaUnscoped } = await import("@/lib/db/prisma");
          const u = await prismaUnscoped.istifadeciler.findUnique({
            where: { id: String(t.id) },
            select: { aktiv: true, rol_id: true, roles: { select: { ad: true } } },
          });
          if (!u || u.aktiv === false) return null; // dərhal logout
          t.rol_id = u.rol_id;
          t.rol_ad = u.roles?.ad ?? t.rol_ad;
          t.revalidatedAt = Date.now();
        } catch {
          // DB əlçatmazdırsa köhnə token qalsın — bütün istifadəçiləri
          // çıxarmaq əvəzinə növbəti intervalda yenidən cəhd olunur.
        }
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.user = { ...(session.user ?? {}), ...(token as any) };
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
      if (PUBLIC_ROUTES.has(pathname)) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

const nextAuth = NextAuth(config);
export const { handlers, signIn, signOut } = nextAuth;

// React `cache()` deduplicates `auth()` within a single Server Component render.
// Without this, every `withTenant()` call (5+ per dashboard navigation) would
// re-decode the JWT and re-run callbacks. Same signature as the original.
export const auth: typeof nextAuth.auth = cache(nextAuth.auth) as typeof nextAuth.auth;
