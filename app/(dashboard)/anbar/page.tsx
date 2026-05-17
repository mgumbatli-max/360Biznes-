import type { Metadata } from "next";
import Link from "next/link";
import {
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bookmark,
  DollarSign,
  Wallet,
  TrendingUp,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  ScanBarcode,
  Coins,
  Tag,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { RefreshButton } from "@/components/refresh-button";
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
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Anbar" };
export const dynamic = "force-dynamic";

export default async function AnbarDashboardPage() {
  const [kpis, vals, byWh, byBr, categories, brands, units, lowStock] = await Promise.all([
    getAnbarKpis(),
    getAnbarValueKpis(),
    getAnbarByWarehouse(),
    getAnbarByBrand(),
    getCategoryOptions(),
    getBrandOptions(),
    getUnitOptions(),
    getLowStockProducts(5),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Anbar</h1>
        <div className="flex items-center gap-1.5">
          <RefreshButton />
          <ProductWizard categories={categories} brands={brands} units={units} />
        </div>
      </div>

      <AnbarSubNav active="/anbar" />

      <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">Ümumi göstəricilər</h3>
      <div className="grid grid-cols-2 gap-6 border-y border-border py-5 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Cəmi məhsul" icon={Package} value={kpis.toplam_mehsul} sub={`${kpis.toplam_mehsul} aktiv`} href="/anbar/mehsullar" />
        <Kpi label="Stokda" icon={CheckCircle} tone="success" value={kpis.toplam_mehsul - kpis.zero_stok} sub={`${formatNumber(kpis.toplam_stok_vahid, 0)} ədəd`} href="/anbar/mehsullar?stok_status=var" />
        <Kpi label="Stok yoxdur" icon={XCircle} tone="danger" value={kpis.zero_stok} href="/anbar/mehsullar?stok_status=yox" />
        <Kpi label="Az stok" icon={AlertCircle} tone="warning" value={kpis.low_stok} href="/anbar/mehsullar?stok_status=az" />
        <Kpi label="Bron" icon={Bookmark} value={vals.bron_aktiv} sub="aktiv" href="/anbar/bron" />
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">Stok dəyəri</h3>
      <div className="grid grid-cols-2 gap-6 border-y border-border py-5 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Satış dəyəri" icon={DollarSign} tone="success" value={formatNumber(vals.satis_deyeri)} suffix="₼" />
        <Kpi label="Maya dəyəri" icon={Wallet} value={formatNumber(vals.maya_deyeri)} suffix="₼" />
        <Kpi label="Potensial mənfəət" icon={TrendingUp} tone="success" value={"+" + formatNumber(vals.potensial_menfeet)} suffix="₼" />
        <Kpi label="60 gündür satılmır" icon={Clock} tone="warning" value={vals.satilmayan_60} sub="siyahını gör" />
        <Kpi label="Ölü stok (90+)" icon={AlertTriangle} tone="danger" value={vals.olu_stok} sub="siyahını gör" />
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold tracking-tight">⚠️ Problemli məhsullar</h3>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <ProblemCard icon={ImageIcon} label="Şəkilsiz" value={kpis.sekilsiz} href="/anbar/hesabat?mod=sekilsiz" />
        <ProblemCard icon={ScanBarcode} label="Barkodsuz" value={kpis.barkodsuz} href="/anbar/hesabat?mod=barkodsuz" />
        <ProblemCard icon={Coins} label="Mayasız" value={kpis.mayasiz} href="/anbar/hesabat?mod=mayasiz" />
        <ProblemCard icon={Circle} label="Qiymətsiz" value={kpis.qiymetsiz} href="/anbar/hesabat?mod=qiymetsiz" />
      </div>

      <div className="mt-5">
        <AttentionWidget items={lowStock} mode="anbar" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold tracking-tight">Anbar üzrə</h4>
          <ul className="space-y-0">
            {byWh.length === 0 && <li className="py-2 text-sm text-muted-foreground">Anbar yoxdur</li>}
            {byWh.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
                <span className="min-w-0 flex-1 truncate">
                  📦 {w.ad}
                  <small className="ml-1 text-muted-foreground">({w.mehsul_say} məhsul, {formatNumber(w.umumi_miqdar, 0)} ədəd)</small>
                </span>
                <span className="font-semibold tabular-nums">{formatNumber(w.satis_deyeri)}₼</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-3 flex items-center gap-1 text-sm font-semibold tracking-tight">
            <Tag className="h-3.5 w-3.5" /> Marka üzrə
          </h4>
          <ul className="space-y-0">
            {byBr.length === 0 && <li className="py-2 text-sm text-muted-foreground">Marka yoxdur</li>}
            {byBr.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
                <span className="min-w-0 flex-1 truncate">
                  🏷️ {b.ad}
                  <small className="ml-1 text-muted-foreground">({b.mehsul_say})</small>
                </span>
                <span className="font-semibold tabular-nums">{formatNumber(b.deyer)}₼</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  icon: Icon,
  value,
  suffix,
  sub,
  tone,
  href,
}: {
  label: string;
  icon: LucideIcon;
  value: number | string;
  suffix?: string;
  sub?: string;
  tone?: "success" | "warning" | "danger";
  href?: string;
}) {
  const cls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";

  const body = (
    <div className="cursor-pointer transition hover:opacity-70">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-2 text-[22px] font-semibold leading-none tabular-nums tracking-tight ${cls}`}>
        {value}
        {suffix && <small className="ml-1 text-xs font-medium text-muted-foreground">{suffix}</small>}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ProblemCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition hover:border-border-hi hover:bg-secondary/40">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-warning/15 text-warning">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">Diqqət lazımdır</div>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-warning">{value}</div>
    </Link>
  );
}
