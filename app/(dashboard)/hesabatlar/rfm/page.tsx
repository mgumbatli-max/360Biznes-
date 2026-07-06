import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, HeartHandshake, Sparkles, UserPlus, AlertTriangle, ShieldAlert, Moon, XCircle, ArrowLeft } from "lucide-react";
import { getCustomerRfmSegments, type RfmSegment } from "@/features/hesabatlar/musteri-queries";
import { requireHesabatPagePerm } from "@/features/hesabatlar/access-guard";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "RFM müştəri seqmentasiyası" };

const SEG_META: Record<RfmSegment, { icon: typeof Trophy; reng: string; bg: string; izah: string }> = {
  champions:   { icon: Trophy,        reng: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200",  izah: "Ən dəyərli: yeni, tez-tez alan, çox xərcləyən" },
  loyal:       { icon: HeartHandshake,reng: "text-teal-700",    bg: "bg-teal-50 border-teal-200",        izah: "Sadiq: müntəzəm alan" },
  potential:   { icon: Sparkles,      reng: "text-sky-700",     bg: "bg-sky-50 border-sky-200",          izah: "Potensial sadiq: yaxınlarda alıb" },
  new:         { icon: UserPlus,      reng: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200",    izah: "Yeni müştəri: ilk alışını edib" },
  at_risk:     { icon: AlertTriangle, reng: "text-amber-700",   bg: "bg-amber-50 border-amber-300",      izah: "Risk altında: əvvəl tez-tez alırdı, indi yatıb" },
  cant_lose:   { icon: ShieldAlert,   reng: "text-rose-700",    bg: "bg-rose-50 border-rose-300",        izah: "İtirmək olmaz: yüksək dəyər, amma yatıb" },
  hibernating: { icon: Moon,          reng: "text-slate-600",   bg: "bg-slate-50 border-slate-200",      izah: "Yatmış: aşağı aktivlik" },
  lost:        { icon: XCircle,       reng: "text-slate-500",   bg: "bg-slate-50 border-slate-200",      izah: "İtirilmiş: çoxdan alış yoxdur" },
};

export default async function RfmReportPage() {
  await requireHesabatPagePerm("musteri.oxu");
  const { customers, summary } = await getCustomerRfmSegments();

  const churnList = customers.filter((c) => c.churn_riski).slice(0, 30);
  const churnGelir = summary.filter((s) => s.churn).reduce((a, s) => a + s.gelir, 0);
  const totalGelir = summary.reduce((a, s) => a + s.gelir, 0);

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <Link href="/hesabatlar/musteri" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RFM müştəri seqmentasiyası</h1>
          <p className="text-sm text-muted-foreground">Recency (son alış) · Frequency (tezlik) · Monetary (xərc) — müştərilər dəyər və risk üzrə seqmentlərə bölünür.</p>
        </div>
      </div>

      {customers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Hələ satış datası yoxdur — RFM üçün ən azı bir tamamlanmış satış lazımdır.</CardContent></Card>
      ) : (
        <>
          {/* Churn xülasə banneri */}
          {churnGelir > 0 && (
            <Card className="border-rose-300 bg-rose-50/60">
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <ShieldAlert className="h-8 w-8 shrink-0 text-rose-600" />
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold text-rose-800">{churnList.length} müştəri churn (itki) riski altındadır</div>
                  <div className="text-sm text-rose-700">Bu müştərilər {formatMoney(churnGelir)} ümumi gəlir gətirib ({totalGelir > 0 ? Math.round((churnGelir / totalGelir) * 100) : 0}% baza gəlirin) — yenidən cəlb üçün ən yüksək prioritet.</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seqment kartları */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.map((s) => {
              const m = SEG_META[s.segment];
              const Icon = m.icon;
              return (
                <Card key={s.segment} className={`border ${m.bg}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Icon className={`h-5 w-5 ${m.reng}`} />
                      {s.churn && <Badge variant="outline" className="border-rose-300 text-rose-600 text-[10px]">churn</Badge>}
                    </div>
                    <div className={`mt-2 text-xl font-bold ${m.reng}`}>{formatNumber(s.say)}</div>
                    <div className="text-xs font-medium text-foreground">{s.ad_az}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{formatMoney(s.gelir)}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Churn əməli siyahı */}
          {churnList.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Yenidən cəlb siyahısı (churn riski)</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">Müştəri</th>
                      <th className="p-3 text-right font-medium">Son alış (gün)</th>
                      <th className="p-3 text-right font-medium">Sifariş</th>
                      <th className="p-3 text-right font-medium">Ümumi xərc</th>
                      <th className="p-3 text-center font-medium">Seqment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churnList.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{c.ad}</td>
                        <td className="p-3 text-right tabular-nums">{formatNumber(c.recency_gun)}</td>
                        <td className="p-3 text-right tabular-nums">{formatNumber(c.frequency)}</td>
                        <td className="p-3 text-right tabular-nums font-semibold">{formatMoney(c.monetary)}</td>
                        <td className="p-3 text-center"><Badge variant="outline" className={SEG_META[c.segment].reng}>{SEG_META[c.segment] && summary.find((s) => s.segment === c.segment)?.ad_az}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* İzah */}
          <Card>
            <CardHeader><CardTitle className="text-base">Seqmentlər nə deməkdir</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(SEG_META) as RfmSegment[]).map((seg) => {
                const m = SEG_META[seg];
                const s = summary.find((x) => x.segment === seg);
                const Icon = m.icon;
                return (
                  <div key={seg} className="flex items-start gap-2 text-sm">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.reng}`} />
                    <div><span className="font-medium">{s?.ad_az ?? seg}</span> — <span className="text-muted-foreground">{m.izah}</span></div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
