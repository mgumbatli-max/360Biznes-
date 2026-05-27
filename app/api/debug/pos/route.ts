import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export const dynamic = "force-dynamic";

type Step = { step: string; ok: boolean; data?: unknown; error?: string };

export async function GET() {
  const steps: Step[] = [];
  const record = async (name: string, fn: () => Promise<unknown>) => {
    try {
      const data = await fn();
      steps.push({ step: name, ok: true, data });
    } catch (e) {
      const err = e as Error & { code?: string; meta?: unknown };
      steps.push({
        step: name,
        ok: false,
        error: `${err.code ? `[${err.code}] ` : ""}${err.message}`,
        data: err.meta,
      });
    }
  };

  await record("auth", async () => {
    const s = await auth();
    if (!s?.user) throw new Error("no session");
    return {
      user_id: s.user.id,
      sahibkar_id: s.user.sahibkar_id,
      rol_id: s.user.rol_id,
      rol_ad: s.user.rol_ad,
      ad_soyad: s.user.ad_soyad,
    };
  });

  if (!steps[0]?.ok) {
    return NextResponse.json({ steps }, { status: 401 });
  }

  await record("withTenant", () =>
    withTenant(async () => {
      const t = requireTenant();
      return {
        sahibkarId: t.sahibkarId,
        istifadeciId: t.istifadeciId,
        rolId: t.rolId,
        icazeler_count: t.icazeler.length,
      };
    })
  );

  await record("prisma.kassalar.count", () =>
    withTenant(() => prisma.kassalar.count())
  );

  await record("prisma.kassalar.findFirst-acig", () =>
    withTenant(() =>
      prisma.kassalar.findFirst({ where: { status: "acig" } })
    )
  );

  await record("prisma.filiallar.count", () =>
    withTenant(() => prisma.filiallar.count())
  );

  await record("prisma.sahibkarlar.findUnique-self", () =>
    withTenant(async () => {
      const t = requireTenant();
      return prisma.sahibkarlar.findUnique({
        where: { id: t.sahibkarId },
        select: { id: true, ad: true },
      });
    })
  );

  return NextResponse.json({ ok: steps.every((s) => s.ok), steps });
}
