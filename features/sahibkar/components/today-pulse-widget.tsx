import {
  Activity, ShoppingCart, Wallet, Users, ClipboardCheck, RotateCcw,
  TrendingUp, TrendingDown, Minus, Clock, Heart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTodayPulse } from "@/features/sahibkar/today-pulse-queries";
import { formatMoney } from "@/lib/utils";

const STATUS_META: Record<"ela" | "yaxshi" | "orta" | "zeyif" | "kritik", { label: string; cls: string; emoji: string }> = {
  ela:    { label: "Möhtəşəm",  cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", emoji: "🚀" },
  yaxshi: { label: "Yaxşı",     cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20", emoji: "✅" },
  orta:   { label: "Orta",      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", emoji: "⚡" },
  zeyif:  { label: "Zəif",      cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", emoji: "⚠" },
  kritik: { label: "Kritik",    cls: "bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/40", emoji: "🚨" },
};

function trend(cur: number, prev: number): { val: number; pct: number; dir: "up" | "down" | "flat" } {
  if (prev === 0) {
    return { val: cur, pct: cur > 0 ? 100 : 0, dir: cur > 0 ? "up" : "flat" };
  }
  const diff = cur - prev;
  const pct = (diff / Math.abs(prev)) * 100;
  return { val: diff, pct, dir: Math.abs(pct) < 2 ? "flat" : pct > 0 ? "up" : "down" };
}

/**
 * "Bu günün nəbzi" — sahibkar üçün anlıq biznes göstərici.
 * Açan kimi: hansı saat, neçə satış, vs dünən və keçən həftə.
 */
export async function TodayPulseWidget() {
  const p = await getTodayPulse();
  const m = STATUS_META[p.status];
  const dunen = trend(p.satis_mebleg, p.dunen_satis_mebleg);
  const heftelik = trend(p.satis_mebleg, p.keçen_hefte_satis_mebleg);

  // Saatlıq sparkline üçün — 8:00-22:00 aralığı
  const hours = Array.from({ length: 15 }, (_, i) => i + 8);
  const maxAmount = Math.max(1, ...p.saatliq_satis.map((h) => h.mebleg));
  const hourMap = new Map(p.saatliq_satis.map((h) => [h.saat, h]));

  return (
    <Card className={`glass overflow-hidden ${m.cls.split(" ").slice(0, 2).join(" ")}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className={`h-4 w-4 ${p.status === "ela" || p.status === "yaxshi" ? "text-emerald-600 animate-pulse" : p.status === "kritik" ? "text-rose-600 animate-pulse" : "text-amber-600"}`} />
          Bu günün nəbzi
          <Badge variant="outline" className={`ml-auto text-[10px] ${m.cls}`}>
            <span className="mr-1">{m.emoji}</span>
            {m.label}
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          <Clock className="mr-0.5 inline h-2.5 w-2.5" />
          Hazırkı vaxt: <strong className="text-foreground">{p.hour_now}:00</strong> · {p.status_mesaj}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero — bu günün satışı */}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-3xl font-bold tabular-nums">{formatMoney(p.satis_mebleg)}</div>
            <div className="text-[10.5px] text-muted-foreground">
              {p.satis_count} satış · bu gün
            </div>
          </div>
          {/* Trend badge */}
          <div className="flex flex-col items-end gap-1">
            <TrendBadge label="Dünən" value={dunen} />
            <TrendBadge label="Keçən həftə eyni gün" value={heftelik} />
          </div>
        </div>

        {/* 4 mini metrik */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini icon={Wallet} label="Xərc bu gün" value={formatMoney(p.xerc_mebleg)} tone="muted" />
          <Mini icon={Activity} label="Net kassa" value={formatMoney(p.net_kassa)} tone={p.net_kassa >= 0 ? "emerald" : "rose"} />
          <Mini icon={Users} label="Yeni müştəri" value={String(p.yeni_musteri)} tone={p.yeni_musteri > 0 ? "emerald" : "muted"} />
          <Mini icon={ClipboardCheck} label="Tamamlanan tapşırıq" value={`${p.tamamlanan_tapsiriq}/${p.yeni_tapsiriq}`} tone={p.tamamlanan_tapsiriq > 0 ? "emerald" : "muted"} />
        </div>

        {/* Qaytarma (varsa) */}
        {p.qaytarma_count > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px]">
            <RotateCcw className="h-3 w-3 text-amber-600" />
            <span>
              <strong className="text-foreground">{p.qaytarma_count} qaytarma</strong> bu gün ·{" "}
              <strong className="text-foreground tabular-nums">{formatMoney(p.qaytarma_mebleg)}</strong>
            </span>
          </div>
        )}

        {/* Saatlıq sparkline */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Saatlıq satış dəyişkənliyi</span>
            <span className="font-normal normal-case">8:00 → 22:00</span>
          </div>
          <div className="flex h-12 items-end gap-0.5">
            {hours.map((h) => {
              const data = hourMap.get(h);
              const heightPct = data ? Math.max(2, (data.mebleg / maxAmount) * 100) : 2;
              const isPast = h <= p.hour_now;
              const hasSale = !!data && data.count > 0;
              const isCurrent = h === p.hour_now;
              return (
                <div
                  key={h}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                  title={data ? `${h}:00 — ${data.count} satış, ${formatMoney(data.mebleg)}` : `${h}:00 — satış yox`}
                >
                  <div
                    className={`w-full rounded-t transition ${
                      isCurrent
                        ? "bg-emerald-500"
                        : hasSale
                          ? "bg-primary/60"
                          : isPast
                            ? "bg-secondary"
                            : "bg-secondary/40"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[8.5px] text-muted-foreground/60">
            <span>8</span>
            <span>12</span>
            <span>16</span>
            <span>20</span>
            <span>22</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendBadge({ label, value }: { label: string; value: { pct: number; dir: "up" | "down" | "flat" } }) {
  const Icon = value.dir === "up" ? TrendingUp : value.dir === "down" ? TrendingDown : Minus;
  const cls = value.dir === "up"
    ? "text-emerald-600 dark:text-emerald-400"
    : value.dir === "down"
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";
  return (
    <div className="flex items-center gap-1 text-[10.5px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${cls}`}>
        <Icon className="h-2.5 w-2.5" />
        {value.dir === "flat" ? "≈" : value.pct > 0 ? "+" : ""}{value.pct.toFixed(0)}%
      </span>
    </div>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "muted";
}) {
  const cls = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    rose: "text-rose-700 dark:text-rose-400",
    muted: "text-foreground",
  }[tone];
  return (
    <div className="rounded-md border border-border/40 bg-card/40 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
