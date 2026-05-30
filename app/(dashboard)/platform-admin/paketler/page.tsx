import type { Metadata } from "next";
import { Package, Users, ShoppingBag, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { prismaUnscoped } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";
import { PlanDialog } from "@/features/platform-admin/components/plan-dialog";

export const metadata: Metadata = { title: "Paketlər" };

async function getPlansWithUsage() {
  const plans = await prismaUnscoped.abune_planlari.findMany({
    orderBy: { ayl_q_qiymet: "asc" },
    include: {
      _count: {
        select: {
          abuneler: { where: { status: "aktiv", bitme: { gte: new Date() } } },
        },
      },
    },
  });
  return plans;
}

export default async function PlatformAdminPaketlerPage() {
  await requirePlatformAdmin();
  const plans = await getPlansWithUsage();

  const cemMrr = plans.reduce(
    (sum, p) => sum + p._count.abuneler * Number(p.ayl_q_qiymet ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paketlər</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Abunəlik planları və limitlər. Hər planın aktiv müştəri sayı və MRR-ə töhfəsi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="glass">
            <CardContent className="py-3 px-4">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Cəm MRR</div>
              <div className="mt-0.5 text-xl font-bold tabular-nums">{formatMoney(cemMrr)}</div>
            </CardContent>
          </Card>
          <PlanDialog />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const planMrr = p._count.abuneler * Number(p.ayl_q_qiymet ?? 0);
          return (
            <Card key={p.id} className={`glass ${!p.aktiv && "opacity-60"}`}>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary-light" />
                      <h3 className="text-lg font-bold">{p.ad}</h3>
                      {!p.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{p.kod}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums">{formatMoney(Number(p.ayl_q_qiymet))}</div>
                    <div className="text-[10.5px] text-muted-foreground">/ay</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-xs">
                  <Limit icon={Users} label="İstifadəçi" value={p.max_istifadeci} />
                  <Limit icon={ShoppingBag} label="Məhsul" value={p.max_mehsul} />
                  <Limit icon={Mail} label="Mesaj/ay" value={p.max_mesaj_ayl_q} />
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                  <span className="text-muted-foreground">Aktiv müştəri</span>
                  <span className="font-semibold tabular-nums">{p._count.abuneler}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Plan MRR</span>
                  <span className="font-semibold tabular-nums text-success">{formatMoney(planMrr)}</span>
                </div>
                {p.illik_qiymet && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">İllik qiymət</span>
                    <span className="tabular-nums">{formatMoney(Number(p.illik_qiymet))}</span>
                  </div>
                )}
                <div className="border-t border-border/40 pt-2">
                  <PlanDialog plan={{
                    id: p.id,
                    kod: p.kod,
                    ad: p.ad,
                    ayl_q_qiymet: Number(p.ayl_q_qiymet),
                    illik_qiymet: p.illik_qiymet ? Number(p.illik_qiymet) : null,
                    max_istifadeci: p.max_istifadeci,
                    max_mehsul: p.max_mehsul,
                    max_mesaj_ayl_q: p.max_mesaj_ayl_q,
                    storage_mb: (p.funksiyalar as { storage_mb?: number } | null)?.storage_mb ?? null,
                    aktiv: p.aktiv ?? true,
                  }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Limit({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | null }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value ?? "∞"}</div>
    </div>
  );
}
