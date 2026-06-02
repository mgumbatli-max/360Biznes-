import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles, Trophy, AlertTriangle, TrendingUp } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { getTaskPerformanceAnalytics } from "@/features/tapshiriqlar/queries";
import { aiAnalyzePerformance } from "@/features/tapshiriqlar/ai-actions";
import { BonusCalculator } from "@/features/tapshiriqlar/components/bonus-calculator";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

export const metadata: Metadata = { title: "Tapşırıq AI Analiz" };

export default async function TapshiriqAiAnalizPage() {
  const session = await auth();
  if (!session?.user) return null;

  const icazeler = await getRequestPermissions();
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  const isOwnerOrAdmin =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");
  if (!isOwnerOrAdmin && !icazeler.includes("tapshiriq.ai_analiz")) {
    redirect("/tapshiriqlar");
  }

  const [rows, aiResult] = await Promise.all([
    getTaskPerformanceAnalytics(),
    aiAnalyzePerformance(),
  ]);

  const top = rows[0];
  const worst = rows[rows.length - 1];
  const teamAvgFaiz =
    rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.tamamlanma_faiz, 0) / rows.length) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/tapshiriqlar" className="mt-1" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" /> Tapşırıq AI Analiz
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              İşçilərin tapşırıq performansı, AI insights və KPI bonus hesablanması.
            </p>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Hələ analiz üçün kifayət qədər tapşırıq qeydi yoxdur.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="glass">
              <CardContent className="py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Komanda</div>
                <div className="text-lg font-semibold tabular-nums">{rows.length} işçi</div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Orta tamamlanma</div>
                <div className="text-lg font-semibold tabular-nums text-emerald-600">{teamAvgFaiz}%</div>
              </CardContent>
            </Card>
            {top && (
              <Card className="glass">
                <CardContent className="py-3">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Trophy className="h-3 w-3 text-amber-500" /> Lider
                  </div>
                  <div className="text-lg font-semibold truncate">{top.ad_soyad}</div>
                  <div className="text-[11px] text-muted-foreground">{top.tamamlanma_faiz}%</div>
                </CardContent>
              </Card>
            )}
            {worst && worst !== top && (
              <Card className="glass">
                <CardContent className="py-3">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-rose-500" /> Diqqət
                  </div>
                  <div className="text-lg font-semibold truncate">{worst.ad_soyad}</div>
                  <div className="text-[11px] text-muted-foreground">{worst.tamamlanma_faiz}%</div>
                </CardContent>
              </Card>
            )}
          </section>

          <Card className="glass border-violet-300/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" /> AI insights
                {aiResult.ok && aiResult.is_mock && (
                  <Badge variant="outline" className="text-[10px]">mock-mode</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiResult.ok ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{aiResult.text}</div>
              ) : (
                <p className="text-sm text-danger">{aiResult.error}</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Performans cədvəli
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">İşçi</th>
                      <th className="px-3 py-2.5">Vəzifə</th>
                      <th className="px-3 py-2.5 text-right">Cəmi</th>
                      <th className="px-3 py-2.5 text-right">Tamamlandı</th>
                      <th className="px-3 py-2.5 text-right">İcradadır</th>
                      <th className="px-3 py-2.5 text-right">Gecikmiş</th>
                      <th className="px-3 py-2.5 text-right">Tamamlanma %</th>
                      <th className="px-3 py-2.5 text-right">Ortalama gün</th>
                      <th className="px-3 py-2.5 text-right">Son 30 gün</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.istifadeci_id} className="border-b border-border/30 hover:bg-secondary/30">
                        <td className="px-3 py-2 font-medium">{r.ad_soyad}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.vezife ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.cemi}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{r.tamamlandi}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.icrada}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600">{r.gecikmis}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <Badge
                            variant="outline"
                            className={
                              r.tamamlanma_faiz >= 80
                                ? "border-emerald-300/60 text-emerald-700"
                                : r.tamamlanma_faiz >= 50
                                ? "border-amber-300/60 text-amber-700"
                                : "border-rose-300/60 text-rose-700"
                            }
                          >
                            {r.tamamlanma_faiz}%
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{r.orta_bitme_gun || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.son_30_gun}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <BonusCalculator />
        </>
      )}
    </div>
  );
}
