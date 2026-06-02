"use client";

import { useState, useMemo } from "react";
import {
  Calculator,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  PiggyBank,
  Percent,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatMoney, cn } from "@/lib/utils";

/**
 * Qiymət simulator — sahibkar endirim slider hərəkət etdirir, real-time:
 *  - Endirimli qiymət
 *  - Yeni marja %
 *  - Vahid mənfəət
 *  - 10/50/100 vahidlik mənfəət proyeksiyası
 *  - Min satış qiyməti xəbərdarlığı (aşağı düşsə)
 *
 * "Bu məhsulu 25% endirimlə satsam yenə də sərfəli olur?" sualına cavab.
 */

export function PriceSimulator({
  ad,
  satis_qiymeti,
  alish_qiymeti,
  min_satis_qiymeti,
  topdan_qiymeti,
  partnyor_qiymeti,
  vip_qiymeti,
}: {
  ad: string;
  satis_qiymeti: number;
  alish_qiymeti: number;
  min_satis_qiymeti: number | null;
  topdan_qiymeti?: number | null;
  partnyor_qiymeti?: number | null;
  vip_qiymeti?: number | null;
}) {
  const [discountPct, setDiscountPct] = useState(0);
  const [proyektQty, setProyektQty] = useState<number>(10);

  const result = useMemo(() => {
    const baseSale = satis_qiymeti || 0;
    const cost = alish_qiymeti || 0;
    const minSale = min_satis_qiymeti ?? 0;

    const discountedPrice = baseSale * (1 - discountPct / 100);
    const unitProfit = discountedPrice - cost;
    const marginPct = discountedPrice > 0 ? (unitProfit / discountedPrice) * 100 : 0;
    const baseMarginPct = baseSale > 0 ? ((baseSale - cost) / baseSale) * 100 : 0;
    const marginDelta = marginPct - baseMarginPct;

    const belowCost = discountedPrice < cost;
    const belowMin = minSale > 0 && discountedPrice < minSale;
    const totalProfit = unitProfit * proyektQty;
    const totalRevenue = discountedPrice * proyektQty;

    return {
      discountedPrice,
      unitProfit,
      marginPct,
      baseMarginPct,
      marginDelta,
      belowCost,
      belowMin,
      totalProfit,
      totalRevenue,
      minSale,
    };
  }, [satis_qiymeti, alish_qiymeti, min_satis_qiymeti, discountPct, proyektQty]);

  // Qiymət növləri ilə müqayisə — slider hansı tier-ə uyğun gəlir?
  const tierComparison = useMemo(() => {
    const tiers = [
      { kod: "satis", label: "Pərakəndə", value: satis_qiymeti },
      { kod: "topdan", label: "Topdan", value: topdan_qiymeti ?? 0 },
      { kod: "partnyor", label: "Partnyor", value: partnyor_qiymeti ?? 0 },
      { kod: "vip", label: "VIP", value: vip_qiymeti ?? 0 },
    ]
      .filter((t) => t.value > 0)
      .sort((a, b) => b.value - a.value);

    // Cari endirimli qiymət hansı tier-ə yaxındır?
    const closest = tiers.find((t) => result.discountedPrice >= t.value)
      ?? tiers[tiers.length - 1];
    return { tiers, closest };
  }, [satis_qiymeti, topdan_qiymeti, partnyor_qiymeti, vip_qiymeti, result.discountedPrice]);

  // Quick presets
  const PRESETS = [0, 5, 10, 15, 20, 25, 30, 40, 50];

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          Qiymət simulator
          <Badge variant="outline" className="ml-auto text-[10px]">canlı hesablama</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slider + preset */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Endirim %</span>
            <span className="text-2xl font-bold tabular-nums text-primary">{discountPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={discountPct}
            onChange={(e) => setDiscountPct(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex flex-wrap items-center gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDiscountPct(p)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition",
                  discountPct === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary",
                )}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Xəbərdarlıqlar */}
        {result.belowCost && (
          <div className="flex items-start gap-2 rounded-md border-2 border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <div className="font-bold text-rose-700">🚨 Maya altı satış</div>
              <div className="mt-0.5 text-rose-600/90">
                Endirimli qiymət ({formatMoney(result.discountedPrice)}) mayadan ({formatMoney(alish_qiymeti)}) aşağıdır.
                Hər vahidlə {formatMoney(Math.abs(result.unitProfit))} ZƏRƏR edirsən.
              </div>
            </div>
          </div>
        )}
        {!result.belowCost && result.belowMin && (
          <div className="flex items-start gap-2 rounded-md border-2 border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <div className="font-bold text-amber-700">⚠ Minimum satış qiyməti aşıldı</div>
              <div className="mt-0.5 text-amber-600/90">
                Endirimli qiymət ({formatMoney(result.discountedPrice)}) min satış qiymətindən ({formatMoney(result.minSale)}) aşağıdır.
                Adətən bu məhsulu bu qiymətə satmamağa qərar verirsən.
              </div>
            </div>
          </div>
        )}

        {/* Nəticə KPI grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Result
            label="Endirimli qiymət"
            value={formatMoney(result.discountedPrice)}
            sub={`Əsas: ${formatMoney(satis_qiymeti)}`}
            tone={result.belowCost ? "danger" : result.belowMin ? "warning" : "neutral"}
            icon={Percent}
          />
          <Result
            label="Vahid mənfəət"
            value={formatMoney(result.unitProfit)}
            sub={`Maya: ${formatMoney(alish_qiymeti)}`}
            tone={result.unitProfit > 0 ? "success" : "danger"}
            icon={result.unitProfit > 0 ? TrendingUp : TrendingDown}
          />
          <Result
            label="Brüt marja"
            value={`${result.marginPct.toFixed(1)}%`}
            sub={
              result.marginDelta < 0
                ? `${result.marginDelta.toFixed(1)}% (əvvəl ${result.baseMarginPct.toFixed(1)}%)`
                : "təsirsiz"
            }
            tone={
              result.marginPct < 0 ? "danger" :
              result.marginPct < 10 ? "warning" :
              result.marginPct < 30 ? "info" :
              "success"
            }
            icon={PiggyBank}
          />
        </div>

        {/* Tier müqayisə */}
        {tierComparison.tiers.length > 1 && (
          <div className="rounded-md border border-border/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Qiymət tier müqayisəsi</span>
              <span>endirimli qiymət ≈ <strong className="text-foreground">{tierComparison.closest?.label ?? "—"}</strong> səviyyəsində</span>
            </div>
            <div className="space-y-1">
              {tierComparison.tiers.map((t) => {
                const isCurrent = t.value === satis_qiymeti && discountPct === 0;
                const isMatched = tierComparison.closest?.kod === t.kod;
                return (
                  <div key={t.kod} className="flex items-center gap-2 text-xs">
                    <span className="min-w-[80px] text-muted-foreground">{t.label}</span>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            isMatched ? "bg-primary" : "bg-muted-foreground/40",
                          )}
                          style={{
                            width: `${(t.value / satis_qiymeti) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className={cn("font-mono tabular-nums", isMatched && "font-bold text-primary")}>
                      {formatMoney(t.value)}
                    </span>
                    {isCurrent && <Badge variant="outline" className="text-[9px]">əsas</Badge>}
                  </div>
                );
              })}
              <div className="mt-2 flex items-center gap-2 border-t border-border/40 pt-2 text-xs">
                <span className="min-w-[80px] font-semibold">Endirimli</span>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-1.5 rounded-full",
                        result.belowCost ? "bg-rose-500" : "bg-amber-500",
                      )}
                      style={{ width: `${(result.discountedPrice / satis_qiymeti) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono tabular-nums font-bold">{formatMoney(result.discountedPrice)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Proyeksiya */}
        <div className="rounded-md border border-border/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            <Calculator className="h-3 w-3" /> N vahidlik proyeksiya
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="qty" className="text-[10px] text-muted-foreground">Miqdar</label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={proyektQty}
                onChange={(e) => setProyektQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 w-24 text-center font-mono"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {[10, 50, 100, 500].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setProyektQty(q)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10.5px] font-medium",
                    proyektQty === q ? "border-primary bg-primary/10" : "border-border bg-secondary/30",
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ProjectionStat label="Cəmi dövriyyə" value={formatMoney(result.totalRevenue)} tone="info" />
            <ProjectionStat label="Cəmi maya" value={formatMoney(alish_qiymeti * proyektQty)} tone="neutral" />
            <ProjectionStat
              label="Cəmi mənfəət"
              value={formatMoney(result.totalProfit)}
              tone={result.totalProfit >= 0 ? "success" : "danger"}
            />
          </div>
        </div>

        {/* Tövsiyə */}
        {discountPct > 0 && (
          <div className={cn(
            "rounded-md border px-3 py-2 text-xs",
            result.belowCost && "border-rose-500/40 bg-rose-500/5 text-rose-700",
            !result.belowCost && result.belowMin && "border-amber-500/40 bg-amber-500/5 text-amber-700",
            !result.belowCost && !result.belowMin && result.marginPct < 10 && "border-amber-500/40 bg-amber-500/5 text-amber-700",
            !result.belowCost && !result.belowMin && result.marginPct >= 10 && result.marginPct < 25 && "border-sky-500/40 bg-sky-500/5 text-sky-700",
            !result.belowCost && !result.belowMin && result.marginPct >= 25 && "border-emerald-500/40 bg-emerald-500/5 text-emerald-700",
          )}>
            <strong className="font-bold">Tövsiyə:</strong>{" "}
            {result.belowCost
              ? "Bu endirimi tətbiq etmə — hər satış zərər gətirir. Maksimum endirim mayanı çıxsın."
              : result.belowMin
                ? `Min satış qiymətinə çatmaq üçün maksimum ${(((satis_qiymeti - result.minSale) / satis_qiymeti) * 100).toFixed(0)}% endirim ver.`
                : result.marginPct < 10
                  ? "Marja çox aşağıdır (10%-dən az). Bu endirim yalnız stok təmizləmə üçün məntiqlidir."
                  : result.marginPct < 25
                    ? "Marja orta səviyyədə. Kampaniya üçün uyğundur, daimi olaraq deyil."
                    : `Yaxşı endirim! Marja sağlam (${result.marginPct.toFixed(1)}%) və satış həcmini artıra bilər.`}
          </div>
        )}

        <p className="text-[10.5px] text-muted-foreground">
          ℹ️ POS-da bu endirimi tətbiq etmək üçün məhsulu satışa əlavə et və Endirim sahəsində {discountPct}% daxil et,
          yaxud /ayarlar/risk-qayda-də endirim həddlərini konfiqurasiya et.
        </p>
      </CardContent>
    </Card>
  );
}

function Result({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneCls =
    tone === "success" ? "border-emerald-500/40 bg-emerald-500/5" :
    tone === "warning" ? "border-amber-500/40 bg-amber-500/5" :
    tone === "danger" ? "border-rose-500/40 bg-rose-500/5" :
    tone === "info" ? "border-sky-500/40 bg-sky-500/5" :
    "border-border/40 bg-card/40";
  const iconCls =
    tone === "success" ? "text-emerald-600" :
    tone === "warning" ? "text-amber-600" :
    tone === "danger" ? "text-rose-600" :
    tone === "info" ? "text-sky-600" :
    "text-muted-foreground";
  return (
    <div className={cn("rounded-lg border px-3 py-2", toneCls)}>
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3 w-3", iconCls)} /> {label}
      </div>
      <div className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function ProjectionStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "danger" | "info";
}) {
  const cls =
    tone === "success" ? "text-emerald-600" :
    tone === "danger" ? "text-rose-600" :
    tone === "info" ? "text-sky-600" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border/30 bg-secondary/20 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-mono text-base font-bold tabular-nums", cls)}>{value}</div>
    </div>
  );
}
