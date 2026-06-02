import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  Wallet,
  Users,
  Landmark,
  ShoppingBag,
  ArrowRight,
  Banknote,
  Building2,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import {
  getDashboardKpis,
  getTopExpenseCategories,
  getPLReport,
  getPaymentMethodBreakdown,
} from "@/features/maliyye/queries";
import { getMarketplaceStats } from "@/features/maliyye/marketplace-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Maliyyə hesabatları" };

const AYLAR = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

type ReportSearchParams = { ay?: string; il?: string };

type Tile = {
  title: string;
  desc: string;
  href: string;
  Icon: LucideIcon;
  stats: { label: string; value: string }[];
};

export default async function HesabatPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("maliyye.hesabat");

  const sp = await searchParams;
  const now = new Date();
  const ay = Math.min(12, Math.max(1, Number(sp.ay ?? now.getMonth() + 1)));
  const il = Math.min(2100, Math.max(2020, Number(sp.il ?? now.getFullYear())));
  const prevAy = ay > 1 ? ay - 1 : 12;
  const prevIl = ay > 1 ? il : il - 1;

  const [kpis, topExp, mpStats, pl, plPrev, paymentMethods] = await Promise.all([
    getDashboardKpis(),
    getTopExpenseCategories(3),
    getMarketplaceStats(),
    getPLReport(il, ay),
    getPLReport(prevIl, prevAy).catch(() => null),
    getPaymentMethodBreakdown(il, ay).catch(() => []),
  ]);

  const trendPct = plPrev && plPrev.net_menfeet !== 0
    ? ((pl.net_menfeet - plPrev.net_menfeet) / Math.abs(plPrev.net_menfeet)) * 100
    : null;
  const burnDaily = pl.cemi_xerc > 0 ? pl.cemi_xerc / 30 : 0;
  const cemPay = paymentMethods.reduce((s, p) => s + p.cemi, 0);

  const tiles: Tile[] = [
    {
      title: "Satış hesabatı",
      desc: "Satış həcmi, gəlir, kanal üzrə.",
      href: "/hesabatlar/satis",
      Icon: ShoppingCart,
      stats: [
        { label: "Ay gəliri", value: formatMoney(kpis.ay_gelir) },
        { label: "Bugün", value: formatMoney(kpis.bugun_gelir) },
      ],
    },
    {
      title: "Xərc hesabatı",
      desc: "Kateqoriya üzrə xərclər.",
      href: "/maliyye/xercler",
      Icon: Receipt,
      stats: [
        { label: "Ay xərci", value: formatMoney(kpis.ay_xerc) },
        { label: "Top kateqoriya", value: topExp[0]?.ad ?? "—" },
      ],
    },
    {
      title: "Mənfəət hesabatı",
      desc: "Gəlir − xərc, marja, EBITDA.",
      href: "/hesabatlar/menfeet",
      Icon: TrendingUp,
      stats: [
        { label: "Ay mənfəəti", value: formatMoney(kpis.ay_menfeet) },
        { label: "EBITDA", value: formatMoney(kpis.ay_ebitda) },
      ],
    },
    {
      title: "Cash flow",
      desc: "Pul axını dövr üzrə.",
      href: "/maliyye/pul-axini",
      Icon: Wallet,
      stats: [
        { label: "Açıq balans", value: formatMoney(kpis.hesab_balans) },
        { label: "Bugün net", value: formatMoney(kpis.bugun_net) },
      ],
    },
    {
      title: "Debitor-Kreditor",
      desc: "Müştəri və təchizatçı borcları.",
      href: "/maliyye/debitor",
      Icon: Users,
      stats: [
        { label: "Debitor", value: formatMoney(kpis.debitor_cem) },
        { label: "Kreditor", value: formatMoney(kpis.kreditor_cem) },
      ],
    },
    {
      title: "Vergi hesabatı",
      desc: "Vergi və ƏDV öhdəlikləri.",
      href: "/maliyye/emeliyyat?qrup=vergi",
      Icon: Landmark,
      stats: [
        { label: "Gözləyən", value: String(kpis.gozleyen_odenis) },
        { label: "Bu ay xərc", value: formatMoney(kpis.ay_xerc) },
      ],
    },
    {
      title: "Marketplace",
      desc: "Platforma üzrə hesabatlar.",
      href: "/maliyye/marketplace",
      Icon: ShoppingBag,
      stats: [
        { label: "Gözləyən", value: String(mpStats.gozleyir_say) },
        { label: "Cəm gözlənən", value: formatMoney(mpStats.gozleyir_mebleg) },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Maliyyə hesabatları</h1>
        <p className="mt-1 text-sm text-muted-foreground">Maliyyə hesabatlarına sürətli giriş.</p>
      </header>

      <MaliyyeSubNav active="/maliyye/hesabat" />

      {/* Month/Year filter */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/30 p-3">
        <select name="ay" defaultValue={String(ay)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {AYLAR.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select name="il" defaultValue={String(il)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {[il - 1, il, il + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Tətbiq et</button>
        <a href={`/maliyye/hesabat?ay=${prevAy}&il=${prevIl}`} className="inline-flex h-9 items-center rounded-md border border-border bg-background px-2 text-[11px] font-semibold hover:bg-secondary">Keçən ay</a>
        <a href={`/maliyye/hesabat?ay=${now.getMonth() + 1}&il=${now.getFullYear()}`} className="inline-flex h-9 items-center rounded-md border border-border bg-background px-2 text-[11px] font-semibold hover:bg-secondary">Bu ay</a>
      </form>

      {/* P&L hero pills */}
      <section className="grid grid-cols-2 gap-0 rounded-xl border-y border-border bg-card/30 md:grid-cols-3 lg:grid-cols-6">
        <Pill label="Gəlir" value={formatMoney(pl.gelir)} tone="success" />
        <Pill label="Cəmi xərc" value={formatMoney(pl.cemi_xerc)} tone="danger" />
        <Pill
          label="Net mənfəət"
          value={`${pl.net_menfeet >= 0 ? "+" : "−"}${formatMoney(Math.abs(pl.net_menfeet))}`}
          tone={pl.net_menfeet >= 0 ? "success" : "danger"}
        />
        <Pill
          label="Net marja"
          value={`${pl.marja.toFixed(1)}%`}
          tone={pl.marja >= 10 ? "success" : pl.marja >= 0 ? "warning" : "danger"}
        />
        <Pill label="Günlük burn" value={formatMoney(burnDaily)} tone="warning" />
        {trendPct != null && (
          <Pill
            label="Keçən aya görə"
            value={`${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}%`}
            tone={trendPct >= 0 ? "success" : "danger"}
          />
        )}
      </section>

      {/* P&L + Payment methods card row */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Mənfəət-Zərər (sadə)</span>
              <span className="text-xs font-normal text-muted-foreground">{pl.donem}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Gəlir" value={`+${formatMoney(pl.gelir)}`} tone="success" />
            <Row label="Ümumi xərclər" value={`−${formatMoney(pl.xerc_umumi)}`} tone="danger" />
            <Row label="Maaş və işçi xərci" value={`−${formatMoney(pl.xerc_maas)}`} tone="danger" indent />
            <Row label="Vergi və ƏDV" value={`−${formatMoney(pl.xerc_vergi)}`} tone="danger" indent />
            <Row label="Logistika, gömrük, digər" value={`−${formatMoney(pl.xerc_diger)}`} tone="danger" indent />
            <div className={`mt-3 flex items-center justify-between rounded-lg border px-4 py-3 text-base font-bold tabular-nums ${
              pl.net_menfeet >= 0
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}>
              <span>{pl.net_menfeet >= 0 ? "Net mənfəət" : "Net zərər"}</span>
              <span>{pl.net_menfeet >= 0 ? "+" : "−"}{formatMoney(Math.abs(pl.net_menfeet))}</span>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">Net marja: {pl.marja.toFixed(1)}%</div>
            {pl.sahib_cixib > 0 && (
              <Row label="Sahibkar çıxıb" value={`−${formatMoney(pl.sahib_cixib)}`} tone="warning" />
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Ödəniş növləri</span>
              <span className="text-xs font-normal text-muted-foreground">{pl.donem}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentMethods.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu ay əməliyyat yoxdur</p>
            )}
            {paymentMethods.map((p) => {
              const pct = cemPay > 0 ? (p.cemi / cemPay) * 100 : 0;
              const Icon = p.nov === "negd" ? Banknote : p.nov === "bank" || p.nov === "kecirme" ? Building2 : p.nov === "kart" ? CreditCard : Wallet;
              const cls =
                p.nov === "negd" ? "border-success/30 bg-success/10 text-success" :
                p.nov === "bank" || p.nov === "kecirme" ? "border-info/30 bg-info/10 text-info" :
                p.nov === "kart" ? "border-primary/30 bg-primary/10 text-primary-light" :
                "border-warning/30 bg-warning/10 text-warning";
              return (
                <div key={p.nov} className="flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-md border ${cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{p.nov}</div>
                      <div className="text-sm font-semibold tabular-nums">{formatMoney(p.cemi)}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{p.say} əməliyyat · {pct.toFixed(0)}%</div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.title} className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary">
                    <t.Icon className="h-4 w-4 text-primary-light" />
                  </div>
                  <CardTitle className="text-sm">{t.title}</CardTitle>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {t.stats.map((s) => (
                  <div key={s.label} className="rounded-md border border-border/40 bg-background/40 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    <div className="mt-0.5 truncate text-sm font-bold tabular-nums" title={s.value}>{s.value}</div>
                  </div>
                ))}
              </div>
              <Link href={t.href} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-light hover:underline">
                Bax <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Pill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "success" | "danger" | "warning" | "info" | "neutral" }) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-danger" :
    tone === "warning" ? "text-warning" :
    tone === "info" ? "text-info" : "";
  return (
    <div className="border-r border-border/40 px-4 py-3 last:border-r-0">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, tone = "neutral", indent }: { label: string; value: string; tone?: "success" | "danger" | "warning" | "neutral"; indent?: boolean }) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-danger" :
    tone === "warning" ? "text-warning" : "";
  return (
    <div className={`flex justify-between border-b border-border/40 py-2 last:border-b-0 ${indent ? "pl-4 text-xs text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={`font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}
