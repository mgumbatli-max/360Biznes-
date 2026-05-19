import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft, Activity, AlertTriangle, Moon, Calendar, Zap, Trash2, Info, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getSahibkarState } from "@/lib/sahibkar/guard";
import { getAktivlikDashboard } from "@/features/sahibkar/aktivlik-queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Əməkdaş aktivlik nəzarəti" };
export const dynamic = "force-dynamic";

type SP = { days?: string };

export default async function AktivlikPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const state = await getSahibkarState();
  if (state === "needs-setup") redirect("/sahibkar/setup");
  if (state === "needs-verify") redirect("/sahibkar/verify");
  if (state !== "ready") redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const days = Math.min(90, Math.max(1, Number(sp.days) || 7));
  const rows = await getAktivlikDashboard(days);

  const yuksekRisk = rows.filter((r) => r.risk_skoru >= 50).length;
  const ortaRisk = rows.filter((r) => r.risk_skoru >= 25 && r.risk_skoru < 50).length;
  const cemiGece = rows.reduce((s, r) => s + r.gece_aktivlik_say, 0);
  const cemiAsta = rows.reduce((s, r) => s + r.asta_gun_aktivlik_say, 0);
  const cemiEmeliyyat = rows.reduce((s, r) => s + r.toplam_emeliyyat, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/sahibkar"
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Activity className="h-5 w-5 text-violet-500" />
              Əməkdaş aktivlik nəzarəti
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Son {days} gün — kim, nə vaxt, nə etmişdi · anomaliya detektoru
            </p>
          </div>
        </div>
        <form className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Müddət:</label>
          <select name="days" defaultValue={String(days)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {[1, 7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>Son {d} gün</option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-md bg-foreground px-3 text-xs font-bold text-background hover:opacity-90">
            Yenilə
          </button>
        </form>
      </header>

      {/* İzah */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="space-y-1 py-3 text-[11px]">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Info className="h-3.5 w-3.5 text-sky-600" />
            Anomaliya detektoru — necə işləyir
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li><strong className="text-foreground">Gecə aktivliyi:</strong> 22:00-08:00 arası hər əməliyyat → +3 risk (max 30)</li>
            <li><strong className="text-foreground">Həftəsonu:</strong> Şənbə/Bazar hər əməliyyat → +2 risk (max 20)</li>
            <li><strong className="text-foreground">Yüksək temp:</strong> son 24s-də 50+ əməliyyat → +25 risk</li>
            <li><strong className="text-foreground">Çox silmə:</strong> 5-dən çox silmə → +25 risk</li>
            <li>Skor 50+ olanlar <span className="font-semibold text-rose-600">qırmızı banner</span> alır</li>
          </ul>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard icon={User} label="Əməkdaş" value={String(rows.length)} subline="Aktiv izlənir" />
        <KpiCard icon={Activity} label="Cəmi əməliyyat" value={cemiEmeliyyat.toLocaleString("az-AZ")} subline={`Son ${days} gün`} />
        <KpiCard icon={AlertTriangle} label="Yüksək risk" value={String(yuksekRisk)} subline="50+ skor" tone={yuksekRisk > 0 ? "danger" : "neutral"} />
        <KpiCard icon={Moon} label="Gecə əməliyyat" value={String(cemiGece)} subline="22:00-08:00" tone={cemiGece > 0 ? "warning" : "neutral"} />
        <KpiCard icon={Calendar} label="Həftəsonu" value={String(cemiAsta)} subline="Şənbə/Bazar" tone={cemiAsta > 0 ? "warning" : "neutral"} />
      </section>

      {/* Cədvəl */}
      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold">Aktiv əməkdaş yoxdur</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Əməkdaş</th>
                    <th className="px-3 py-2.5 text-right">Cəmi</th>
                    <th className="px-3 py-2.5 text-right">Yarat</th>
                    <th className="px-3 py-2.5 text-right">Yenilə</th>
                    <th className="px-3 py-2.5 text-right">Sil</th>
                    <th className="px-3 py-2.5 text-center" title="Son 24 saat">24s</th>
                    <th className="px-3 py-2.5 text-center" title="Gecə aktivliyi"><Moon className="inline h-3 w-3" /></th>
                    <th className="px-3 py-2.5 text-center" title="Həftəsonu aktivliyi"><Calendar className="inline h-3 w-3" /></th>
                    <th className="px-3 py-2.5 text-center">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {rows.map((r) => {
                    const riskTone =
                      r.risk_skoru >= 50 ? "rose"
                        : r.risk_skoru >= 25 ? "amber"
                          : r.risk_skoru > 0 ? "sky"
                            : "muted";
                    const toneCls: Record<typeof riskTone, string> = {
                      rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
                      amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
                      sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
                      muted: "bg-secondary/30 text-muted-foreground border-border",
                    };
                    return (
                      <tr key={r.istifadeci_id} className={r.risk_skoru >= 50 ? "bg-rose-500/5" : "hover:bg-secondary/20"}>
                        <td className="px-3 py-2.5">
                          <Link href={`/iscilier/${r.istifadeci_id}?tab=audit`} className="font-semibold hover:text-primary">
                            {r.ad_soyad}
                          </Link>
                          <div className="flex flex-wrap items-center gap-1 text-[9.5px] text-muted-foreground">
                            <span>{r.vezife ?? "—"}</span>
                            {r.son_giris && (
                              <span>· Son giriş: {formatDate(r.son_giris)}</span>
                            )}
                          </div>
                          {r.risk_sebebler.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.risk_sebebler.map((s, i) => (
                                <span key={i} className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-700 dark:text-rose-300">
                                  ⚠ {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                          {r.toplam_emeliyyat.toLocaleString("az-AZ")}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums text-emerald-600">
                          {r.yarat || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                          {r.yenile || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                          <span className={r.sil > 5 ? "font-bold text-rose-600" : ""}>
                            {r.sil || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="outline" className={r.son_24s_emeliyyat > 50 ? "text-rose-600 border-rose-500/30 text-[10px]" : "text-[10px]"}>
                            {r.son_24s_emeliyyat || 0}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-bold tabular-nums ${r.gece_aktivlik_say > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                            {r.gece_aktivlik_say || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-bold tabular-nums ${r.asta_gun_aktivlik_say > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {r.asta_gun_aktivlik_say || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className={`mx-auto inline-flex w-12 items-center justify-center rounded-md border px-2 py-1 text-[11px] font-bold tabular-nums ${toneCls[riskTone]}`}>
                            {r.risk_skoru}
                          </div>
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

      {/* Footer izah */}
      <p className="text-[10.5px] text-muted-foreground">
        💡 İstənilən ada klik et — həmin əməkdaşın tam audit-log tarixçəsi açılır. Şübhəli aktivlik
        gördükdə, əməkdaşla danış və ya səbəbi öyrən. Bu sırf monitor — heç kim avtomatik
        cəzalandırılmır.
      </p>
    </div>
  );
}
