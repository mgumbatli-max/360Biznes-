import type { Metadata } from "next";
import { Target, TrendingUp, Calendar } from "lucide-react";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getMonthlyTarget,
  getTargetProgress,
  setMonthlyTarget,
} from "@/features/ticaret/satis-hedef";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Satış hədəfi" };
export const dynamic = "force-dynamic";

async function saveTarget(formData: FormData) {
  "use server";
  const schema = z.object({ aylik: z.coerce.number().min(0).max(99_999_999) });
  const parsed = schema.safeParse({ aylik: formData.get("aylik") });
  if (!parsed.success) return;
  await setMonthlyTarget(parsed.data.aylik);
  revalidatePath("/ayarlar/satis-hedef");
  revalidatePath("/ticaret");
  revalidatePath("/dashboard");
}

export default async function SatisHedefPage() {
  const [current, progress] = await Promise.all([getMonthlyTarget(), getTargetProgress()]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Satış hədəfi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aylık satış hədəfi. Dashboard widget-i bu hədəfə görə irəliləmə göstərir.
        </p>
      </header>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Aylık hədəf
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveTarget} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Aylık hədəf (AZN)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                name="aylik"
                defaultValue={current || ""}
                placeholder="məs. 100000"
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <Button type="submit" size="sm" className="font-semibold">
              Yadda saxla
            </Button>
          </form>
          {current > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Cari hədəf: <strong>{formatMoney(current)}</strong> / ay
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-success" />
            Bu ay irəliləmə
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress.hedef_ay <= 0 ? (
            <p className="text-sm text-muted-foreground">Hədəf təyin edilməyib.</p>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Satılıb</span>
                  <span className="font-semibold tabular-nums">{formatMoney(progress.satis_ay)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Hədəf</span>
                  <span className="font-semibold tabular-nums">{formatMoney(progress.hedef_ay)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bu günə qədər gözlənən</span>
                  <span className="tabular-nums">{formatMoney(progress.bugune_kimi_hedef)}</span>
                </div>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${Math.min(100, progress.faiz)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Gün {progress.bugun_gun}/{progress.ay_gun_say}
                </span>
                <span>
                  <strong className="text-foreground">{formatNumber(progress.faiz)}%</strong> hədəf ·{" "}
                  <strong
                    className={
                      progress.proportional_faiz >= 100 ? "text-success" : "text-warning"
                    }
                  >
                    {formatNumber(progress.proportional_faiz)}%
                  </strong>{" "}
                  qrafik
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
