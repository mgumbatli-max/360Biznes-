import Link from "next/link";
import {
  Package,
  Boxes,
  CircleDollarSign,
  Bookmark,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { AnbarKpis } from "../queries";

/**
 * Modern KPI hero strip — 5 vacib göstərici, gradient + icon + klik filter.
 *
 * İstifadəçi yorulmasın deyə yalnız ən əsas məlumatlar yuxarıda göstərilir;
 * təfərrüatlı problem filtrləri aşağıdakı "ProductProblemPanel"-də qalır.
 */
type Props = {
  kpis: AnbarKpis;
  satilabilen?: number; // ümumi-rezerv (məhsullar səhifəsində hesablanır)
  baseUrl?: string;
};

export function ProductKpiHero({ kpis, satilabilen, baseUrl = "/anbar/mehsullar" }: Props) {
  const items = [
    {
      label: "Toplam məhsul",
      value: formatNumber(kpis.toplam_mehsul, 0),
      subline: `${formatNumber(kpis.toplam_stok_vahid, 0)} vahid`,
      icon: Package,
      gradient: "from-slate-500/15 via-slate-500/5 to-transparent",
      iconBg: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
      href: baseUrl,
    },
    {
      label: "Stok dəyəri",
      value: formatMoney(kpis.toplam_stok_deyer),
      subline: "Cari maya ilə",
      icon: CircleDollarSign,
      gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      // "Stok dəyəri" KPI → ən çox stoklu məhsuldan başlayır (azalan).
      // Dəyər = stok × maya, lakin ən böyük dəyərli adətən stoku çox olandır.
      href: `${baseUrl}?sirala=stok_azalan`,
    },
    {
      label: "Satışa açıq",
      value: formatNumber(satilabilen ?? kpis.toplam_stok_vahid - kpis.rezerv_vahid, 0),
      subline:
        kpis.rezerv_vahid > 0
          ? `Rezerv: ${formatNumber(kpis.rezerv_vahid, 0)}`
          : "Bron yoxdur",
      icon: Boxes,
      gradient: "from-sky-500/15 via-sky-500/5 to-transparent",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
      href: `${baseUrl}?stok_status=var`,
    },
    {
      label: "Az qalıb",
      value: String(kpis.low_stok),
      subline:
        kpis.low_stok > 0 ? "Kritik altı stok" : "Hamısı normal",
      icon: AlertTriangle,
      gradient:
        kpis.low_stok > 0
          ? "from-amber-500/15 via-amber-500/5 to-transparent"
          : "from-slate-500/10 via-slate-500/5 to-transparent",
      iconBg:
        kpis.low_stok > 0
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
          : "bg-slate-500/10 text-muted-foreground",
      href: `${baseUrl}?stok_status=az`,
    },
    {
      label: "Stoku bitib",
      value: String(kpis.zero_stok),
      subline:
        kpis.zero_stok > 0
          ? "Yenidən sifariş tövsiyə"
          : "Hamısı stokda",
      icon: TrendingUp,
      gradient:
        kpis.zero_stok > 0
          ? "from-rose-500/15 via-rose-500/5 to-transparent"
          : "from-slate-500/10 via-slate-500/5 to-transparent",
      iconBg:
        kpis.zero_stok > 0
          ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
          : "bg-slate-500/10 text-muted-foreground",
      href: `${baseUrl}?stok_status=yox`,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Link
            key={it.label}
            href={it.href}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${it.gradient} p-3.5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md`}
          >
            {/* Decoration */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl transition group-hover:bg-white/10" />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                  {it.label}
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums leading-tight">
                  {it.value}
                </div>
                <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                  {it.subline}
                </div>
              </div>
              <div
                className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${it.iconBg}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
