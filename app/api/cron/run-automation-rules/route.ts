import { NextResponse, type NextRequest } from "next/server";
import { prismaUnscoped } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { runRuleNow } from "@/features/avtomatlasdirma/actions";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 dəq — bütün tenant + qaydalar üçün

/**
 * Avtomatlaşdırma qaydalarının periodik icrası.
 *
 * Sahibkarın hər aktiv qaydası üçün uyğun obyektləri tapır və lazımi action-ları
 * (xəbərdarlıq yaratma və s.) icra edir. Manuel "İcra et" düyməsi əvəzinə bu cron
 * bütün tenant-larda qaydaları sahibkarın qarşılıqlı dəstəyi olmadan işlədir.
 *
 * Cron-əsaslı yanaşma: bütün qaydaları event-driven etmək (məhsul update-də stok
 * threshold yoxla, satış zamanı maya altı yoxla və s.) daha optimal olardı, amma:
 * - mövcud action-lara `runRuleEval()` hook qoşmaq lazım idi (geniş təsir)
 * - bəzi qaydalar zaman əsaslıdır (kassa 24 saatdır bağlanmayıb)
 *
 * 30 dəqiqəlik frequency: kifayət qədər sürətli (real-time olmasa da) və hər
 * tenant-ın aktiv qaydaları çoxalsa belə paralel yüklənmir.
 *
 * Vercel cron auth: `Authorization: Bearer <CRON_SECRET>` header tələb olunur
 * (Vercel cron qoşulanda avtomatik göndərir).
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET ilə qorun — boş olarsa açıq (yalnız dev üçün)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const t0 = Date.now();
  // 1. Bütün aktiv qaydaları cross-tenant çək
  const rules = await prismaUnscoped.avto_qayda.findMany({
    where: { aktiv: true },
    select: { id: true, sahibkar_id: true, ad: true, trigger_kod: true },
  });

  // 2. Sahibkara görə qruplaşdır
  type RuleRow = (typeof rules)[number];
  const byTenant = new Map<string, RuleRow[]>();
  for (const r of rules) {
    const arr = byTenant.get(r.sahibkar_id) ?? [];
    arr.push(r);
    byTenant.set(r.sahibkar_id, arr);
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: { tenantId: string; ruleId: number; error: string }[] = [];

  // 3. Hər tenant üçün:
  //    - sistem istifadəçisi tap (audit_log FK üçün lazım)
  //    - tenant context bağla, qaydaları icra et
  for (const [sahibkarId, tenantRules] of byTenant) {
    // Sahibkar (rol_ad="sahibkar") və ya ilk aktiv adminin id-si
    const systemUser = await prismaUnscoped.istifadeciler.findFirst({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      orderBy: [{ rol_id: "asc" }],
      select: {
        id: true,
        rol_id: true,
        roles: { select: { ad: true } },
      },
    });
    if (!systemUser) {
      // Bu tenant-da aktiv istifadəçi yoxdur — skip
      continue;
    }

    for (const rule of tenantRules) {
      processed++;
      try {
        const res = await runWithTenant(
          {
            sahibkarId,
            istifadeciId: systemUser.id,
            rolId: systemUser.rol_id ?? 0,
            rolAd: systemUser.roles?.ad,
            icazeler: [],
          },
          () => runRuleNow(rule.id),
        );
        if (res.ok) succeeded++;
        else {
          failed++;
          errors.push({ tenantId: sahibkarId, ruleId: rule.id, error: res.error });
        }
      } catch (e) {
        failed++;
        errors.push({
          tenantId: sahibkarId,
          ruleId: rule.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  const elapsed = Date.now() - t0;
  return NextResponse.json({
    ok: true,
    tenants: byTenant.size,
    rules: rules.length,
    processed,
    succeeded,
    failed,
    elapsed_ms: elapsed,
    // Yalnız ilk 10 xəta — payload-u kiçik saxlamaq üçün
    errors: errors.slice(0, 10),
  });
}
