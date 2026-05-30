import type { Metadata } from "next";
import Link from "next/link";
import { GitCompare, Crown, TrendingUp, TrendingDown, Receipt, Users, ArrowRight, Trophy, Sigma } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerBranchComparison, getOwnerBranchTrend30 } from "@/features/sahibkar/owner-queries";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { formatMoney, formatNumber } from "@/lib/utils";

function TrendSparkline({ values, color = "var(--brand-from, #6366f1)" }: { values: number[]; color?: string }) {
  if (values.length === 0) return null;
  const max = Math.max(1, ...values);
  const w = 200;
  const h = 40;
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${i * stepX},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const metadata: Metadata = { title: "Filial müqayisəsi" };

export default async function FilialMuqayisePage() {
  await requireSahibkarSession();
  const [rowsRaw, trendMap] = await Promise.all([getOwnerBranchComparison(), getOwnerBranchTrend30()]);
  // Sıralama — bu ayın satışına görə azalan
  const rows = [...rowsRaw].sort((a, b) => b.bu_ay - a.bu_ay);
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.bu_ay, r.kecen_ay]));
  const cemiBu = rows.reduce((s, r) => s + r.bu_ay, 0);
  const cemiKecen = rows.reduce((s, r) => s + r.kecen_ay, 0);
  const cemiSifaris = rows.reduce((s, r) => s + r.sifaris_say, 0);
  const cemiIsci = rows.reduce((s, r) => s + r.isci_say, 0);
  const cemiDelta = cemiKecen > 0 ? ((cemiBu - cemiKecen) / cemiKecen) * 100 : (cemiBu > 0 ? 100 : 0);
  const lider = rows[0];
  const liderPay = cemiBu > 0 && lider ? (lider.bu_ay / cemiBu) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Filial müqayisəsi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bu ay vs keçən ay — satış, sifariş sayı, orta çek, işçi sayı və 30 günlük trend.</p>
      </header>

      <SectionExplainer
        icon={GitCompare}
        tone="sky"
        description="Hər filialın bu ay vs keçən ay göstəricilərini yan-yana görürsən: satış cəmi, sifariş sayı, orta çek, işçi sayı, son 30 gün trendi və şəbəkə payı. Sıralama bu ayın satışına görə azalandır — lider yuxarıda."
        bullets={[
          { label: "Lider", text: lider ? `${lider.ad} (${liderPay.toFixed(0)}% pay)` : "—" },
          { label: "Şəbəkə dəlta", text: `${cemiDelta >= 0 ? "+" : ""}${cemiDelta.toFixed(1)}% (bu ay vs keçən)` },
          { label: "Cəmi sifariş", text: `${formatNumber(cemiSifaris, 0)} (${cemiIsci} işçi)` },
        ]}
      />

      {/* Total strip */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <KpiPill icon={Sigma} label="Şəbəkə cəmi" value={formatMoney(cemiBu)} sub={`${cemiDelta >= 0 ? "+" : ""}${cemiDelta.toFixed(1)}% vs keçən ay`} tone={cemiDelta >= 0 ? "emerald" : "rose"} />
          <KpiPill icon={Receipt} label="Cəmi sifariş" value={formatNumber(cemiSifaris, 0)} sub={`bu ay`} tone="sky" />
          <KpiPill icon={Users} label="Cəmi işçi" value={formatNumber(cemiIsci, 0)} sub={`aktiv`} tone="violet" />
          <KpiPill icon={Trophy} label="Lider filial" value={lider?.ad ?? "—"} sub={`${liderPay.toFixed(0)}% şəbəkə payı`} tone="amber" />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <GitCompare className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Filial yoxdur</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((r, idx) => {
            const delta = r.kecen_ay > 0 ? ((r.bu_ay - r.kecen_ay) / r.kecen_ay) * 100 : (r.bu_ay > 0 ? 100 : 0);
            const sifarisDelta = r.kecen_sifaris_say > 0 ? ((r.sifaris_say - r.kecen_sifaris_say) / r.kecen_sifaris_say) * 100 : (r.sifaris_say > 0 ? 100 : 0);
            const sebPay = cemiBu > 0 ? (r.bu_ay / cemiBu) * 100 : 0;
            const trend = trendMap.get(r.id) ?? [];
            const isLider = idx === 0 && r.bu_ay > 0;
            const isWorst = idx === rows.length - 1 && rows.length > 1 && r.bu_ay >= 0;
            return (
              <Card key={r.id} className={`glass relative overflow-hidden ${isLider ? "border-amber-500/40" : isWorst ? "border-rose-500/20" : ""}`}>
                {isLider && (
                  <div className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <Crown className="h-2.5 w-2.5" /> #1 Lider
                  </div>
                )}
                <CardContent className="space-y-2.5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-secondary text-[10px] font-bold tabular-nums">#{idx + 1}</span>
                        <span className="font-semibold">{r.ad}</span>
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-muted-foreground">{sebPay.toFixed(1)}% şəbəkə payı · {r.isci_say} işçi</div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${delta >= 0 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                      {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                    </Badge>
                  </div>

                  {/* Bu ay / Keçən ay yanaşı bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Bu ay</span>
                      <span className="font-semibold tabular-nums">{formatMoney(r.bu_ay)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full" style={{ background: "var(--brand-gradient)", width: `${(r.bu_ay / maxVal) * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Keçən ay</span>
                      <span className="tabular-nums">{formatMoney(r.kecen_ay)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-muted-foreground/40" style={{ width: `${(r.kecen_ay / maxVal) * 100}%` }} />
                    </div>
                  </div>

                  {/* Sifariş + Orta çek */}
                  <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sifariş</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold tabular-nums">{formatNumber(r.sifaris_say, 0)}</span>
                        <span className={`text-[10px] tabular-nums ${sifarisDelta >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {sifarisDelta >= 0 ? "+" : ""}{sifarisDelta.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Orta çek</div>
                      <div className="font-semibold tabular-nums">{formatMoney(r.orta_cek)}</div>
                    </div>
                  </div>

                  {trend.length > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border/30 pt-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Son 30 gün</span>
                      <TrendSparkline values={trend} color={delta >= 0 ? "#10b981" : "#ef4444"} />
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    <Link href={`/sahibkar/filiallar/${r.id}`} className="inline-flex items-center gap-1 text-[11px] text-primary-light hover:underline">
                      Filial detalı <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiPill({
  icon: Icon, label, value, sub, tone,
}: {
  icon: typeof Sigma; label: string; value: string; sub?: string;
  tone?: "emerald" | "rose" | "sky" | "violet" | "amber";
}) {
  const cls = {
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rose:    "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky:     "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    violet:  "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    amber:   "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[tone ?? "sky"];
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 truncate text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] opacity-70">{sub}</div>}
    </div>
  );
}
