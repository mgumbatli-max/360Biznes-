import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "./jwt";
import { runWithTenant, type TenantContext } from "@/lib/db/tenant-context";
import { loadPermissionsForRole, loadAllPermissionCodes } from "@/lib/auth/permissions";
import { prismaUnscoped } from "@/lib/db/prisma";

export async function getMobileTenant(req: NextRequest): Promise<TenantContext | null> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (!token) return null;
  const p = verifyAccessToken(token);
  if (!p) return null;

  // Hər sorğuda DB re-validasiyası (təhlükəsizlik — access token 15 dəq yaşayır):
  //  • dərhal ləğv — deaktiv edilmiş işçi / dayandırılmış tenant token-i artıq
  //    işləməsin (web login credentials-core ilə paritet);
  //  • JWT rol iddialarına ETİBAR ETMƏ — rol_id/rol_ad DB-dən yüklənir, beləcə
  //    forge olunmuş `rol_ad: "admin"` (secret kompromis ssenarisi) işləməz.
  const user = await prismaUnscoped.istifadeciler.findFirst({
    where: { id: p.istifadeci_id, sahibkar_id: p.sahibkar_id },
    select: {
      aktiv: true,
      rol_id: true,
      roles: { select: { ad: true } },
      sahibkarlar: { select: { status: true } },
    },
  });
  if (!user || user.aktiv !== true) return null;
  if (user.sahibkarlar?.status !== "aktiv") return null;

  const rolId = user.rol_id ?? p.rol_id;
  const rolAd = user.roles?.ad ?? p.rol_ad ?? "";
  const rLower = rolAd.toLowerCase();
  const icazeler = rLower === "sahibkar" || rLower === "admin"
    ? await loadAllPermissionCodes()
    : await loadPermissionsForRole(rolId);
  return { sahibkarId: p.sahibkar_id, istifadeciId: p.istifadeci_id, rolId, rolAd, icazeler };
}

/** Route içində: token yoxla → tenant kontekstində fn-i işlət. 401/500 idarəsi daxili. */
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
  const r = (ctx.rolAd ?? "").toLowerCase();
  if (r.includes("sahibkar") || r.includes("admin") || r.includes("owner") || r.includes("direktor")) return true;
  return codes.some((c) => ctx.icazeler.includes(c));
}
