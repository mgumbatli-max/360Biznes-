import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Star, Eye, AlertTriangle, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { getSupplierScorecard, type SupplierSegment, type SupplierGrade } from "@/features/hesabatlar/techizatci-scorecard";
import { requireHesabatPagePerm } from "@/features/hesabatlar/access-guard";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Təchizatçı scorecard" };

const SEG: Record<SupplierSegment, { ad: string; reng: string; bg: string; icon: typeof Star }> = {
  strateji:     { ad: "Strateji",       reng: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: Star },
  etibarli:     { ad: "Etibarlı",       reng: "text-teal-700",    bg: "bg-teal-50 border-teal-200",       icon: Truck },
  izle:         { ad: "İzlə",           reng: "text-amber-700",   bg: "bg-amber-50 border-amber-300",     icon: Eye },
  gozden_kecir: { ad: "Gözdən keçir",   reng: "text-rose-700",    bg: "bg-rose-50 border-rose-300",       icon: AlertTriangle },
};
const GRADE_COLOR: Record<SupplierGrade, string> = { A: "text-emerald-600", B: "text-teal-600", C: "text-amber-600", D: "text-orange-600", F: "text-rose-600" };

export default async function TechizatciScorecardPage() {
  await requireHesabatPagePerm("hesabat.view");
  const { suppliers, ozet } = await getSupplierScorecard();

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <Link href="/hesabatlar/idxal" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Təchizatçı scorecard</h1>
          <p className="text-sm text-muted-foreground">Son 12 ay: təchizatçılar xərc, qaytarma-dərəcəsi, qiymət-trendi və etibarlılıq üzrə qiymətləndirilir (A–F) — kimi saxla, kimi yenidən danış.</p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Son 12 ayda alış olan təchizatçı yoxdur.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ümumi alış</div><div className="mt-1 text-xl font-bold tabular-nums">{formatMoney(ozet.umumi_xerc)}</div><div className="text-[11px] text-muted-foreground">{ozet.say} təchizatçı</div></CardContent></Card>
            <Card className="border-emerald-200 bg-emerald-50/50"><CardContent className="p-4"><div className="flex items-center gap-1.5 text-xs text-emerald-700"><Star className="h-4 w-4" /> Strateji</div><div className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">{formatNumber(ozet.strateji)}</div></CardContent></Card>
            <Card className="border-amber-200 bg-amber-50/50"><CardContent className="p-4"><div className="flex items-center gap-1.5 text-xs text-amber-700"><Eye className="h-4 w-4" /> İzlə</div><div className="mt-1 text-xl font-bold text-amber-700 tabular-nums">{formatNumber(ozet.izle)}</div></CardContent></Card>
            <Card className={ozet.gozden_kecir > 0 ? "border-rose-200 bg-rose-50/50" : ""}><CardContent className="p-4"><div className="flex items-center gap-1.5 text-xs text-rose-700"><AlertTriangle className="h-4 w-4" /> Gözdən keçir</div><div className="mt-1 text-xl font-bold text-rose-700 tabular-nums">{formatNumber(ozet.gozden_kecir)}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Təchizatçılar (bala görə)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left font-medium">Təchizatçı</th>
                    <th className="p-3 text-center font-medium">Qiymət</th>
                    <th className="p-3 text-right font-medium">Alış (12 ay)</th>
                    <th className="p-3 text-right font-medium">Sifariş</th>
                    <th className="p-3 text-right font-medium">Qaytarma</th>
                    <th className="p-3 text-right font-medium">Qiymət trendi</th>
                    <th className="p-3 text-right font-medium">Borc</th>
                    <th className="p-3 text-center font-medium">Seqment</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => {
                    const seg = SEG[s.segment];
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{s.ad}{s.sirket ? <span className="ml-1 text-xs text-muted-foreground">({s.sirket})</span> : null}</td>
                        <td className={`p-3 text-center font-bold ${GRADE_COLOR[s.qiymet_novu]}`}>{s.qiymet_novu}<span className="ml-1 text-[10px] font-normal text-muted-foreground">{s.bal}</span></td>
                        <td className="p-3 text-right tabular-nums font-semibold">{formatMoney(s.xerc)}</td>
                        <td className="p-3 text-right tabular-nums">{formatNumber(s.sifaris)}</td>
                        <td className={`p-3 text-right tabular-nums ${s.qaytarma_faiz >= 5 ? "text-rose-600 font-medium" : ""}`}>{s.qaytarma_faiz}%</td>
                        <td className="p-3 text-right tabular-nums">
                          {s.qiymet_trend_faiz === 0 ? <span className="text-muted-foreground">—</span> : (
                            <span className={s.qiymet_trend_faiz > 0 ? "text-rose-600" : "text-emerald-600"}>
                              {s.qiymet_trend_faiz > 0 ? <TrendingUp className="mr-0.5 inline h-3 w-3" /> : <TrendingDown className="mr-0.5 inline h-3 w-3" />}
                              {s.qiymet_trend_faiz > 0 ? "+" : ""}{s.qiymet_trend_faiz}%
                            </span>
                          )}
                        </td>
                        <td className={`p-3 text-right tabular-nums ${s.borc > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{formatMoney(s.borc)}</td>
                        <td className="p-3 text-center"><Badge variant="outline" className={`${seg.reng} text-[11px]`}>{seg.ad}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Seqmentlər</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2"><Star className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><b>Strateji</b> — <span className="text-muted-foreground">yüksək alış, təmiz, sabit qiymət. Əlaqəni gücləndir.</span></div></div>
              <div className="flex items-start gap-2"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /><div><b>Etibarlı</b> — <span className="text-muted-foreground">stabil, problemsiz təchizatçı.</span></div></div>
              <div className="flex items-start gap-2"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><b>İzlə</b> — <span className="text-muted-foreground">qiymət artır və ya qaytarma çoxalır — diqqət et.</span></div></div>
              <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /><div><b>Gözdən keçir</b> — <span className="text-muted-foreground">yüksək qaytarma və ya çoxdan alış yox — yenidən danış / dəyiş.</span></div></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
