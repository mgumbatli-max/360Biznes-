import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, ArrowRight } from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "ƏDV" };

async function getEdvSummary() {
  return withTenant(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(monthStart.getFullYear(), 0, 1);

    const [bu_ay, bu_il] = await Promise.all([
      prisma.xercl_r.aggregate({
        where: { tarix: { gte: monthStart }, qeyd: { contains: "[KAT:edv]" } },
        _sum: { mebleg: true },
        _count: { _all: true },
      }).catch(() => ({ _sum: { mebleg: 0 }, _count: { _all: 0 } })),
      prisma.xercl_r.aggregate({
        where: { tarix: { gte: yearStart }, qeyd: { contains: "[KAT:edv]" } },
        _sum: { mebleg: true },
        _count: { _all: true },
      }).catch(() => ({ _sum: { mebleg: 0 }, _count: { _all: 0 } })),
    ]);

    return {
      ay_mebleg: Number(bu_ay._sum.mebleg ?? 0),
      ay_say: bu_ay._count._all,
      il_mebleg: Number(bu_il._sum.mebleg ?? 0),
      il_say: bu_il._count._all,
    };
  });
}

export default async function EdvPage() {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("edv.idare");

  const s = await getEdvSummary();

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">ƏDV</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ƏDV ödəmələri — Xərclər jurnalında kateqoriya filtri.
        </p>
      </header>

      <MaliyyeSubNav active="/maliyye/edv" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="glass">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Bu ay</div>
                <div className="text-xl font-bold tabular-nums">{formatMoney(s.ay_mebleg)}</div>
                <div className="text-[10.5px] text-muted-foreground">{s.ay_say} əməliyyat</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Bu il</div>
                <div className="text-xl font-bold tabular-nums">{formatMoney(s.il_mebleg)}</div>
                <div className="text-[10.5px] text-muted-foreground">{s.il_say} əməliyyat</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardContent className="py-4 space-y-3">
          <h3 className="text-sm font-semibold">ƏDV əməliyyatı qeyd etmək üçün</h3>
          <p className="text-xs text-muted-foreground">
            Yeni əməliyyat formasında <strong>Xərclər</strong> tabını seçin, sonra alt kateqoriya kimi <strong>ƏDV</strong>-ni seçin.
          </p>
          <Link
            href="/maliyye/emeliyyat/yeni?tip=xercler"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            ƏDV ödənişi əlavə et <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
