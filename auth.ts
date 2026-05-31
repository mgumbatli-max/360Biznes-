import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cache } from "react";
import { z } from "zod";
import { prismaUnscoped } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import "@/lib/auth/types";

const LoginSchema = z.object({
  email: z.string().email("Email düzgün deyil"),
  password: z.string().min(6, "Şifrə ən az 6 simvol olmalıdır"),
});

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/qeydiyyat",
  "/paketler",
  "/demo",
  "/faq",
]);

const PUBLIC_PREFIXES = ["/api/auth", "/api/webhook/v1", "/zemanet", "/servis-track", "/_next", "/favicon.ico", "/assets", "/uploads"];

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
        const t0 = Date.now();
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // `select` ilə yalnız lazımi sahələr — Prisma daha az JOIN edir,
        // payload kiçik olur. `include` bütün sütunları gətirir.
        const user = await prismaUnscoped.istifadeciler.findFirst({
          where: { email: email.toLowerCase().trim(), aktiv: true },
          select: {
            id: true,
            email: true,
            ad_soyad: true,
            sifre_hash: true,
            sahibkar_id: true,
            rol_id: true,
            sahibkarlar: {
              select: {
                ad: true,
                status: true,
                abuneler: {
                  orderBy: { yaradildi: "desc" },
                  take: 1,
                  select: {
                    bitme: true,
                    status: true,
                    abune_planlari: { select: { kod: true, ad: true } },
                  },
                },
              },
            },
            roles: { select: { ad: true } },
          },
        });
        const tDb = Date.now();
        if (!user) return null;

        const ok = await verifyPassword(password, user.sifre_hash);
        const tBcrypt = Date.now();
        if (!ok) return null;

        // Tenant must be active
        if (user.sahibkarlar?.status !== "aktiv") return null;

        // Subscription must not be expired (if any)
        const abune = user.sahibkarlar?.abuneler?.[0];
        if (abune?.bitme && new Date(abune.bitme) < new Date()) return null;
        if (abune && abune.status && !["aktiv", "sinaq"].includes(abune.status)) return null;

        const rolId = user.rol_id ?? 0;

        // Touch last-login timestamp — fire-and-forget, login cavabını bloklamasın.
        void prismaUnscoped.istifadeciler
          .update({ where: { id: user.id }, data: { son_giris: new Date() } })
          .catch(() => {});

        // Diagnostic — Vercel log-larında axtarır: "[auth] timing"
        console.log(
          `[auth] timing db=${tDb - t0}ms bcrypt=${tBcrypt - tDb}ms total=${Date.now() - t0}ms`,
        );

        // NOTE: Permissions are deliberately NOT included here. With 307+
        // codes the JWT exceeds the 4KB cookie limit and gets chunked, which
        // breaks reassembly in some clients. Load via getRequestPermissions().
        return {
          id: user.id,
          email: user.email,
          ad_soyad: user.ad_soyad,
          sahibkar_id: user.sahibkar_id,
          sahibkar_ad: user.sahibkarlar?.ad ?? "",
          rol_id: rolId,
          rol_ad: user.roles?.ad ?? "",
          plan_kod: abune?.abune_planlari?.kod ?? null,
          plan_ad: abune?.abune_planlari?.ad ?? null,
          abune_bitme: abune?.bitme ? new Date(abune.bitme).toISOString() : null,
          abune_status: abune?.status ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
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
