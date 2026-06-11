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
