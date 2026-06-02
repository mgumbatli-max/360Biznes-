import type { Metadata } from "next";
import Link from "next/link";
import {
  Megaphone, Plus, Sparkles, TrendingUp, Power, PowerOff,
  Gift, Star, Ticket, CreditCard, Zap, ArrowRight, BarChart3, Archive, Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getCampaigns, getCampaignStats } from "@/features/kampaniyalar/queries";
import { TIP_META, STATUS_META, type KampaniyaTip, type KampaniyaStatus } from "@/features/kampaniyalar/types";
import { TEMPLATES } from "@/features/kampaniyalar/templates";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Kampaniyalar — endirim, loyalty, kuponlar" };

const QUICK_LINKS = [
  { href: "/kampaniyalar/loyalty",   label: "Loyalty (sadiqlik)", icon: Star,        color: "from-amber-500 to-orange-600", desc: "Müştəri kartları + tier-lər" },
  { href: "/kampaniyalar/giftcards", label: "Hədiyyə kartları",   icon: CreditCard,  color: "from-fuchsia-500 to-purple-600", desc: "Pre-paid kart sat və idarə" },
  { href: "/kampaniyalar/kuponlar",  label: "Kuponlar",           icon: Ticket,      color: "from-rose-500 to-pink-600", desc: "Promokod yarat və izlə" },
  { href: "/kampaniyalar/sablonlar", label: "Hazır şablonlar",    icon: Sparkles,    color: "from-violet-500 to-pink-600", desc: "16 hazır şablon — 1 kliklə" },
  { href: "/kampaniyalar/analitika", label: "Analitika & ROI",    icon: BarChart3,   color: "from-emerald-500 to-teal-600", desc: "Hər kampaniyanın gəliri" },
  { href: "/kampaniyalar/ayarlar",   label: "Loyalty ayarları",   icon: Settings,    color: "from-slate-500 to-slate-700", desc: "Auto-kart, bonus limitləri" },
];

export default async function KampaniyalarPage() {
  const [stats, campaigns] = await Promise.all([
    getCampaignStats(),
    getCampaigns(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-pink-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/20">
              <Megaphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Kampaniyalar mərkəzi</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Endirim, loyalty, kupon və hədiyyə kartı — satışı artırmaq və müştəri saxlamaq üçün hər cür alət bir yerdə.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/kampaniyalar/sablonlar">
                <Sparkles className="h-3.5 w-3.5" /> Şablondan
              </Link>
            </Button>
            <Button asChild size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              <Link href="/kampaniyalar/yeni">
                <Plus className="h-4 w-4" /> Yeni kampaniya
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Megaphone} label="Cəm kampaniya" value={String(stats.total)} subline={`${stats.aktiv} aktiv · ${stats.paused} dayanıb`} />
        <KpiCard icon={Power} label="Aktiv" value={String(stats.aktiv)} subline="İşləyən kampaniyalar" tone="success" />
        <KpiCard icon={TrendingUp} label="Bu ay endirim" value={formatMoney(stats.endirimCemi)} subline={`${stats.istifade30g} istifadə`} tone="info" />
        <KpiCard icon={Gift} label="Bonus verildi" value={formatMoney(stats.bonusVerildi)} subline="Müştəri qazandı" tone="warning" />
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {QUICK_LINKS.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.href}
              href={q.href}
              className="group relative overflow-hidden rounded-xl border border-border bg-card/40 px-4 py-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className={cn("grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-110", q.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{q.label}</div>
                  <div className="text-[11px] text-muted-foreground">Detal və idarə</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          );
        })}
      </section>

      {/* Kampaniyalar siyahısı */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Kampaniyalar siyahısı ({campaigns.length})
          </h2>
          <div className="flex items-center gap-1.5 text-xs">
            <Link href="/kampaniyalar?status=active" className="text-emerald-500 hover:underline">Aktiv</Link>
            <span className="text-muted-foreground/30">·</span>
            <Link href="/kampaniyalar?status=draft" className="text-muted-foreground hover:text-foreground hover:underline">Qaralama</Link>
            <span className="text-muted-foreground/30">·</span>
            <Link href="/kampaniyalar?status=expired" className="text-rose-500 hover:underline">Bitənlər</Link>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <Card className="glass border-dashed">
            <CardContent className="py-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20">
                <Megaphone className="h-6 w-6 text-violet-500" />
              </div>
              <h3 className="mt-3 font-semibold">Hələ kampaniya yoxdur</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Hazır şablondan başla (Novruz, Loyalty, Welcome) ya da öz kampaniyanı qur — kassir avtomatik tətbiq edəcək.
              </p>
              <div className="mt-3 inline-flex flex-wrap items-center gap-2">
                <Button asChild className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
                  <Link href="/kampaniyalar/sablonlar">
                    <Sparkles className="h-4 w-4" /> Şablondan başla
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/kampaniyalar/yeni">
                    <Plus className="h-4 w-4" /> Boş yarat
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((c) => {
              const tipMeta = TIP_META[c.tip as KampaniyaTip] ?? TIP_META.percent_endirim;
              const statusMeta = STATUS_META[c.status as KampaniyaStatus] ?? STATUS_META.draft;
              return (
                <Link key={c.id} href={`/kampaniyalar/${c.id}`} className="group block">
                  <Card className="glass relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                    <CardContent className="space-y-3 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="text-2xl shrink-0">{c.ikon ?? tipMeta.emoji}</span>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">{c.ad}</h3>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{c.aciqlamaq ?? tipMeta.tesvir}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0 text-[10px]", statusMeta.reng)}>
                          {statusMeta.ad}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{tipMeta.ad}</Badge>
                        {c.bitme && (
                          <Badge variant="outline" className="text-[10px]">
                            {c.bitme < new Date() ? "🔚 Bitdi" : `🗓 ${new Date(c.bitme).toLocaleDateString("az-AZ", { day: "2-digit", month: "short" })}`}
                          </Badge>
                        )}
                        {c.stackable && <Badge variant="outline" className="text-[10px]">Stack</Badge>}
                      </div>
                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10.5px] text-muted-foreground">
                        <span><BarChart3 className="mr-0.5 inline h-2.5 w-2.5" />{c._count.campaign_usage} istifadə</span>
                        {c.max_uses && (
                          <span className="tabular-nums">{c.current_uses}/{c.max_uses}</span>
                        )}
                        {c._count.coupons > 0 && (
                          <span><Ticket className="mr-0.5 inline h-2.5 w-2.5" />{c._count.coupons} kupon</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
