import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, TrendingUp, TrendingDown, Minus, AlertTriangle, HelpCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import type { KpiDashboardRow, SortKey, SortDir } from "@/features/iscilier/kpi-dashboard-queries";

type Tone = "emerald" | "amber" | "rose" | "muted";

function toneFromHigh(pct: number): Tone {
  if (pct >= 90) return "emerald";
  if (pct >= 70) return "amber";
  if (pct > 0) return "rose";
  return "muted";
}
function toneFromLow(pct: number): Tone {
  if (pct === 0) return "emerald";
  if (pct < 10) return "amber";
  return "rose";
}

const TONE_CLS: Record<Tone, { text: string; bg: string; bar: string }> = {
  emerald: { text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
  amber:   { text: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-500/10",   bar: "bg-amber-500" },
  rose:    { text: "text-rose-700 dark:text-rose-400",       bg: "bg-rose-500/10",    bar: "bg-rose-500" },
  muted:   { text: "text-muted-foreground",                  bg: "bg-secondary/40",   bar: "bg-secondary" },
};

const MEDALS = ["🥇", "🥈", "🥉"];

const COLUMN_HINTS: Record<string, string> = {
  emekdas: "Əməkdaşın adı və avatarı. Klikləsən onun fərdi bonus paneli açılır.",
  vezife: "Əməkdaşın vəzifəsi (məs. kassir, mühasib) və sistem rolu.",
  maas: "Aylıq sabit maaş ₼. Bonus və cəriməyə daxil deyil.",
  bonus: "Bu ay qazanılan KPI bonus. Mini progress bar pool-dan neçə faiz qazandığını göstərir.",
  cerime: "Bu ay tətbiq olunan cərimə cəmi. 0 olarsa boş görünür.",
  net: "Maaş + Bonus − Cərimə. Bu əməkdaşa bu ay ödəniləcək ümumi məbləğ.",
  davamiyyet: "İş günlərində qaydasında olduğu gün faizi. ≥90% yaşıl, 70-89% sarı, <70% qırmızı. Trend ▲▼ keçən aydan dəyişiklik göstərir.",
  tapsiriq: "Vaxtında bitirilən tapşırıq faizi. Deadline-dan əvvəl tamamlanan tapşırıqlar nəzərə alınır.",
  sehv: "Təsdiq mərkəzində rədd edilmiş sorğu faizi. TƏRS göstərici — 0% yaşıl (yaxşı), çoxalan qırmızı.",
  satis: "Bu ay yaratdığı satış məbləği və sifariş sayı. Qaralama və ləğv olunmuş satışlar daxil deyil.",
  performans: "0-100 ümumi performans skoru: Bonus 30% + Davamiyyət 25% + Tapşırıq 25% + (100 − Səhv) 20%. ≥85 top performer.",
};

export function KpiDashboardTable({
  rows,
  buildSortHref,
  currentSort,
  currentDir,
}: {
  rows: KpiDashboardRow[];
  buildSortHref: (sortBy: SortKey) => string;
  currentSort: SortKey;
  currentDir: SortDir;
}) {
  if (rows.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Heç bir nəticə tapılmadı.</p>
        </CardContent>
      </Card>
    );
  }

  // Top 3 (performans), Bottom — diqqət lazım (performans < 50)
  const sortedByPerf = [...rows].sort((a, b) => b.performans_skoru - a.performans_skoru);
  const topIds = new Map(sortedByPerf.slice(0, 3).map((r, i) => [r.istifadeci_id, i]));

  return (
    <Card className="glass overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-secondary/40 px-3 py-2.5 text-center">#</th>
                <Th label="Əməkdaş" hint={COLUMN_HINTS.emekdas} sortKey="ad" align="left" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} sticky />
                <Th label="Vəzifə" hint={COLUMN_HINTS.vezife} sortKey="vezife" align="left" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Maaş" hint={COLUMN_HINTS.maas} sortKey="maas" align="right" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Bonus (KPI)" hint={COLUMN_HINTS.bonus} sortKey="bonus" align="right" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Cərimə" hint={COLUMN_HINTS.cerime} sortKey="cerime" align="right" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Net" hint={COLUMN_HINTS.net} sortKey="net" align="right" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Davamiyyət" hint={COLUMN_HINTS.davamiyyet} sortKey="davamiyyet" align="center" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Tapşırıq" hint={COLUMN_HINTS.tapsiriq} sortKey="tapsiriq" align="center" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Səhv" hint={COLUMN_HINTS.sehv} sortKey="sehv" align="center" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Satış" hint={COLUMN_HINTS.satis} sortKey="satis" align="right" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
                <Th label="Skor" hint={COLUMN_HINTS.performans} sortKey="performans" align="center" current={currentSort} dir={currentDir} hrefBuilder={buildSortHref} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((r, idx) => {
                const initials = r.ad_soyad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
                const medal = topIds.get(r.istifadeci_id);
                const isDiqqet = r.performans_skoru < 50;
                const davTone = toneFromHigh(r.davamiyyet_faiz);
                const tapsTone = toneFromHigh(r.tapsiriq_faiz);
                const sehvTone = toneFromLow(r.sehv_faiz);
                const bonusPct = r.bonus_pool > 0 ? (r.bonus_qazanilan / r.bonus_pool) * 100 : 0;
                const bonusTone: Tone =
                  r.bonus_pool === 0 ? "muted" : bonusPct >= 80 ? "emerald" : bonusPct >= 50 ? "amber" : "rose";
                const perfTone =
                  r.performans_skoru >= 85 ? "emerald" : r.performans_skoru >= 60 ? "amber" : "rose";

                return (
                  <tr key={r.istifadeci_id} className={`hover:bg-secondary/20 ${isDiqqet ? "bg-rose-500/5" : ""}`}>
                    {/* Medal / # */}
                    <td className="sticky left-0 z-10 bg-card px-3 py-2.5 text-center">
                      {medal !== undefined ? (
                        <span className="text-base" title={`Top ${medal + 1}`}>{MEDALS[medal]}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{idx + 1}</span>
                      )}
                    </td>

                    {/* Əməkdaş */}
                    <td className="sticky left-10 z-10 bg-card px-3 py-2.5">
                      <Link
                        href={`/iscilier/${r.istifadeci_id}?tab=bonus`}
                        className="flex items-center gap-2 hover:text-primary"
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          {r.profil_sekil && <AvatarImage src={r.profil_sekil} alt={r.ad_soyad} />}
                          <AvatarFallback className="bg-secondary text-[10px] font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">{r.ad_soyad}</div>
                          {isDiqqet && (
                            <div className="inline-flex items-center gap-0.5 text-[9px] text-rose-600">
                              <AlertTriangle className="h-2 w-2" />
                              Diqqət
                            </div>
                          )}
                        </div>
                      </Link>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="text-xs">{r.vezife ?? "—"}</div>
                      {r.rol_ad && <div className="text-[9.5px] text-muted-foreground">{r.rol_ad}</div>}
                    </td>

                    <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums">
                      {formatMoney(r.aylik_maas)}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <BonusCell qazanilan={r.bonus_qazanilan} pool={r.bonus_pool} tone={bonusTone} />
                    </td>

                    <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums">
                      <span className={r.cerime_toplam > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}>
                        {r.cerime_toplam > 0 ? `−${formatMoney(r.cerime_toplam)}` : "—"}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums">
                      {formatMoney(r.net_maas)}
                    </td>

                    <td className="px-3 py-2.5">
                      <FaizCell value={r.davamiyyet_faiz} tone={davTone} trend={r.trend_davamiyyet} />
                    </td>
                    <td className="px-3 py-2.5">
                      <FaizCell value={r.tapsiriq_faiz} tone={tapsTone} trend={r.trend_tapsiriq} />
                    </td>
                    <td className="px-3 py-2.5">
                      <FaizCell value={r.sehv_faiz} tone={sehvTone} reverse />
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <div className="text-xs font-medium tabular-nums">{formatMoney(r.satis_meblegh)}</div>
                      <div className="flex items-center justify-end gap-1 text-[9.5px] text-muted-foreground">
                        {r.satis_sayi} sifariş
                        {r.trend_satis !== null && r.trend_satis !== 0 && (
                          <TrendBadge value={r.trend_satis} type="mebleg" compact />
                        )}
                      </div>
                    </td>

                    {/* Performans skoru */}
                    <td className="px-3 py-2.5">
                      <div className={`mx-auto grid h-9 w-12 place-items-center rounded-md font-bold tabular-nums ${TONE_CLS[perfTone].bg} ${TONE_CLS[perfTone].text}`}>
                        {r.performans_skoru}
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
  );
}

function Th({
  label,
  hint,
  sortKey,
  align,
  current,
  dir,
  hrefBuilder,
  sticky = false,
}: {
  label: string;
  hint: string;
  sortKey: SortKey;
  align: "left" | "right" | "center";
  current: SortKey;
  dir: SortDir;
  hrefBuilder: (k: SortKey) => string;
  sticky?: boolean;
}) {
  const isActive = current === sortKey;
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const SortIcon = !isActive ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-3 py-2.5 ${alignCls} ${sticky ? "sticky left-10 z-10 bg-secondary/40" : ""}`}>
      <Link
        href={hrefBuilder(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${isActive ? "text-foreground" : ""}`}
        title={hint}
      >
        <span>{label}</span>
        <HelpCircle className="h-2.5 w-2.5 opacity-40" />
        <SortIcon className={`h-2.5 w-2.5 ${isActive ? "text-primary" : "opacity-50"}`} />
      </Link>
    </th>
  );
}

function BonusCell({ qazanilan, pool, tone }: { qazanilan: number; pool: number; tone: Tone }) {
  const cls = TONE_CLS[tone];
  if (pool === 0 && qazanilan === 0) {
    return <span className="text-[10.5px] text-muted-foreground italic">profil yox</span>;
  }
  const pct = pool > 0 ? Math.min(100, Math.round((qazanilan / pool) * 100)) : 0;
  return (
    <div className="space-y-0.5 text-right">
      <div className={`text-xs font-bold tabular-nums ${cls.text}`}>
        {formatMoney(qazanilan)}
      </div>
      {pool > 0 && (
        <div className="flex items-center justify-end gap-1">
          <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary/60">
            <div className={`h-full ${cls.bar} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[9px] tabular-nums text-muted-foreground">{pct}%</span>
        </div>
      )}
      {pool > 0 && (
        <div className="text-[9px] text-muted-foreground">/ {formatMoney(pool)}</div>
      )}
    </div>
  );
}

function FaizCell({
  value,
  tone,
  reverse = false,
  trend,
}: {
  value: number;
  tone: Tone;
  reverse?: boolean;
  trend?: number | null;
}) {
  const cls = TONE_CLS[tone];
  const pct = Math.min(100, Math.round(value));
  return (
    <div className="flex items-center justify-center gap-1.5">
      <div className="space-y-0.5">
        <div className={`grid h-7 w-12 place-items-center rounded ${cls.bg}`} title={reverse ? "Aşağı yaxşıdır" : "Yuxarı yaxşıdır"}>
          <span className={`text-[11px] font-bold tabular-nums ${cls.text}`}>
            {value.toFixed(0)}%
          </span>
        </div>
        {trend != null && Math.abs(trend) >= 0.5 && (
          <TrendBadge value={trend} type="faiz" compact />
        )}
      </div>
      <div className="h-1 max-w-[40px] flex-1 overflow-hidden rounded-full bg-secondary/60">
        <div className={`h-full ${cls.bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrendBadge({ value, type, compact = false }: { value: number; type: "mebleg" | "faiz"; compact?: boolean }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
        <Minus className="h-2 w-2" />
        {!compact && "dəyişməyib"}
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const cls = up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const display = type === "mebleg" ? formatMoney(Math.abs(value)) : `${Math.abs(value).toFixed(1)}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] tabular-nums ${cls}`} title={up ? "Keçən aydan artıb" : "Keçən aydan azalıb"}>
      <Icon className="h-2 w-2" />
      {up ? "+" : "−"}{display}
    </span>
  );
}
