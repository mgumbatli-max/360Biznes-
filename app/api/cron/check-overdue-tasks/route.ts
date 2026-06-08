import { NextResponse, type NextRequest } from "next/server";
import { prismaUnscoped } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { _executeOverdueCheckForTenant } from "@/features/tapshiriqlar/actions";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Gecikmiş tapşırıqları yoxla — bütün tenant-larda.
 *
 * Hər aktiv sahibkar üçün:
 *   - system user kontekstində `_executeOverdueCheckForTenant` çağırılır
 *   - deadline keçmiş + status: yeni/icrada/gozlemede + escalation_enabled tapşırıqlar üçün
 *     açıq alert yoxdursa yenisi yaradılır + escalation_to-ya bildiriş gedir.
 *
 * Vercel Hobby plan üçün gündə bir dəfə (07:00 UTC = 11:00 Bakı) işə salınır.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const t0 = Date.now();

  const tenants = await prismaUnscoped.sahibkarlar.findMany({
    where: { status: "aktiv" },
    select: { id: true },
  });

  let processedTenants = 0;
  let totalCreated = 0;
  const errors: { tenantId: string; error: string }[] = [];

  for (const tenant of tenants) {
    const systemUser = await prismaUnscoped.istifadeciler.findFirst({
      where: { sahibkar_id: tenant.id, aktiv: true },
      orderBy: [{ rol_id: "asc" }],
      select: {
        id: true,
        rol_id: true,
        roles: { select: { ad: true } },
      },
    });
    if (!systemUser) continue;

    processedTenants += 1;
    try {
      const res = await runWithTenant(
        {
          sahibkarId: tenant.id,
          istifadeciId: systemUser.id,
          rolId: systemUser.rol_id ?? 0,
          rolAd: systemUser.roles?.ad ?? "sistem",
          icazeler: [],
        },
        () => _executeOverdueCheckForTenant(),
      );
      if (res.ok) {
        totalCreated += res.created;
      } else {
        errors.push({ tenantId: tenant.id, error: res.error });
      }
    } catch (e) {
      errors.push({
        tenantId: tenant.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    tenants: tenants.length,
    processed: processedTenants,
    created: totalCreated,
    elapsed_ms: Date.now() - t0,
    errors: errors.slice(0, 10),
  });
}
