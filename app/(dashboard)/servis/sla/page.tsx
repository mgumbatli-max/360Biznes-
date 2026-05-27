import type { Metadata } from "next";
import Link from "next/link";
import { AlertOctagon, Clock, Users, AlertTriangle } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getSLAOverview } from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS } from "@/features/servis/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Servis SLA" };
export const dynamic = "force-dynamic";

export default async function ServisSLAPage() {
  const data = await getSLAOverview();

  const totalBreach = data.perStatus.reduce((s, r) => s + r.say, 0);
  const teamSize = data.perTech.length;
  const worstTech = data.perTech.slice().sort((a, b) => b.faiz - a.faiz)[0];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <BackButton fallback="/servis" className="mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servis SLA dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vəd tarixini keçmiş, hələ də açıq olan servis qeydləri və texniki performans gecikmə dərəcəsi.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard
          icon={AlertOctagon}
          label="Cəmi SLA pozğunluq"
          value={String(totalBreach)}
          subline="Açıq servislərdən"
          tone={totalBreach > 0 ? "danger" : "success"}
        />
        <KpiCard
          icon={Users}
          label="Təsirlənən texniki sayı"
          value={String(teamSize)}
          subline="Cəmi"
          tone="info"
        />
        <KpiCard
          icon={Clock}
          label="Ən yüksək gecikmə"
          value={`${worstTech?.faiz ?? 0}%`}
          subline={worstTech?.ad_soyad ?? "Hələ yoxdur"}
          tone={(worstTech?.faiz ?? 0) > 30 ? "danger" : "warning"}
        />
      </section>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status üzrə SLA pozğunluq</CardTitle>
        </CardHeader>
        <CardContent>
          {data.perStatus.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              SLA pozğunluğu olan açıq servis yoxdur — əla nəticə.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {data.perStatus.map((s) => {
                const meta = SERVIS_STATUS_LABELS[s.status] ?? { label: s.status, cls: "" };
                return (
                  <Link
                    key={s.status}
                    href={`/servis?status=${s.status}&gecikme=1`}
                    className="rounded-md border border-border/40 bg-card/40 p-3 transition hover:border-rose-400/60"
                  >
                    <Badge variant="outline" className={meta.cls}>
                      {meta.label}
                    </Badge>
                    <div className="mt-1.5 text-xl font-bold tabular-nums text-rose-400">{s.say}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Texniki performans — gecikmə oranı</CardTitle>
        </CardHeader>
        <CardContent>
          {data.perTech.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Texniki tapılmadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Texniki</th>
                    <th className="px-3 py-2.5 text-right">Cəmi servis</th>
                    <th className="px-3 py-2.5 text-right">SLA pozğun</th>
                    <th className="px-3 py-2.5 text-right">Gecikmə faiz</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perTech.map((r, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/40">
                      <td className="px-3 py-2.5 font-medium">{r.ad_soyad}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.cemi}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.gecikme}</td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums ${
                          r.faiz > 30 ? "text-rose-400" : r.faiz > 10 ? "text-amber-300" : "text-emerald-400"
                        }`}
                      >
                        {r.faiz}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-rose-400" /> Ən tez həll lazımdır (top 5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.top5.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Hər şey vaxtında.</p>
          ) : (
            <ul className="divide-y divide-border/30">
              {data.top5.map((r) => {
                const meta = SERVIS_STATUS_LABELS[r.status] ?? { label: r.status, cls: "" };
                return (
                  <li key={r.id}>
                    <Link
                      href={`/servis/${r.id}`}
                      className="flex flex-wrap items-center gap-3 px-3 py-2.5 transition hover:bg-secondary/40"
                    >
                      <div className="font-mono text-sm font-semibold">{r.nomre}</div>
                      <Badge variant="outline" className={meta.cls}>
                        {meta.label}
                      </Badge>
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="truncate">
                          {r.musteri_ad} — <span className="text-muted-foreground">{r.mehsul_ad}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Texniki: {r.texniki ?? "—"} · Vəd: {r.texmini_tehvil ? formatDate(r.texmini_tehvil) : "—"}
                        </div>
                      </div>
                      <Badge variant="outline" className="border-rose-400/40 bg-rose-400/10 text-rose-300">
                        {r.gecikme_gun} gün gecikir
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
