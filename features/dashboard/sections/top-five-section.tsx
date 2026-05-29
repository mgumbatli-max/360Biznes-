import Link from "next/link";
import { Package, Trophy, Users, Activity } from "lucide-react";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import {
  getTopProducts,
  getTopSellers,
  getTopCustomers,
  getTopPlatforms,
} from "@/features/dashboard/queries";

const TOP_TONE: Record<"info" | "warning" | "neutral" | "success", string> = {
  info:    "from-info/20 to-info/0 text-info",
  warning: "from-warning/20 to-warning/0 text-warning",
  neutral: "from-primary/15 to-primary/0 text-primary-light",
  success: "from-success/20 to-success/0 text-success",
};

type TopListItem = {
  key: string;
  name: string;
  sub: string;
  value: string;
  href?: string;
};

function TopList({
  title,
  icon: Icon,
  tone,
  items,
  empty,
  href,
}: {
  title: string;
  icon: typeof Package;
  tone: "info" | "warning" | "neutral" | "success";
  items: TopListItem[];
  empty: string;
  href?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div className={cn("pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl opacity-50 transition group-hover:opacity-80", TOP_TONE[tone])} />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("grid h-7 w-7 place-items-center rounded-lg bg-card", TOP_TONE[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-bold">{title}</h3>
        </div>
        {href && (
          <Link href={href} className="text-[10.5px] text-muted-foreground transition hover:text-primary-light">
            Hamısı →
          </Link>
        )}
      </div>
      <div className="relative mt-3">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">{empty}</div>
        ) : (
          <ul className="space-y-1">
            {items.map((it, i) => {
              const inner = (
                <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition hover:bg-secondary/40">
                  <span className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold tabular-nums",
                    i === 0 ? "bg-warning/20 text-warning" :
                    i === 1 ? "bg-foreground/10 text-foreground/70" :
                    i === 2 ? "bg-amber-700/20 text-amber-700 dark:text-amber-500" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold leading-tight">{it.name}</div>
                    <div className="truncate text-[10.5px] text-muted-foreground">{it.sub}</div>
                  </div>
                  <div className="shrink-0 text-right text-[12.5px] font-bold tabular-nums">{it.value}</div>
                </div>
              );
              return (
                <li key={it.key}>
                  {it.href ? <Link href={it.href}>{inner}</Link> : inner}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export async function TopFiveSection() {
  const [topProducts, topSellers, topCustomers, topPlatforms] = await Promise.all([
    getTopProducts(5),
    getTopSellers(5),
    getTopCustomers(5),
    getTopPlatforms(5),
  ]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">Top 5 — bu ay</h2>
        <span className="text-[10.5px] text-muted-foreground">cari ay üzrə</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TopList
          title="Top məhsul"
          icon={Package}
          tone="info"
          items={topProducts.map((p) => ({
            key: p.ad,
            name: p.ad,
            sub: `${formatNumber(p.miqdar, 1)} ədəd`,
            value: formatMoney(p.mebleg),
          }))}
          empty="Hələ satılan məhsul yoxdur"
          href="/anbar/mehsullar"
        />
        <TopList
          title="Top satıcı"
          icon={Trophy}
          tone="warning"
          items={topSellers.map((s) => ({
            key: s.id || s.ad_soyad || "",
            name: s.ad_soyad || "—",
            sub: `${s.sifaris_say} sifariş`,
            value: formatMoney(s.cemi),
          }))}
          empty="Bu ay satıcı statistikası yoxdur"
          href="/team"
        />
        <TopList
          title="Top alıcı"
          icon={Users}
          tone="neutral"
          items={topCustomers.map((c) => ({
            key: c.id,
            name: c.ad,
            sub: `${c.sifaris_say} alış${c.telefon ? ` · ${c.telefon}` : ""}`,
            value: formatMoney(c.cemi),
            href: `/elaqe/musteriler/${c.id}`,
          }))}
          empty="Hələ alıcı yoxdur"
          href="/elaqe"
        />
        <TopList
          title="Top platforma"
          icon={Activity}
          tone="success"
          items={topPlatforms.map((p) => ({
            key: p.platform,
            name: p.platform,
            sub: `${p.sifaris_say} sifariş`,
            value: formatMoney(p.cemi),
          }))}
          empty="Hələ satış kanalı yoxdur"
          href="/marketplace"
        />
      </div>
    </section>
  );
}
