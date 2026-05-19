import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prismaUnscoped.istifadeciler.findFirst({
          where: { email: email.toLowerCase().trim(), aktiv: true },
          include: {
            sahibkarlar: {
              include: {
                abuneler: { orderBy: { yaradildi: "desc" }, take: 1, include: { abune_planlari: true } },
              },
            },
            roles: true,
          },
        });
        if (!user) return null;

        const ok = await verifyPassword(password, user.sifre_hash);
        if (!ok) return null;

        // Tenant must be active
        if (user.sahibkarlar?.status !== "aktiv") return null;

        // Subscription must not be expired (if any)
        const abune = user.sahibkarlar?.abuneler?.[0];
        if (abune?.bitme && new Date(abune.bitme) < new Date()) return null;
        if (abune && abune.status && !["aktiv", "sinaq"].includes(abune.status)) return null;

        const rolId = user.rol_id ?? 0;

        // Touch last-login timestamp
        await prismaUnscoped.istifadeciler.update({
          where: { id: user.id },
          data: { son_giris: new Date() },
        });

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

export const { handlers, auth, signIn, signOut } = NextAuth(config);
