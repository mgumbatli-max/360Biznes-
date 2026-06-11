# Mobil Faza 1A — API təməli + Auth + Məhsul REST · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RN mobil app-in çağıracağı token-əsaslı `/api/mobile/v1/**` REST qatını qurmaq — login/refresh/logout/me + Anbar/Məhsul (siyahı, detal, yarat, redaktə, barkod, şəkil), mövcud backend məntiqini təkrar işlədərək.

**Architecture:** Mobil token JWT (HS256, `jsonwebtoken`) + DB-də revoke oluna bilən refresh token. `getMobileTenant(req)` Bearer-i verify edib `runWithTenant` ilə tenant+rol+icazə kontekstini qurur. Route-lar mövcud `getProducts` (oxu) və ortaq `saveProductCore` (yazma — `saveProduct`-dan çıxarılır) funksiyalarını çağırır → web + mobil eyni qaynaq, davranış 1:1. Login məntiqi `auth.ts authorize`-dan `authorizeUser()` core-a çıxarılır.

**Tech Stack:** Next.js 16 route handlers, `jsonwebtoken` (^9.0.3, artıq quraşdırılıb), Prisma (`prismaUnscoped`), mövcud `verifyPassword` / `runWithTenant` / `loadPermissionsForRole` / `getProducts` / `scanLookup` / `saveUploadFile`.

**Verification:** Bu repo unit-test framework işlətmir. Hər task `npx tsc --noEmit` + (lazım olduqda) `scripts/qa/test-mobile-api.mjs` inteqrasiya skripti (login → token → endpoint) ilə yoxlanır. Son task `npm run build`.

---

## File Structure

| Fayl | Məsuliyyət |
|---|---|
| `lib/mobile/jwt.ts` | Access token sign/verify (HS256) |
| `lib/mobile/refresh-store.ts` | Refresh token issue/rotate/revoke (DB, sha256 hash) |
| `lib/mobile/session.ts` | `getMobileTenant(req)`, `withMobile(req, fn)`, `requireMobilePerm` |
| `lib/auth/credentials-core.ts` | `authorizeUser(email,password,meta)` — login core (auth.ts-dən çıxarılır) |
| `prisma/schema.prisma` | `mobil_refresh_tokens` modeli (additiv) |
| `app/api/mobile/v1/auth/login/route.ts` | POST login |
| `app/api/mobile/v1/auth/refresh/route.ts` | POST refresh |
| `app/api/mobile/v1/auth/logout/route.ts` | POST logout |
| `app/api/mobile/v1/me/route.ts` | GET cari istifadəçi + icazələr |
| `app/api/mobile/v1/mehsullar/route.ts` | GET list (axtarış/filter/pagination), POST yarat |
| `app/api/mobile/v1/mehsullar/[id]/route.ts` | GET detal, PUT redaktə |
| `app/api/mobile/v1/mehsullar/barkod/[code]/route.ts` | GET barkod lookup |
| `app/api/mobile/v1/upload/route.ts` | POST şəkil (mobil token + `saveUploadFile`) |
| `features/anbar/save-product-core.ts` | `saveProductCore()` — `saveProduct`-dan çıxarılan ortaq DB məntiqi |
| `proxy.ts` | `/api/mobile` public-prefix (route öz Bearer-ini yoxlayır) |
| `scripts/qa/test-mobile-api.mjs` | İnteqrasiya yoxlaması |
| `.env` / `.env.example` | `MOBILE_JWT_SECRET` |

---

## Task 1: Mobil JWT util

**Files:** Create `lib/mobile/jwt.ts`

- [ ] **Step 1: `.env`-ə secret əlavə et**

`.env` və `.env.example`-ə əlavə et (lokal üçün istənilən uzun random):
```
MOBILE_JWT_SECRET="<openssl rand -base64 48 nəticəsi>"
```
Prod: Vercel env-ə `MOBILE_JWT_SECRET` əlavə olunmalı (handoff qeydində).

- [ ] **Step 2: jwt util yaz**

`lib/mobile/jwt.ts`:
```ts
import "server-only";
import jwt from "jsonwebtoken";

const SECRET = process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET || "dev-only-secret";
const ACCESS_TTL = "15m";

export type MobileTokenPayload = {
  sahibkar_id: string;
  istifadeci_id: string;
  rol_id: number;
  rol_ad: string;
};

export function signAccessToken(p: MobileTokenPayload): string {
  return jwt.sign(p, SECRET, { algorithm: "HS256", expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): MobileTokenPayload | null {
  try {
    const d = jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as MobileTokenPayload & { iat: number; exp: number };
    return { sahibkar_id: d.sahibkar_id, istifadeci_id: d.istifadeci_id, rol_id: d.rol_id, rol_ad: d.rol_ad };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: tsc yoxla** — `npx tsc --noEmit` → xəta yox.
- [ ] **Step 4: Commit** — `git add lib/mobile/jwt.ts .env.example && git commit -m "feat(mobil): JWT access token util"`

---

## Task 2: Refresh token cədvəli (Prisma)

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Model əlavə et** (`prisma/schema.prisma` sonuna):
```prisma
model mobil_refresh_tokens {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sahibkar_id   String    @db.Uuid
  istifadeci_id String    @db.Uuid
  token_hash    String    @unique @db.VarChar(64)
  cihaz         String?   @db.VarChar(120)
  expires_at    DateTime  @db.Timestamptz(6)
  revoked_at    DateTime? @db.Timestamptz(6)
  yaradildi     DateTime  @default(now()) @db.Timestamptz(6)

  @@index([istifadeci_id])
  @@index([sahibkar_id])
}
```

- [ ] **Step 2: Lokal DB-yə tətbiq et + client generate**

Run: `DIRECT_URL="$DATABASE_URL" npx prisma db push && npx prisma generate`
Expected: `🚀 Your database is now in sync` + client regenerated. (Additiv — heç nə silinmir; prod build-də avtomatik tətbiq olunur.)

- [ ] **Step 3: tsc yoxla** — `npx tsc --noEmit` → `prisma.mobil_refresh_tokens` tanınır.
- [ ] **Step 4: Commit** — `git add prisma/schema.prisma && git commit -m "feat(mobil): mobil_refresh_tokens cədvəli (additiv)"`

---

## Task 3: Refresh token store

**Files:** Create `lib/mobile/refresh-store.ts`

- [ ] **Step 1: Yaz:**
```ts
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prismaUnscoped } from "@/lib/db/prisma";

const REFRESH_TTL_DAYS = 30;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function issueRefreshToken(sahibkarId: string, istifadeciId: string, cihaz?: string | null): Promise<string> {
  const raw = randomBytes(48).toString("base64url");
  await prismaUnscoped.mobil_refresh_tokens.create({
    data: {
      sahibkar_id: sahibkarId,
      istifadeci_id: istifadeciId,
      token_hash: hash(raw),
      cihaz: cihaz ?? null,
      expires_at: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
    },
  });
  return raw;
}

/** Köhnəni revoke edib yenisini verir (rotation). Tapılmaz/bitmiş/revoke → null. */
export async function rotateRefreshToken(raw: string): Promise<{ sahibkarId: string; istifadeciId: string; cihaz: string | null; newRaw: string } | null> {
  const row = await prismaUnscoped.mobil_refresh_tokens.findUnique({ where: { token_hash: hash(raw) } });
  if (!row || row.revoked_at || row.expires_at < new Date()) return null;
  await prismaUnscoped.mobil_refresh_tokens.update({ where: { id: row.id }, data: { revoked_at: new Date() } });
  const newRaw = await issueRefreshToken(row.sahibkar_id, row.istifadeci_id, row.cihaz);
  return { sahibkarId: row.sahibkar_id, istifadeciId: row.istifadeci_id, cihaz: row.cihaz, newRaw };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prismaUnscoped.mobil_refresh_tokens.updateMany({ where: { token_hash: hash(raw) }, data: { revoked_at: new Date() } });
}
```

- [ ] **Step 2: tsc yoxla** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit** — `git add lib/mobile/refresh-store.ts && git commit -m "feat(mobil): refresh token store (sha256, rotation, revoke)"`

---

## Task 4: Login core-u auth.ts-dən çıxar

**Files:** Create `lib/auth/credentials-core.ts`; Modify `auth.ts`

- [ ] **Step 1: `auth.ts`-i oxu** — `authorize(raw)` (təxminən sətir 34-186) məntiqini başa düş: LoginSchema parse, ip/ua, `checkLoginRate`, `recordLoginAttempt`, `prismaUnscoped.istifadeciler.findFirst({where:{email,aktiv:true}, select:{...}})`, `verifyPassword`, tenant `status==='aktiv'` + abunə yoxlaması, qaytarılan `user` obyekti.

- [ ] **Step 2: Core funksiya yarat** `lib/auth/credentials-core.ts` — `authorize`-ın MƏNTİQİNİ ora köçür (eyni kod), bu imza ilə:
```ts
import "server-only";
import { prismaUnscoped } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginRate, recordLoginAttempt } from "@/features/auth/login-rate"; // auth.ts-dəki real import yolu ilə əvəz et
// ... auth.ts-dəki LoginSchema və digər importları köçür

export type AuthorizedUser = {
  id: string; email: string; ad_soyad: string;
  sahibkar_id: string; sahibkar_ad: string;
  rol_id: number; rol_ad: string;
  plan_kod?: string | null; plan_ad?: string | null; abune_bitme?: string | null; abune_status?: string | null;
};

export async function authorizeUser(
  raw: { email?: unknown; password?: unknown },
  meta: { ip?: string | null; ua?: string | null },
): Promise<{ ok: true; user: AuthorizedUser } | { ok: false; reason: string }> {
  // auth.ts authorize-ın bütün məntiqi — return null əvəzinə { ok:false, reason } ;
  // uğurlu user əvəzinə { ok:true, user }.
}
```

- [ ] **Step 3: `auth.ts authorize`-ı core-a yönəlt:**
```ts
async authorize(raw, req) {
  const ip = /* mövcud ip çıxarışı */;
  const ua = /* mövcud ua çıxarışı */;
  const res = await authorizeUser(raw as { email?: unknown; password?: unknown }, { ip, ua });
  if (!res.ok) return null;
  return res.user; // eyni forma — NextAuth davranışı dəyişmir
}
```

- [ ] **Step 4: tsc + build yoxla** — `npx tsc --noEmit` təmiz; `npm run build` keçir (NextAuth login regress yox).
- [ ] **Step 5: Web login-i smoke et** — dev server (`PORT=3500 npm run dev`), `scripts/qa/smoke-all-pages.mjs` login addımı keçməlidir (test-sahibkar@example.com / Test1234!).
- [ ] **Step 6: Commit** — `git add lib/auth/credentials-core.ts auth.ts && git commit -m "refactor(auth): authorize məntiqi authorizeUser core-a (web+mobil paylaşım)"`

---

## Task 5: getMobileTenant + withMobile session helper

**Files:** Create `lib/mobile/session.ts`

- [ ] **Step 1: Yaz** (TenantContext sahələri: `sahibkarId, istifadeciId, rolId, rolAd, icazeler` — `lib/db/tenant-context.ts`):
```ts
import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";
import { runWithTenant, type TenantContext } from "@/lib/db/tenant-context";
import { loadPermissionsForRole, loadAllPermissionCodes } from "@/lib/auth/permissions";

export async function getMobileTenant(req: NextRequest): Promise<TenantContext | null> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (!token) return null;
  const p = verifyAccessToken(token);
  if (!p) return null;
  const rolAd = (p.rol_ad ?? "").toLowerCase();
  const icazeler = rolAd === "sahibkar" || rolAd === "admin"
    ? await loadAllPermissionCodes()
    : await loadPermissionsForRole(p.rol_id);
  return { sahibkarId: p.sahibkar_id, istifadeciId: p.istifadeci_id, rolId: p.rol_id, rolAd: p.rol_ad, icazeler };
}

/** Route içində: token yoxla → tenant kontekstində fn-i işlət. 401 idarəsi daxili. */
export async function withMobile<T>(
  req: NextRequest,
  fn: (ctx: TenantContext) => Promise<T>,
): Promise<NextResponse> {
  const ctx = await getMobileTenant(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await runWithTenant(ctx, () => fn(ctx));
    return NextResponse.json(data);
  } catch (e) {
    console.error("[mobile]", req.nextUrl.pathname, e);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}

export function mobilePerm(ctx: TenantContext, ...codes: string[]): boolean {
  const r = ctx.rolAd.toLowerCase();
  if (r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor")) return true;
  return codes.some((c) => ctx.icazeler.includes(c));
}
```

- [ ] **Step 2: tsc yoxla** — `loadPermissionsForRole`/`loadAllPermissionCodes` `lib/auth/permissions.ts`-dən idxal olunur (mövcud).
- [ ] **Step 3: Commit** — `git add lib/mobile/session.ts && git commit -m "feat(mobil): getMobileTenant + withMobile session helper"`

---

## Task 6: proxy.ts — /api/mobile public prefix

**Files:** Modify `proxy.ts` (və auth public-prefix siyahısı — `auth.ts` `PUBLIC_PREFIXES`)

- [ ] **Step 1:** `auth.ts`-də `PUBLIC_PREFIXES` (və ya proxy authorized) siyahısına `/api/mobile` əlavə et — beləcə NextAuth cookie tələb etmir; route öz Bearer-ini yoxlayır.
```ts
// PUBLIC_PREFIXES massivinə:
"/api/mobile",
```
- [ ] **Step 2: build yoxla** — `npm run build` keçir.
- [ ] **Step 3: Commit** — `git add auth.ts proxy.ts && git commit -m "chore(mobil): /api/mobile public-prefix (route öz Bearer yoxlaması)"`

---

## Task 7: Auth route-ları (login/refresh/logout/me)

**Files:** Create 4 route faylı

- [ ] **Step 1: login** `app/api/mobile/v1/auth/login/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "@/lib/auth/credentials-core";
import { signAccessToken } from "@/lib/mobile/jwt";
import { issueRefreshToken } from "@/lib/mobile/refresh-store";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const res = await authorizeUser({ email: body?.email, password: body?.password }, { ip, ua });
  if (!res.ok) return NextResponse.json({ error: "Email və ya şifrə yanlışdır" }, { status: 401 });
  const u = res.user;
  const accessToken = signAccessToken({ sahibkar_id: u.sahibkar_id, istifadeci_id: u.id, rol_id: u.rol_id, rol_ad: u.rol_ad });
  const refreshToken = await issueRefreshToken(u.sahibkar_id, u.id, body?.cihaz ?? ua);
  return NextResponse.json({ accessToken, refreshToken, user: u });
}
```

- [ ] **Step 2: refresh** `app/api/mobile/v1/auth/refresh/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db/prisma";
import { signAccessToken } from "@/lib/mobile/jwt";
import { rotateRefreshToken } from "@/lib/mobile/refresh-store";

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json().catch(() => ({}));
  if (!refreshToken) return NextResponse.json({ error: "refreshToken yoxdur" }, { status: 400 });
  const r = await rotateRefreshToken(refreshToken);
  if (!r) return NextResponse.json({ error: "Sessiya bitib, yenidən daxil olun" }, { status: 401 });
  const u = await prismaUnscoped.istifadeciler.findFirst({
    where: { id: r.istifadeciId, aktiv: true },
    select: { id: true, rol_id: true, sahibkar_id: true, roles: { select: { ad: true } } },
  });
  if (!u) return NextResponse.json({ error: "İstifadəçi aktiv deyil" }, { status: 401 });
  const accessToken = signAccessToken({ sahibkar_id: u.sahibkar_id, istifadeci_id: u.id, rol_id: u.rol_id ?? 0, rol_ad: u.roles?.ad ?? "" });
  return NextResponse.json({ accessToken, refreshToken: r.newRaw });
}
```

- [ ] **Step 3: logout** `app/api/mobile/v1/auth/logout/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/mobile/refresh-store";
export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json().catch(() => ({}));
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: me** `app/api/mobile/v1/me/route.ts`:
```ts
import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { prismaUnscoped } from "@/lib/db/prisma";
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const u = await prismaUnscoped.istifadeciler.findFirst({
      where: { id: ctx.istifadeciId },
      select: { id: true, ad_soyad: true, email: true, vezife: true, roles: { select: { ad: true } } },
    });
    return { user: u, rol_ad: ctx.rolAd, icazeler: ctx.icazeler };
  });
}
```

- [ ] **Step 5: build yoxla** — `npm run build`.
- [ ] **Step 6: Commit** — `git add app/api/mobile/v1/auth app/api/mobile/v1/me && git commit -m "feat(mobil): auth route-ları (login/refresh/logout/me)"`

---

## Task 8: İnteqrasiya test skripti (auth)

**Files:** Create `scripts/qa/test-mobile-api.mjs`

- [ ] **Step 1: Yaz** (login → me yoxlaması; dev server :3500 işləməlidir):
```js
const BASE = process.env.BASE || "http://localhost:3500";
const j = async (path, opt) => { const r = await fetch(BASE + path, opt); return { s: r.status, b: await r.json().catch(() => ({})) }; };
const login = await j("/api/mobile/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "test-sahibkar@example.com", password: "Test1234!" }) });
console.log("login:", login.s, login.b.accessToken ? "token ✓" : login.b);
const tok = login.b.accessToken;
const me = await j("/api/mobile/v1/me", { headers: { Authorization: "Bearer " + tok } });
console.log("me:", me.s, me.b?.user?.email, "icazə:", me.b?.icazeler?.length);
const noauth = await j("/api/mobile/v1/me", {});
console.log("me (token-suz):", noauth.s, "(401 olmalı)");
```

- [ ] **Step 2: Dev server qaldır + işlət**

Run (background dev): `PORT=3500 npm run dev` → hazır olanda `node scripts/qa/test-mobile-api.mjs`
Expected: `login: 200 token ✓`, `me: 200 <email> icazə: <N>`, `me (token-suz): 401`.

- [ ] **Step 3: Commit** — `git add scripts/qa/test-mobile-api.mjs && git commit -m "test(mobil): auth inteqrasiya skripti"`

---

## Task 9: Məhsul siyahı + barkod (oxu)

**Files:** Create `app/api/mobile/v1/mehsullar/route.ts` (GET), `app/api/mobile/v1/mehsullar/barkod/[code]/route.ts`

- [ ] **Step 1: list GET** — mövcud `getProducts(filter, page, pageSize)` (`features/anbar/queries.ts`) işlədilir:
```ts
import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getProducts } from "@/features/anbar/queries";

export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "mehsul.oxu", "anbar.oxu")) return { error: "İcazə yox", items: [], total: 0 };
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const res = await getProducts(
      { search: sp.get("q") ?? undefined, recordStatus: "aktiv" },
      page, 20,
    );
    return res; // { items, total }
  });
}
```
(Qeyd: `getProducts` filter tipindəki real sahələri `features/anbar/queries.ts:353-375`-dən yoxla; lazımsız sahə vermə.)

- [ ] **Step 2: barkod GET** `…/mehsullar/barkod/[code]/route.ts` — mövcud `scanLookup` (`features/ticaret/qaytarma-tez-actions.ts:33`):
```ts
import { NextRequest } from "next/server";
import { withMobile } from "@/lib/mobile/session";
import { scanLookup } from "@/features/ticaret/qaytarma-tez-actions";
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return withMobile(req, async () => await scanLookup(decodeURIComponent(code)));
}
```

- [ ] **Step 3: Test skriptinə əlavə et** (`test-mobile-api.mjs` sonuna):
```js
const list = await j("/api/mobile/v1/mehsullar?q=", { headers: { Authorization: "Bearer " + tok } });
console.log("mehsullar:", list.s, "say:", list.b?.total, "ilk:", list.b?.items?.[0]?.ad);
```
Run: `node scripts/qa/test-mobile-api.mjs` → `mehsullar: 200 say: <N> ilk: <ad>`.

- [ ] **Step 4: tsc + Commit** — `npx tsc --noEmit`; `git add app/api/mobile/v1/mehsullar scripts/qa/test-mobile-api.mjs && git commit -m "feat(mobil): məhsul siyahı + barkod lookup (oxu)"`

---

## Task 10: saveProductCore çıxarışı + Məhsul detal/yarat/redaktə

**Files:** Create `features/anbar/save-product-core.ts`; Modify `features/anbar/actions.ts`; Create `app/api/mobile/v1/mehsullar/[id]/route.ts`; Modify `app/api/mobile/v1/mehsullar/route.ts` (POST)

- [ ] **Step 1: `features/anbar/actions.ts saveProduct`-i oxu** — `withTenant` daxilindəki DB məntiqini (parse-dan sonra `data` qurulması, qiymət guard, applyPriceFormulas, create/update, stok, audit) müəyyən et.

- [ ] **Step 2: Core çıxar** `features/anbar/save-product-core.ts` — DB məntiqini ora köçür (tenant kontekstinin QURULDUĞUNU fərz edir — `requireTenant()` işlədir):
```ts
import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
// applyPriceFormulas və s. mövcud importlar

export type ProductInput = { /* ProductSchema-nın parse olunmuş tipi — actions.ts-dən */ };

/** Tenant kontekstində ÇAĞIRILMALIDIR (runWithTenant və ya withTenant daxili). */
export async function saveProductCore(d: ProductInput, opts: { canEditPrice: boolean }): Promise<{ id: string; pending_approval?: boolean }> {
  const { sahibkarId } = requireTenant();
  // saveProduct-ın withTenant daxilindəki məntiqi olduğu kimi (data qurulması, qiymət guard,
  // applyPriceFormulas, create/update, approval). opts.canEditPrice qiymət gating üçün.
}
```
Sonra `saveProduct`-ı core-u çağıracaq şəkildə yenidən qur (icazə yoxlaması + parse action-da qalır, DB işi core-da). Web davranışı 1:1 saxlanır.

- [ ] **Step 3: detal GET + redaktə PUT** `app/api/mobile/v1/mehsullar/[id]/route.ts`:
```ts
import { NextRequest } from "next/server";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getProductDetail } from "@/features/anbar/queries"; // mövcud detal funksiyası ilə əvəz et
import { saveProductCore } from "@/features/anbar/save-product-core";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withMobile(req, async (c) => {
    if (!mobilePerm(c, "mehsul.oxu", "anbar.oxu")) return { error: "İcazə yox" };
    return await getProductDetail(id); // detal + son alış/satış/servis lazım gələrsə əlavə query
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withMobile(req, async (c) => {
    if (!mobilePerm(c, "mehsul.duzelt")) return { error: "İcazə yox" };
    const body = await req.json();
    const canEditPrice = mobilePerm(c, "qiymet.duzelt");
    const r = await saveProductCore({ ...body, id }, { canEditPrice });
    return { ok: true, id: r.id };
  });
}
```
(Qeyd: real detal query adını `features/anbar/queries.ts`-dən tap; yoxdursa `getProducts`-dan tək-element və ya yeni `getProductDetail` əlavə et.)

- [ ] **Step 4: yarat POST** (`app/api/mobile/v1/mehsullar/route.ts`-ə əlavə et):
```ts
export async function POST(req: NextRequest) {
  return withMobile(req, async (c) => {
    if (!mobilePerm(c, "mehsul.yarat")) return { error: "İcazə yox" };
    const body = await req.json();
    const canEditPrice = mobilePerm(c, "qiymet.duzelt");
    const r = await saveProductCore(body, { canEditPrice });
    return { ok: true, id: r.id, pending_approval: r.pending_approval ?? false };
  });
}
```

- [ ] **Step 5: build + web smoke** — `npm run build`; `node scripts/qa/smoke-all-pages.mjs` (web məhsul yaratma regress yox — saveProduct hələ işləyir).
- [ ] **Step 6: test skriptinə create yoxlaması əlavə et** — POST ilə test məhsul yarat, 200 + id qaytarmalı; sonra detal GET ilə oxu.
- [ ] **Step 7: Commit** — `git add features/anbar/save-product-core.ts features/anbar/actions.ts app/api/mobile/v1/mehsullar scripts/qa/test-mobile-api.mjs && git commit -m "feat(mobil): məhsul detal/yarat/redaktə (saveProductCore paylaşımı)"`

---

## Task 11: Mobil şəkil yükləmə

**Files:** Create `app/api/mobile/v1/upload/route.ts`

- [ ] **Step 1: Yaz** — mövcud `saveUploadFile` (`lib/storage/upload.ts`, Vercel Blob) + mobil token:
```ts
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { withMobile } from "@/lib/mobile/session";
import { saveUploadFile } from "@/lib/storage/upload";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  return withMobile(req, async () => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return { error: "Fayl yoxdur" };
    const type = (file as File).type || "";
    if (!ALLOWED.has(type)) return { error: "Yalnız JPEG/PNG/WebP" };
    if (file.size > 4 * 1024 * 1024) return { error: "4 MB-dan böyük" };
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await saveUploadFile(buf, `mehsul/${randomUUID()}.${ext}`, type);
    return { url };
  });
}
```

- [ ] **Step 2: build + Commit** — `npm run build`; `git add app/api/mobile/v1/upload && git commit -m "feat(mobil): şəkil yükləmə (Blob + mobil token)"`

---

## Task 12: Yekun yoxlama + sənədləşmə

- [ ] **Step 1: Tam inteqrasiya** — dev :3500, `node scripts/qa/test-mobile-api.mjs` → bütün sətirlər keçir (login, me, 401, list, barkod, create, detail, upload).
- [ ] **Step 2: `npm run build`** → 218+ səhifə, xəta yox.
- [ ] **Step 3: API kontraktını sənədləşdir** — `docs/superpowers/specs/mobil-api-kontrakt.md` (endpoint, metod, request, response nümunələri) — Faza 1B (RN) bunu işlədəcək.
- [ ] **Step 4: Commit** — `git add docs && git commit -m "docs(mobil): API kontrakt sənədi"`

---

## Out of scope (1A)
- RN app (Faza 1B).
- Push token save/göndərmə (Faza 5).
- Satış/maliyyə/müştəri endpoint-ləri (sonrakı fazalar).
- Prod Vercel env `MOBILE_JWT_SECRET` — handoff qeydi (istifadəçi əlavə edir).
