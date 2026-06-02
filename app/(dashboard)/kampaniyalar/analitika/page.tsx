import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ChevronLeft, TrendingUp, TrendingDown, Trophy, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCampaignROI } from "@/features/kampaniyalar/queries";
import { TIP_META, type KampaniyaTip } from "@/features/kampaniyalar/types";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Kampaniya analitikası" };

export default async function AnalitikaPage() {
  const rows = await getCampaignROI();

  const totalEndirim = rows.reduce((s, r) => s + r.endirim, 0);
  const totalBonus = rows.reduce((s, r) => s + r.bonus, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const avgRoi = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.roi, 0) / rows.length) : 0;

  // ROI tone
  const roiTone = (roi: number) =>
    roi >= 300 ? "text-emerald-500" :
    roi >= 100 ? "text-amber-500" :
    "text-rose-500";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-violet-500" />
          Kampaniya analitikası
        </h1>
        <p className="text-sm text-muted-foreground">
          Son 30 günün ROI göstəriciləri — hansı kampaniya nə qədər gəlir gətirib, nə qədər xərc çıxdı
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cəm gəlir (30g)</div>
            <div className="text-xl font-bold tabular-nums text-emerald-500">{formatMoney(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Verilən endirim</div>
            <div className="text-xl font-bold tabular-nums text-rose-500">{formatMoney(totalEndirim)}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bonus paylanışı</div>
            <div className="text-xl font-bold tabular-nums text-amber-500">{formatMoney(totalBonus)}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="space-y-1 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Orta ROI</div>
            <div className={cn("text-xl font-bold tabular-nums", roiTone(avgRoi))}>{avgRoi}%</div>
          </CardContent>
        </Card>
      </section>

      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold">Hələ kampaniya istifadəsi yoxdur</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Aktiv kampaniya yaradıb satışa tətbiq olunduqda buradan ROI hesabatları görəcəksiniz.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <header className="border-b border-border/60 px-4 py-2.5">
              <h3 className="text-sm font-bold">Kampaniya səviyyəsində ROI</h3>
              <p className="text-[10.5px] text-muted-foreground">
                ROI = (gəlir / xərc) × 100. 300%+ əla · 100-300% normal · &lt;100% zərərli
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Kampaniya</th>
                    <th className="px-3 py-2 text-right font-medium">İstifadə</th>
                    <th className="px-3 py-2 text-right font-medium">Endirim</th>
                    <th className="px-3 py-2 text-right font-medium">Bonus</th>
                    <th className="px-3 py-2 text-right font-medium">Gəlir</th>
                    <th className="px-3 py-2 text-right font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const tipMeta = TIP_META[r.tip as KampaniyaTip] ?? TIP_META.percent_endirim;
                    return (
                      <tr key={r.id} className="border-b border-border/20 hover:bg-secondary/40">
                        <td className="px-3 py-2">
                          <Link href={`/kampaniyalar/${r.id}`} className="flex items-center gap-2">
                            {idx === 0 && r.roi >= 300 && <Trophy className="h-3.5 w-3.5 text-warning" />}
                            <span className="text-lg">{r.ikon ?? tipMeta.emoji}</span>
                            <div className="min-w-0">
                              <div className="truncate font-medium hover:text-primary">{r.ad}</div>
                              <div className="text-[10px] text-muted-foreground">{tipMeta.ad}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.istifade}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-500">−{formatMoney(r.endirim)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-500">{formatMoney(r.bonus)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-500">{formatMoney(r.revenue)}</td>
                        <td className="px-3 py-2 text-right">
                          <Badge variant="outline" className={cn("tabular-nums font-bold", roiTone(r.roi))}>
                            {r.roi >= 100 ? <TrendingUp className="mr-0.5 inline h-2.5 w-2.5" /> : <TrendingDown className="mr-0.5 inline h-2.5 w-2.5" />}
                            {r.roi}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mr-1 inline h-3 w-3" /> ROI hesabatı haqqında
        </p>
        <p className="mt-1 text-muted-foreground">
          ROI ROUGH estimasiyadır — kampaniyalı satışın <strong className="text-foreground">tam məbləğinə</strong> baxır.
          Daha dəqiq counterfactual üçün (kampaniya olmadan həmin müştəri yenə alacaqdı?) A/B test bölməsi gərəkir.
        </p>
      </div>
    </div>
  );
}
