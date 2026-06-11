import { Suspense } from "react";
import { getModuleEntry } from "@/lib/lite/config";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Package,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bookmark,
  Wallet,
  TrendingUp,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  ScanBarcode,
  Coins,
  Tag,
  Circle,
  Sparkles,
  ClipboardCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { RefreshButton } from "@/components/refresh-button";
import { requireAnbarPerm } from "@/features/anbar/access-guard";
import { ProductWizard } from "@/features/anbar/components/product-wizard";
import {
  getAnbarKpis,
  getAnbarValueKpis,
  getAnbarByWarehouse,
  getAnbarByBrand,
  getCategoryOptions,
  getBrandOptions,
  getUnitOptions,
} from "@/features/anbar/queries";
import { getLowStockProducts } from "@/features/anbar/attention-queries";
import { AttentionWidget } from "@/features/anbar/components/attention-widget";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatCompactMoney, formatCompactNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Anbar" };

/* ------------------------------------------------------------------ */
/*  Streaming sections — şablon: shell instant, hər blok öz Suspense-i */
/*  ilə paralel stream olur. KPI-lar 60s cache-li olduğundan təkrar    */
/*  ziyarətlər heç DB-yə getmir.                                       */
/* ------------------------------------------------------------------ */

async function HeaderActions() {
  const [categories, brands, units] = await Promise.all([
    getCategoryOptions(),
    getBrandOptions(),
    getUnitOptions(),
  ]);
  return <ProductWizard categories={categories} brands={brands} units={units} />;
}

function HeaderActionsFallback() {
  return <Skeleton className="h-9 w-32 rounded-md" />;
}

async function OverviewSection() {
  const { canViewCost } = await import("@/lib/auth/finance-permissions");
  const [kpis, vals, showCost] = await Promise.all([
    getAnbarKpis(),
    getAnbarValueKpis(),
    canViewCost(),
  ]);

  const problems = [
    { key: "sekilsiz",   label: "Şəkilsiz",   value: kpis.sekilsiz,   icon: ImageIcon,    href: "/anbar/hesabat?mod=sekilsiz" },
    { key: "barkodsuz",  label: "Barkodsuz",  value: kpis.barkodsuz,  icon: ScanBarcode,  href: "/anbar/hesabat?mod=barkodsuz" },
    { key: "mayasiz",    label: "Mayasız",    value: kpis.mayasiz,    icon: Coins,        href: "/anbar/hesabat?mod=mayasiz" },
    { key: "qiymetsiz",  label: "Qiymətsiz",  value: kpis.qiymetsiz,  icon: Circle,       href: "/anbar/hesabat?mod=qiymetsiz" },
  ];
  const activeProblems = problems.filter((p) => p.value > 0);
  const allClean = activeProblems.length === 0;
  const topProblem = [...problems].sort((a, b) => b.value - a.value)[0];
  const heroInsight =
    kpis.zero_stok > 0
      ? { tone: "danger" as const, text: `${kpis.zero_stok} məhsulun stoku bitib — təcili sifariş tələb olunur`, href: "/anbar/satinalma" }
      : kpis.low_stok > 0
      ? { tone: "warning" as const, text: `${kpis.low_stok} məhsul aşağı stok səviyyəsindədir`, href: "/anbar/mehsullar?stok_status=az" }
      : topProblem && topProblem.value > 50
      ? { tone: "warning" as const, text: `${topProblem.value} məhsul ${topProblem.label.toLowerCase()} — diqqət lazım`, href: topProblem.href }
      : null;

  return (
    <>
      {/* ── AI Insight Strip ── */}
      {heroInsight && (
        <Link
          href={heroInsight.href}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:opacity-90 ${
            heroInsight.tone === "danger"
              ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          }`}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">{heroInsight.text}</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      {/* ── HERO: Anbar dəyəri ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Anbarın canlı dəyəri (satış qiymətində)
          </div>
          <div
            className="mt-2 text-4xl font-bold tracking-tight text-foreground"
            title={`${formatNumber(vals.satis_deyeri, 2)} ₼`}
          >
            {formatCompactMoney(vals.satis_deyeri)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            {showCost && (
              <>
                <SubStat label="Maya dəyəri" value={formatCompactMoney(vals.maya_deyeri)} fullValue={`${formatNumber(vals.maya_deyeri, 2)} ₼`} icon={Wallet} />
                <SubStat label="Potensial mənfəət" value={"+" + formatCompactMoney(vals.potensial_menfeet)} fullValue={`${formatNumber(vals.potensial_menfeet, 2)} ₼`} icon={TrendingUp} tone="success" />
              </>
            )}
            <SubStat label="Cəmi məhsul" value={formatCompactNumber(kpis.toplam_mehsul)} fullValue={`${formatNumber(kpis.toplam_mehsul, 0)} ədəd`} icon={Package} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sürətli əməliyyat
          </div>
          <div className="space-y-1.5">
            {kpis.sekilsiz > 0 && (
              <QuickAction icon={Sparkles} title="AI ilə şəkil yarat" desc={`${kpis.sekilsiz} məhsul şəkilsizdir`} href="/anbar/anomali/bulk-fix" tone="primary" />
            )}
            <QuickAction icon={ClipboardCheck} title="Sayım başlat" desc="Faktiki stoku yoxla" href="/anbar/inventar" />
            <QuickAction
              icon={AlertCircle}
              title="Aşağı stoku gör"
              desc={`${kpis.low_stok + kpis.zero_stok} məhsul diqqət tələb edir`}
              href="/anbar/satinalma"
              tone={kpis.zero_stok > 0 ? "danger" : kpis.low_stok > 0 ? "warning" : "default"}
            />
          </div>
        </div>
      </div>

      {/* ── Stok status row ── */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-tight">Stok vəziyyəti</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatusCard label="Stokda var" icon={CheckCircle2} value={kpis.toplam_mehsul - kpis.zero_stok} sub={`${formatCompactNumber(kpis.toplam_stok_vahid)} ədəd`} tone="success" href="/anbar/mehsullar?stok_status=var" />
          <StatusCard label="Az stok" icon={AlertCircle} value={kpis.low_stok} sub={kpis.low_stok > 0 ? "diqqət lazım" : "hamı qaydadır"} tone={kpis.low_stok > 0 ? "warning" : "neutral"} href="/anbar/mehsullar?stok_status=az" />
          <StatusCard label="Stok yoxdur" icon={XCircle} value={kpis.zero_stok} sub={kpis.zero_stok > 0 ? "sifariş tələbli" : "yoxdur"} tone={kpis.zero_stok > 0 ? "danger" : "neutral"} href="/anbar/mehsullar?stok_status=yox" />
          <StatusCard label="Aktiv bron" icon={Bookmark} value={vals.bron_aktiv} sub={vals.bron_aktiv > 0 ? "müştəri saxlanışı" : "bron yoxdur"} tone={vals.bron_aktiv > 0 ? "info" : "neutral"} href="/anbar/bron" />
        </div>
      </div>

      {/* ── Aging (ölü stok) ── */}
      {(vals.satilmayan_60 > 0 || vals.olu_stok > 0) && (
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-tight">Stok yaşlanması</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatusCard label="60+ gündür satılmır" icon={Clock} value={vals.satilmayan_60} sub="hesabatı aç" tone={vals.satilmayan_60 > 20 ? "warning" : "info"} href="/anbar/hesabat?mod=60gun" />
            <StatusCard label="Ölü stok (90+ gün)" icon={AlertTriangle} value={vals.olu_stok} sub="dondurulmuş kapital" tone="danger" href="/anbar/hesabat?mod=olu" />
          </div>
        </div>
      )}

      {/* ── Data sağlamlığı ── */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          Data sağlamlığı
          {allClean && <StatusBadge tone="success" size="sm">Hamı qaydadır</StatusBadge>}
        </h3>
        {allClean ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Bütün məhsullar şəkil, barkod, maya və qiymət ilə tam doldurulub.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {activeProblems.map((p) => (
              <Link
                key={p.key}
                href={p.href}
                className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 transition hover:border-amber-500/40 hover:bg-amber-500/10"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <p.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Diqqət lazımdır →</div>
                </div>
                <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400" title={String(p.value)}>
                  {formatCompactNumber(p.value)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OverviewFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function AttentionSection() {
  const lowStock = await getLowStockProducts(5);
  return <AttentionWidget items={lowStock} mode="anbar" />;
}

async function BreakdownSection() {
  const [byWh, byBr] = await Promise.all([getAnbarByWarehouse(), getAnbarByBrand()]);
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Package className="h-3.5 w-3.5 text-muted-foreground" /> Anbar üzrə
        </h4>
        <ul className="space-y-0">
          {byWh.length === 0 && <li className="py-2 text-sm text-muted-foreground">Anbar yoxdur</li>}
          {byWh.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{w.ad}</span>
                <small className="ml-1.5 text-muted-foreground">
                  {w.mehsul_say} məhsul · {formatCompactNumber(w.umumi_miqdar)} ədəd
                </small>
              </span>
              <span className="font-semibold tabular-nums" title={`${formatNumber(w.satis_deyeri, 2)} ₼`}>
                {formatCompactMoney(w.satis_deyeri)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Marka üzrə
        </h4>
        <ul className="space-y-0">
          {byBr.length === 0 && <li className="py-2 text-sm text-muted-foreground">Marka yoxdur</li>}
          {byBr.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{b.ad}</span>
                <small className="ml-1.5 text-muted-foreground">{b.mehsul_say} məhsul</small>
              </span>
              <span className="font-semibold tabular-nums" title={`${formatNumber(b.deyer, 2)} ₼`}>
                {formatCompactMoney(b.deyer)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BreakdownFallback() {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

export default async function AnbarDashboardPage() {
  // Modul Giriş Sistemi: icmal (modulun öz dashboardu) HƏR İKİ rejimdə yalnız
  // ayar AÇIQ + rolda icazə (icmal.anbar) olduqda görünür; əks halda modul
  // birbaşa iş səhifəsinə (ayarlardan seçilən landing) açılır.
  {
    const __entry = await getModuleEntry("anbar");
    if (!__entry.icmalOn) redirect(__entry.landing);
  }

  await requireAnbarPerm();
  // Shell instant render olunur — hər data bloku öz Suspense-ində paralel stream olur.
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Anbar</h1>
        <div className="flex items-center gap-1.5">
          <RefreshButton />
          <Suspense fallback={<HeaderActionsFallback />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>

      <AnbarSubNav active="/anbar" />

      <Suspense fallback={<OverviewFallback />}>
        <OverviewSection />
      </Suspense>

      <Suspense fallback={null}>
        <AttentionSection />
      </Suspense>

      <Suspense fallback={<BreakdownFallback />}>
        <BreakdownSection />
      </Suspense>
    </div>
  );
}

function SubStat({
  label,
  value,
  fullValue,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  fullValue?: string;
  icon: LucideIcon;
  tone?: "success" | "warning" | "danger";
}) {
  const cls = tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "danger" ? "text-rose-500" : "text-foreground";
  return (
    <div title={fullValue}>
      <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums tracking-tight ${cls}`}>{value}</div>
    </div>
  );
}

function StatusCard({
  label,
  icon: Icon,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  sub?: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  href: string;
}) {
  const palette = {
    success: { wrap: "border-emerald-500/25 bg-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400", iconBg: "bg-emerald-500/15" },
    warning: { wrap: "border-amber-500/30 bg-amber-500/5",     text: "text-amber-600 dark:text-amber-400",     iconBg: "bg-amber-500/15" },
    danger:  { wrap: "border-rose-500/30 bg-rose-500/5",       text: "text-rose-600 dark:text-rose-400",       iconBg: "bg-rose-500/15" },
    info:    { wrap: "border-sky-500/25 bg-sky-500/5",         text: "text-sky-600 dark:text-sky-400",         iconBg: "bg-sky-500/15" },
    neutral: { wrap: "border-border bg-card",                  text: "text-muted-foreground",                  iconBg: "bg-secondary" },
  }[tone];
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl border p-3.5 transition hover:shadow-sm ${palette.wrap}`}>
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${palette.iconBg} ${palette.text}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${palette.text}`} title={String(value)}>
        {formatCompactNumber(value)}
      </div>
    </Link>
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  href,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
  tone?: "primary" | "danger" | "warning" | "default";
}) {
  const iconCls = {
    primary: "bg-primary/15 text-primary",
    danger:  "bg-rose-500/15 text-rose-600",
    warning: "bg-amber-500/15 text-amber-600",
    default: "bg-secondary text-muted-foreground",
  }[tone];
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-secondary/60">
      <div className={`grid h-8 w-8 place-items-center rounded-md ${iconCls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{title}</div>
        <div className="truncate text-[10.5px] text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
