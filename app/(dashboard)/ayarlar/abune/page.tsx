import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatMoney, formatDate } from "@/lib/utils";
import { PlanChangeDialog } from "@/features/ayarlar/components/plan-change-dialog";

export const metadata: Metadata = { title: "Abunə" };

async function getSubscriptionInfo() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [current, history, modules, plans] = await Promise.all([
      prisma.abuneler.findFirst({
        where: { sahibkar_id: sahibkarId },
        orderBy: { yaradildi: "desc" },
        include: { abune_planlari: true },
      }),
      prisma.abuneler.findMany({
        where: { sahibkar_id: sahibkarId },
        orderBy: { yaradildi: "desc" },
        include: { abune_planlari: true },
        take: 10,
      }),
      prisma.sahibkar_modullar.count({ where: { aktiv: true } }),
      prisma.abune_planlari.findMany({ orderBy: { ayl_q_qiymet: "asc" } }),
    ]);
    return { current, history, modules, plans };
  });
}

export default async function AbunePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const info = await getSubscriptionInfo();

  const cur = info.current;
  const isTrial = cur?.novu === "sinaq";
  // eslint-disable-next-line react-hooks/purity -- server component, deterministic per request
  const now = Date.now();
  const daysLeft = cur?.bitme ? Math.ceil((new Date(cur.bitme).getTime() - now) / (24 * 3600 * 1000)) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Abunə</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cari paket, ödəniş tarixçəsi və yenilənmə.</p>
        </div>
        <PlanChangeDialog
          plans={info.plans.map((p) => ({
            id: p.id,
            kod: p.kod,
            ad: p.ad,
            ayl_q_qiymet: Number(p.ayl_q_qiymet),
            illik_qiymet: p.illik_qiymet ? Number(p.illik_qiymet) : null,
            max_istifadeci: p.max_istifadeci,
            max_mehsul: p.max_mehsul,
            max_mesaj_ayl_q: p.max_mesaj_ayl_q,
            aktiv: p.aktiv ?? true,
          }))}
          currentPlanId={cur?.plan_id ?? null}
        />
      </header>

      {!cur ? (
        <Card className="glass border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Aktiv abunə yoxdur.</p>
            <Link href="/paketler" className="mt-3 inline-flex items-center gap-1 text-primary-light hover:underline">
              Paketlərə bax <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass border-primary/20">
          <CardContent className="space-y-3 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {isTrial ? (
                    <Sparkles className="h-5 w-5 text-warning" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-success" />
                  )}
                  <h2 className="text-xl font-bold">{cur.abune_planlari?.ad}</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isTrial ? "Sınaq dövründəsiniz" : `${cur.novu === "aylıq" ? "Aylıq" : "İllik"} abunə`}
                </p>
              </div>
              <Badge variant="outline" className={cur.status === "aktiv" ? "border-success/30 text-success" : "border-warning/30 text-warning"}>
                {cur.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Başlanğıc</div>
                <div className="mt-0.5 font-medium">{formatDate(cur.baslama)}</div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Bitir</div>
                <div className="mt-0.5 font-medium">{formatDate(cur.bitme)}</div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Qalıq</div>
                <div className={`mt-0.5 font-semibold tabular-nums ${daysLeft <= 3 ? "text-danger" : daysLeft <= 7 ? "text-warning" : "text-foreground"}`}>
                  {daysLeft > 0 ? `${daysLeft} gün` : "Bitib"}
                </div>
              </div>
              {!isTrial && (
                <>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Aylıq qiymət</div>
                    <div className="mt-0.5 font-medium">{formatMoney(Number(cur.abune_planlari?.ayl_q_qiymet ?? 0))}</div>
                  </div>
                </>
              )}
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Aktiv modul</div>
                <div className="mt-0.5 font-medium">{info.modules}</div>
              </div>
            </div>

            {(isTrial || daysLeft <= 7) && (
              <Link
                href="/paketler"
                className="block w-full rounded-md py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                {isTrial ? "Paket seç və ödəniş et" : "Abunəni uzat"}
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {info.history.length > 1 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Abunə tarixçəsi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {info.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <div className="font-medium">{h.abune_planlari?.ad}</div>
                    <div className="text-xs text-muted-foreground">
                      <Calendar className="inline h-3 w-3" /> {formatDate(h.baslama)} → {formatDate(h.bitme)}
                    </div>
                  </div>
                  <Badge variant="outline">{h.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
