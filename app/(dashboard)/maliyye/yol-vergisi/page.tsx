import type { Metadata } from "next";
import Link from "next/link";
import { Truck, ArrowRight } from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Yol vergisi" };

async function getYolVergisiSummary() {
  return withTenant(async () => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const agg = await prisma.xercl_r.aggregate({
      where: { tarix: { gte: yearStart }, tesvir: { contains: "yol vergisi", mode: "insensitive" }, legv_de: null },
      _sum: { mebleg: true },
      _count: { _all: true },
    }).catch(() => ({ _sum: { mebleg: 0 }, _count: { _all: 0 } }));
    return {
      il_mebleg: Number(agg._sum.mebleg ?? 0),
      il_say: agg._count._all,
    };
  });
}

export default async function YolVergisiPage() {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("edv.idare");

  const s = await getYolVergisiSummary();

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Yol vergisi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Avtomobil və yük daşıma yol vergi ödəmələri.
        </p>
      </header>

      <MaliyyeSubNav active="/maliyye/yol-vergisi" />

      <Card className="glass">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/15 text-amber-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Bu il</div>
              <div className="text-xl font-bold tabular-nums">{formatMoney(s.il_mebleg)}</div>
              <div className="text-[10.5px] text-muted-foreground">{s.il_say} əməliyyat</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="py-4 space-y-3">
          <h3 className="text-sm font-semibold">Yol vergisi qeyd etmək üçün</h3>
          <p className="text-xs text-muted-foreground">
            Yeni əməliyyat formasında <strong>Xərclər</strong> tabını seçin, kateqoriya kimi <strong>Vergi</strong>-ni seçin və açıqlamada &quot;Yol vergisi&quot; yazın.
          </p>
          <Link
            href="/maliyye/emeliyyat/yeni?tip=xercler"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            Yol vergisi qeyd et <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
