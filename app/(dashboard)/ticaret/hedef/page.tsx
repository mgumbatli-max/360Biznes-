import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TrendingDown, CalendarClock, Users, Gauge } from "lucide-react";
import { getSalesTargetDashboard } from "@/features/ticaret/satis-hedef";
import { TicaretSubNav } from "@/components/ticaret-subnav";
import { requireTicaretPerm } from "@/features/ticaret/access-guard";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Satış hədəfi" };

function Bar({ pct, tone }: { pct: number; tone: "good" | "warn" | "bad" | "neutral" }) {
  const w = Math.min(100, Math.max(0, pct));
  const col = tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : tone === "bad" ? "bg-rose-500" : "bg-teal-500";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${col} transition-all`} style={{ width: `${w}%` }} />
    </div>
  );
}

export default async function SatisHedefPage() {
  await requireTicaretPerm("satis.oxu");
  const d = await getSalesTargetDashboard();

  const tempTone = d.status === "onunde" ? "good" : d.status === "geride" ? "warn" : "neutral";
  const proyTone = d.hedef_ay <= 0 ? "neutral" : d.proyeksiya_faiz >= 100 ? "good" : d.proyeksiya_faiz >= 85 ? "warn" : "bad";

  return (
    <div className="space-y-6 p-1">
      <TicaretSubNav active="/ticaret/hedef" />
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Satış hədəfi — bu ay</h1>
          <p className="text-sm text-muted-foreground">Aylıq hədəfə görə icra, tempə uyğunluq, ay-sonu proqnozu və satıcı-üzrə bölgü.</p>
        </div>
      </div>

      {d.hedef_ay <= 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Aylıq satış hədəfi təyin olunmayıb. Ayarlar → Ticarət bölməsindən hədəf təyin edin (yuxarıdakı satış paneli də göstərir).
        </CardContent></Card>
      ) : (
        <>
          {/* Əsas progress */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Faktiki / Hədəf</div>
                  <div className="text-3xl font-bold tabular-nums">{formatMoney(d.faktiki_ay)} <span className="text-lg font-normal text-muted-foreground">/ {formatMoney(d.hedef_ay)}</span></div>
                </div>
                <Badge variant="outline" className={
                  d.status === "onunde" ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"
                }>
                  {d.status === "onunde" ? <TrendingUp className="mr-1 h-3.5 w-3.5" /> : <TrendingDown className="mr-1 h-3.5 w-3.5" />}
                  Tempdən {d.status === "onunde" ? "öndə" : "geridə"} ({d.proportional_faiz}%)
                </Badge>
              </div>
              <div className="mt-4"><Bar pct={d.faiz} tone={d.faiz >= 100 ? "good" : d.status === "onunde" ? "good" : "warn"} /></div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{d.faiz}% tamamlandı</span>
                <span>bu günə görə olmalı: {formatMoney(d.bugune_kimi_hedef)}</span>
              </div>
            </CardContent>
          </Card>

          {/* KPI-lar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="h-4 w-4" /> Ay-sonu proqnozu</div>
              <div className={`mt-1 text-xl font-bold tabular-nums ${proyTone === "good" ? "text-emerald-600" : proyTone === "bad" ? "text-rose-600" : "text-amber-600"}`}>{formatMoney(d.proyeksiya)}</div>
              <div className="text-[11px] text-muted-foreground">hədəfin {d.proyeksiya_faiz}%-i</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-4 w-4" /> Qalan gün</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{d.qalan_gun}</div>
              <div className="text-[11px] text-muted-foreground">{d.bugun_gun}/{d.ay_gun_say} gün keçib</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4" /> Günlük lazım</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{d.gunluk_lazim > 0 ? formatMoney(d.gunluk_lazim) : "—"}</div>
              <div className="text-[11px] text-muted-foreground">hədəfə çatmaq üçün</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" /> Aktiv satıcı</div>
              <div className="mt-1 text-xl font-bold tabular-nums">{formatNumber(d.saticilar.length)}</div>
              <div className="text-[11px] text-muted-foreground">bu ay satışı olan</div>
            </CardContent></Card>
          </div>

          {/* Satıcı bölgü */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Satıcı-üzrə icra</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {d.saticilar.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu ay hələ satıcı satışı yoxdur.</p>
              ) : d.saticilar.map((s) => (
                <div key={s.isci_id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{s.ad}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums font-semibold">{formatMoney(s.faktiki)}</span>
                      <Badge variant="outline" className="text-[11px]">pay {s.pay_faiz}%</Badge>
                      {s.hedef > 0 && <Badge variant="outline" className={s.faiz >= 100 ? "border-emerald-300 text-emerald-700 text-[11px]" : "text-[11px]"}>hədəf {s.faiz}%</Badge>}
                    </div>
                  </div>
                  {s.hedef > 0 && (
                    <div className="mt-2">
                      <Bar pct={s.faiz} tone={s.faiz >= 100 ? "good" : s.faiz >= 60 ? "warn" : "bad"} />
                      <div className="mt-1 text-[11px] text-muted-foreground">{formatMoney(s.faktiki)} / {formatMoney(s.hedef)} · {s.sifaris} sifariş</div>
                    </div>
                  )}
                  {s.hedef === 0 && <div className="mt-1 text-[11px] text-muted-foreground">{s.sifaris} sifariş · fərdi hədəf təyin olunmayıb</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
