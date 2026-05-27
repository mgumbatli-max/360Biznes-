import Link from "next/link";
import { Package, ShoppingCart, Percent, Users, Phone, MapPin, Hash, Tag, Truck, Building2, Wallet, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatNumber } from "@/lib/utils";

function marginBadge(pct: number) {
  if (pct >= 30) return { cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40", label: "Əla" };
  if (pct >= 15) return { cls: "bg-primary/15 text-primary border-primary/40", label: "Yaxşı" };
  if (pct >= 5) return { cls: "bg-amber-500/15 text-amber-500 border-amber-500/40", label: "Orta" };
  if (pct >= 0) return { cls: "bg-orange-500/15 text-orange-500 border-orange-500/40", label: "Aşağı" };
  return { cls: "bg-rose-500/15 text-rose-500 border-rose-500/40", label: "Zərər" };
}

function marginGradient(pct: number) {
  if (pct >= 30) return "from-emerald-500 to-teal-500";
  if (pct >= 15) return "from-primary to-violet-500";
  if (pct >= 5) return "from-amber-500 to-orange-500";
  if (pct >= 0) return "from-orange-500 to-rose-500";
  return "from-rose-500 to-red-700";
}

/* ============================================================
 * MƏHSUL kərpic — marja, gəlir, qty, kateqoriya, kod
 * ============================================================ */
export function MehsulBrick({
  rank,
  ad,
  kod,
  kateqoriya,
  units,
  revenue,
  cogs,
  margin,
  margin_pct,
  mehsulId,
}: {
  rank: number;
  ad: string;
  kod?: string | null;
  kateqoriya?: string;
  units: number;
  revenue: number;
  cogs?: number;
  margin: number;
  margin_pct: number;
  mehsulId?: string; // drill-down link üçün — verildikdə kart kliklənən olur
}) {
  const badge = marginBadge(margin_pct);
  const grad = marginGradient(margin_pct);
  const widthPct = Math.min(100, Math.max(0, margin_pct));

  const Wrapper = mehsulId
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={`/anbar/mehsullar/${mehsulId}`} className="block" title="Məhsul detalı və günlük trend">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <Wrapper>
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      {/* Halo */}
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition group-hover:opacity-25", grad)} />

      <div className="relative">
        <div className="flex items-start gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary/60 text-xs font-bold tabular-nums">#{rank}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold leading-tight">{ad}</h3>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              {kod && (
                <span className="inline-flex items-center gap-0.5 font-mono">
                  <Hash className="h-2.5 w-2.5" />
                  {kod}
                </span>
              )}
              {kateqoriya && (
                <span className="inline-flex items-center gap-0.5">
                  <Tag className="h-2.5 w-2.5" />
                  <span className="truncate">{kateqoriya}</span>
                </span>
              )}
            </div>
          </div>
          <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold", badge.cls)}>{badge.label}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-secondary/30 p-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              <ShoppingCart className="h-2.5 w-2.5" />
              ədəd
            </div>
            <div className="text-sm font-bold tabular-nums">{formatNumber(units, 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Gəlir</div>
            <div className="text-sm font-bold tabular-nums">{formatMoney(revenue)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Marja</div>
            <div className={cn("text-sm font-bold tabular-nums", margin < 0 ? "text-rose-500" : "text-emerald-500")}>
              {margin < 0 ? "− " : ""}{formatMoney(Math.abs(margin))}
            </div>
          </div>
        </div>

        {/* Margin bar */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Percent className="h-2.5 w-2.5" />
              Marja %
            </span>
            <span className={cn("font-bold tabular-nums", margin_pct < 0 ? "text-rose-500" : "")}>{margin_pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", grad)} style={{ width: `${widthPct}%` }} />
          </div>
        </div>

        {cogs != null && (
          <div className="mt-1.5 text-right text-[10px] text-muted-foreground tabular-nums">
            COGS: <span className="font-mono">{formatMoney(cogs)}</span>
          </div>
        )}

        {mehsulId && (
          <div className="mt-1.5 flex items-center justify-end gap-0.5 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Detal və trend <ArrowRight className="h-2.5 w-2.5" />
          </div>
        )}
      </div>
    </div>
    </Wrapper>
  );
}

/* ============================================================
 * MÜŞTƏRİ kərpic — orders, gəlir, marja
 * ============================================================ */
export function MusteriBrick({
  rank,
  ad,
  telefon,
  sheher,
  orders,
  revenue,
  margin,
  margin_pct,
  ltv,
  last_order,
}: {
  rank: number;
  ad: string;
  telefon?: string | null;
  sheher?: string | null;
  orders: number;
  revenue: number;
  margin?: number;
  margin_pct?: number;
  ltv?: number;
  last_order?: Date | null;
}) {
  const pct = margin_pct ?? 0;
  const badge = marginBadge(pct);
  const grad = marginGradient(pct);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition group-hover:opacity-25", grad)} />
      <div className="relative">
        <div className="flex items-start gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary/60 text-xs font-bold tabular-nums">#{rank}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold leading-tight">{ad}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {telefon && (
                <span className="inline-flex items-center gap-0.5">
                  <Phone className="h-2.5 w-2.5" />
                  {telefon}
                </span>
              )}
              {sheher && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  {sheher}
                </span>
              )}
            </div>
          </div>
          {margin != null && margin_pct != null && (
            <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold", badge.cls)}>{pct.toFixed(0)}%</span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-secondary/30 p-2">
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Sifariş</div>
            <div className="text-sm font-bold tabular-nums">{orders}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Gəlir</div>
            <div className="text-sm font-bold tabular-nums">{formatMoney(revenue)}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{margin != null ? "Marja" : "LTV"}</div>
            <div className={cn("text-sm font-bold tabular-nums", margin != null && margin < 0 ? "text-rose-500" : "text-emerald-500")}>
              {margin != null ? formatMoney(margin) : formatMoney(ltv ?? 0)}
            </div>
          </div>
        </div>

        {last_order && (
          <div className="mt-2 text-right text-[10px] text-muted-foreground">
            Son sifariş: {new Date(last_order).toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 * KATEQORIYA kərpic — units, revenue, marja
 * ============================================================ */
export function KateqoriyaBrick({
  ad,
  units,
  revenue,
  cogs,
  margin,
  margin_pct,
  productCount,
}: {
  ad: string;
  units?: number;
  revenue: number;
  cogs?: number;
  margin: number;
  margin_pct: number;
  productCount?: number;
}) {
  const badge = marginBadge(margin_pct);
  const grad = marginGradient(margin_pct);
  const widthPct = Math.min(100, Math.max(0, margin_pct));

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition group-hover:opacity-25", grad)} />
      <div className="relative">
        <div className="flex items-start gap-2">
          <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-md", grad)}>
            <Tag className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold leading-tight">{ad}</h3>
            {productCount != null && <div className="text-[10px] text-muted-foreground">{productCount} məhsul</div>}
          </div>
          <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold", badge.cls)}>{badge.label}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-secondary/30 p-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Gəlir</div>
            <div className="text-base font-bold tabular-nums">{formatMoney(revenue)}</div>
            {units != null && <div className="text-[10px] text-muted-foreground tabular-nums">{formatNumber(units, 0)} ədəd</div>}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Marja</div>
            <div className={cn("text-base font-bold tabular-nums", margin < 0 ? "text-rose-500" : "text-emerald-500")}>
              {margin < 0 ? "− " : ""}{formatMoney(Math.abs(margin))}
            </div>
            {cogs != null && <div className="text-[10px] text-muted-foreground tabular-nums">COGS {formatMoney(cogs)}</div>}
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Marja %</span>
            <span className="font-bold tabular-nums">{margin_pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", grad)} style={{ width: `${widthPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * TƏCHİZATÇI kərpic — orders, total, debt, last_order, on_time_pct
 * ============================================================ */
export function TedarukciBrick({
  rank,
  ad,
  sirket,
  orders,
  total,
  paid,
  debt,
  on_time_pct,
  last_order,
  avg_lead_time,
}: {
  rank: number;
  ad: string;
  sirket?: string | null;
  orders: number;
  total: number;
  paid?: number;
  debt: number;
  on_time_pct?: number;
  last_order?: Date | null;
  avg_lead_time?: number | null;
}) {
  const paidPct = total > 0 ? Math.min(100, Math.max(0, ((paid ?? (total - debt)) / total) * 100)) : 0;
  const onTime = on_time_pct ?? null;

  const grad = debt === 0
    ? "from-emerald-500 to-teal-500"
    : debt / Math.max(total, 1) > 0.3
    ? "from-rose-500 to-red-600"
    : "from-amber-500 to-orange-500";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition group-hover:opacity-25", grad)} />
      <div className="relative">
        <div className="flex items-start gap-2">
          <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-md", grad)}>
            <Truck className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">#{rank}</span>
              <h3 className="truncate text-sm font-bold leading-tight">{ad}</h3>
            </div>
            {sirket && (
              <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Building2 className="h-2.5 w-2.5" />
                <span className="truncate">{sirket}</span>
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            {orders} sif.
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-secondary/30 p-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Cəm alış</div>
            <div className="text-base font-bold tabular-nums">{formatMoney(total)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Borc</div>
            <div className={cn("text-base font-bold tabular-nums", debt > 0 ? "text-rose-500" : "text-emerald-500")}>
              {formatMoney(debt)}
            </div>
          </div>
        </div>

        {/* Paid progress */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Wallet className="h-2.5 w-2.5" />
              Ödənmə
            </span>
            <span className="font-bold tabular-nums">{paidPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-700",
                paidPct >= 90 ? "from-emerald-500 to-teal-500" : paidPct >= 50 ? "from-amber-500 to-orange-500" : "from-rose-500 to-red-600"
              )}
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          {last_order ? (
            <span>Son: {new Date(last_order).toLocaleDateString("az-AZ", { day: "numeric", month: "short" })}</span>
          ) : (
            <span>—</span>
          )}
          {onTime != null && <span>Vaxtında: <span className="font-bold text-foreground">{onTime.toFixed(0)}%</span></span>}
          {avg_lead_time != null && avg_lead_time > 0 && (
            <span>Lead: <span className="font-bold text-foreground">{avg_lead_time.toFixed(0)} gün</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * SATICI kərpic — sales rep performance
 * ============================================================ */
export function SaticiBrick({
  rank,
  ad,
  orders,
  revenue,
  avg_check,
  margin,
}: {
  rank: number;
  ad: string;
  orders: number;
  revenue: number;
  avg_check?: number;
  margin?: number;
}) {
  const grad = rank === 1 ? "from-amber-400 to-orange-500" : rank === 2 ? "from-slate-300 to-slate-500" : rank === 3 ? "from-orange-400 to-amber-700" : "from-primary to-violet-500";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 blur-2xl transition group-hover:opacity-30", grad)} />
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow-md", grad)}>
            <Users className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">#{rank}</span>
              <h3 className="truncate text-sm font-bold leading-tight">{ad}</h3>
            </div>
            <div className="text-[10px] text-muted-foreground">{orders} sifariş</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-secondary/30 p-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Gəlir</div>
            <div className="text-base font-bold tabular-nums">{formatMoney(revenue)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{margin != null ? "Marja" : "Orta çek"}</div>
            <div className="text-base font-bold tabular-nums">
              {margin != null ? formatMoney(margin) : formatMoney(avg_check ?? (orders > 0 ? revenue / orders : 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * EMPTY state for brick grids
 * ============================================================ */
export function BrickEmpty({ icon: Icon = Package, msg = "Məlumat yoxdur" }: { icon?: React.ComponentType<{ className?: string }>; msg?: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-sm text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <p>{msg}</p>
    </div>
  );
}
