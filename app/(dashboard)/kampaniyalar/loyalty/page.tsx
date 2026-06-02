import type { Metadata } from "next";
import Link from "next/link";
import {
  Star, ChevronLeft, Users, Wallet, TrendingUp, ScanLine, Settings,
  UserPlus, Phone, ExternalLink, Search, Printer, Trophy, Crown,
  Sparkles, Clock, ArrowUpRight, ArrowDownRight, Zap, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getLoyaltyOverview, getLoyaltyMembers, getLoyaltyLeaderboard,
  getInactiveLoyaltyMembers, getLoyaltyMonthStats,
} from "@/features/kampaniyalar/queries";
import { TIER_META, type LoyaltyTier } from "@/features/kampaniyalar/types";
import { CardScanner } from "@/features/kampaniyalar/components/card-scanner";
import { cn, formatMoney, formatDate, formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Loyalty proqram" };

type SP = { tier?: string; q?: string };

export default async function LoyaltyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [data, members, leaderboard, inactive, monthStats] = await Promise.all([
    getLoyaltyOverview(),
    getLoyaltyMembers({ tier: sp.tier, q: sp.q }),
    getLoyaltyLeaderboard(5),
    getInactiveLoyaltyMembers(8),
    getLoyaltyMonthStats(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-orange-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
              <Star className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Loyalty proqram</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Sadiqlik kartı olan müştərilər, tier-lər, bonus tarixçəsi — bir yerdən idarə.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              <Link href="/elaqe/musteriler?yeni=1">
                <UserPlus className="h-3.5 w-3.5" /> Yeni müştəri
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/kampaniyalar/ayarlar">
                <Settings className="h-3.5 w-3.5" /> Ayarlar
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Aktiv kartlar"
          value={data.total}
          tone="violet"
          subline={`${monthStats.yeniKart} yeni (bu ay)`}
        />
        <KpiCard
          icon={Wallet}
          label="Cəm bonus balans"
          value={formatMoney(data.balansCemi)}
          tone="amber"
          subline="İstifadə olunmamış"
        />
        <KpiCard
          icon={TrendingUp}
          label="Ömürlik qazanc"
          value={formatMoney(data.qazancCemi)}
          tone="emerald"
          subline="Müştərilərə verilmiş"
        />
        <KpiCard
          icon={Zap}
          label="Bu ay bonus"
          value={formatMoney(monthStats.qazancCemi)}
          tone="sky"
          subline={`${monthStats.qazancTxSayi} əməliyyat`}
        />
      </section>

      {/* Kart scanner — bir vizual blok */}
      <Card className="overflow-hidden border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-card">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-500">
              <ScanLine className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="text-sm font-semibold">Kart axtar / skan et</div>
              <div className="text-[10.5px] text-muted-foreground">Barkod, kart kodu (LK...), telefon və ya müştəri adı</div>
            </div>
            <div className="flex-1 min-w-[260px]">
              <CardScanner />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2-sütun: Leaderboard + Risk altında */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top 5 müştəri */}
        <Card className="overflow-hidden border-amber-500/20">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Top 5 müştəri</h3>
              </div>
              <Badge variant="outline" className="text-[10px]">Ömürlik qazanc</Badge>
            </div>
            {leaderboard.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Hələ məlumat yoxdur</div>
            ) : (
              <ol className="space-y-1.5">
                {leaderboard.map((m, idx) => {
                  const tierMeta = TIER_META[m.tier as LoyaltyTier] ?? TIER_META.bronze;
                  const rankEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                  return (
                    <li key={m.id} className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-amber-500/30 hover:bg-amber-500/5">
                      <div className="w-7 flex-shrink-0 text-center text-base font-bold">{rankEmoji}</div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/elaqe/musteriler/${m.kontragent?.id ?? ""}`}
                          className="truncate text-sm font-medium hover:text-primary"
                        >
                          {m.kontragent?.ad ?? "—"}
                        </Link>
                        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                          <Badge variant="outline" className={cn("text-[9px] py-0", tierMeta.reng)}>
                            {tierMeta.emoji} {tierMeta.ad}
                          </Badge>
                          {m.son_alish_de && <span>{formatRelativeTime(m.son_alish_de)}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums text-emerald-500">{formatMoney(m.total_qazanc)}</div>
                        <div className="text-[9.5px] text-muted-foreground">balans {formatMoney(m.balans)}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Risk altında olan müştərilər */}
        <Card className="overflow-hidden border-rose-500/20">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Risk altında</h3>
              </div>
              <Badge variant="outline" className="border-rose-500/30 text-[10px] text-rose-500">
                60+ gün passiv
              </Badge>
            </div>
            {inactive.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                ✨ Heç bir risk yoxdur — bütün müştərilər aktivdir
              </div>
            ) : (
              <ul className="space-y-1">
                {inactive.map((m) => {
                  const tierMeta = TIER_META[m.tier as LoyaltyTier] ?? TIER_META.bronze;
                  return (
                    <li key={m.id} className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-rose-500/30 hover:bg-rose-500/5">
                      <span className="text-base">{tierMeta.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/elaqe/musteriler/${m.kontragent?.id ?? ""}`}
                          className="block truncate text-xs font-medium hover:text-primary"
                        >
                          {m.kontragent?.ad ?? "—"}
                        </Link>
                        <div className="text-[10px] text-muted-foreground">
                          {m.kontragent?.telefon && <span>{m.kontragent.telefon} · </span>}
                          {m.son_alish_de ? formatRelativeTime(m.son_alish_de) : "Heç vaxt"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10.5px] font-medium tabular-nums">{formatMoney(m.balans)}</div>
                        <div className="text-[9px] text-muted-foreground">balans</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Tier paylanışı — vizual */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Tier paylanışı (klik ilə süz)
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <TierCard href="/kampaniyalar/loyalty" active={!sp.tier} emoji="📊" ad="Hamısı" count={data.total} total={data.total} />
          {(Object.entries(TIER_META) as [LoyaltyTier, typeof TIER_META.bronze][]).map(([tier, meta]) => {
            const count = data.tierDist[tier] ?? 0;
            return (
              <TierCard
                key={tier}
                href={`/kampaniyalar/loyalty?tier=${tier}`}
                active={sp.tier === tier}
                emoji={meta.emoji}
                ad={meta.ad}
                count={count}
                total={data.total}
                bonusPct={meta.bonusPct}
                endirimPct={meta.endirimPct}
              />
            );
          })}
        </div>
      </section>

      {/* Bu ay performansı */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="overflow-hidden border-emerald-500/20">
          <CardContent className="space-y-2 py-3">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" /> Bonus qazanc (bu ay)
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-500">{formatMoney(monthStats.qazancCemi)}</div>
            <div className="text-[10px] text-muted-foreground">{monthStats.qazancTxSayi} əməliyyat — müştərilərə paylanıb</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-amber-500/20">
          <CardContent className="space-y-2 py-3">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <ArrowDownRight className="h-3 w-3 text-amber-500" /> Bonus sərf (bu ay)
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-500">{formatMoney(monthStats.serfCemi)}</div>
            <div className="text-[10px] text-muted-foreground">{monthStats.serfTxSayi} satışda istifadə</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-violet-500/20">
          <CardContent className="space-y-2 py-3">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-violet-500" /> Yeni kart (bu ay)
            </div>
            <div className="text-2xl font-bold tabular-nums text-violet-500">{monthStats.yeniKart}</div>
            <div className="text-[10px] text-muted-foreground">avtomatik yaradılıb</div>
          </CardContent>
        </Card>
      </section>

      {/* Members cədvəli */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Loyalty üzvləri ({members.length}) {sp.tier ? `· ${TIER_META[sp.tier as LoyaltyTier]?.ad}` : ""}
          </h2>
          <form className="flex gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Ad / telefon / kart..."
                className="h-9 w-[240px] rounded-lg border border-input bg-background pl-7 pr-3 text-xs"
              />
            </div>
            {sp.tier && <input type="hidden" name="tier" value={sp.tier} />}
            <Button type="submit" size="sm" variant="outline">Süz</Button>
            {(sp.q || sp.tier) && (
              <Link href="/kampaniyalar/loyalty" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs hover:bg-secondary">
                Təmizlə
              </Link>
            )}
          </form>
        </div>

        {members.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Users className="mx-auto h-7 w-7 text-muted-foreground/50" />
              <h3 className="mt-2 font-semibold">
                {sp.q ? "Axtarışa uyğun loyalty üzv yoxdur" :
                 sp.tier ? `${TIER_META[sp.tier as LoyaltyTier]?.ad} tier-də üzv yoxdur` :
                 "Hələ loyalty kart yoxdur"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Yeni müştəri yaradanda avtomatik loyalty kart açılır.
              </p>
              <Button asChild className="mt-3 text-white" style={{ background: "var(--brand-gradient)" }}>
                <Link href="/elaqe/musteriler?yeni=1">
                  <UserPlus className="h-3.5 w-3.5" /> Müştəri əlavə et
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">Müştəri</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Kart</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Tier</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Balans</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Qazanc / Sərf</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Son alış</th>
                      <th className="px-3 py-2.5 text-right font-semibold w-[80px]">Əməl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const tierMeta = TIER_META[m.tier as LoyaltyTier] ?? TIER_META.bronze;
                      const nextTier = getNextTier(m.tier as LoyaltyTier);
                      const progressToNext = nextTier
                        ? Math.min(100, Math.round((m.total_qazanc / TIER_META[nextTier].minSpend) * 100))
                        : 100;
                      return (
                        <tr key={m.id} className="border-b border-border/20 transition hover:bg-secondary/30">
                          <td className="px-3 py-2.5">
                            <Link href={`/elaqe/musteriler/${m.kontragent.id}`} className="font-medium hover:text-primary">
                              {m.kontragent.ad}
                            </Link>
                            {m.kontragent.telefon && (
                              <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                                <Phone className="mr-0.5 inline h-2.5 w-2.5" />{m.kontragent.telefon}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10.5px]">{m.kart_kod}</code>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <Badge variant="outline" className={cn("text-[10px]", tierMeta.reng)}>
                                {tierMeta.emoji} {tierMeta.ad}
                              </Badge>
                              {nextTier && (
                                <div className="w-16">
                                  <div className="h-0.5 overflow-hidden rounded-full bg-secondary">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                                      style={{ width: `${progressToNext}%` }}
                                    />
                                  </div>
                                  <div className="mt-0.5 text-[8.5px] text-muted-foreground">→ {TIER_META[nextTier].ad}</div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-500">
                            {formatMoney(m.balans)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[11px] tabular-nums">
                            <div className="text-emerald-500">+{formatMoney(m.total_qazanc)}</div>
                            <div className="text-rose-500">−{formatMoney(m.total_serf)}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-[10.5px] text-muted-foreground">
                            {m.son_alish_de ? formatRelativeTime(m.son_alish_de) : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/elaqe/musteriler/${m.kontragent.id}`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                                title="Profil"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                              <Link
                                href={`/kampaniyalar/kart/${m.id}/print`}
                                target="_blank"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                                title="Kart çapı"
                              >
                                <Printer className="h-3 w-3" />
                              </Link>
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
        )}
      </section>

      {/* Son əməliyyatlar */}
      {data.recentTx.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">Son 15 bonus əməliyyatı</h2>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <ul className="divide-y divide-border/40">
                {data.recentTx.map((t) => (
                  <li key={String(t.id)} className="flex items-center gap-3 px-4 py-2.5 text-xs transition hover:bg-secondary/20">
                    <div className={cn(
                      "grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[12px] font-bold",
                      t.nov === "qazandi" || t.nov === "manual_artir"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : t.nov === "expire"
                        ? "bg-rose-500/15 text-rose-500"
                        : "bg-amber-500/15 text-amber-500",
                    )}>
                      {t.nov === "qazandi" || t.nov === "manual_artir" ? "+" : "−"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {t.loyalty_cards?.kontragentler?.ad ?? "Müştəri"}
                        <span className="ml-2 text-[10px] text-muted-foreground">{t.loyalty_cards?.kart_kod}</span>
                      </div>
                      {t.qeyd && <div className="text-[10.5px] text-muted-foreground">{t.qeyd}</div>}
                    </div>
                    <div className="text-right">
                      <div className={cn("font-bold tabular-nums", Number(t.mebleg) > 0 ? "text-emerald-500" : "text-rose-500")}>
                        {Number(t.mebleg) > 0 ? "+" : ""}{formatMoney(Number(t.mebleg))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDate(t.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function getNextTier(current: LoyaltyTier): LoyaltyTier | null {
  if (current === "bronze") return "silver";
  if (current === "silver") return "gold";
  if (current === "gold") return "platinum";
  return null;
}

function KpiCard({
  icon: Icon, label, value, subline, tone,
}: {
  icon: typeof Star;
  label: string;
  value: string | number;
  subline?: string;
  tone: "violet" | "amber" | "emerald" | "sky";
}) {
  const tones = {
    violet:  { iconBg: "bg-violet-500/15 text-violet-500",   border: "border-violet-500/20" },
    amber:   { iconBg: "bg-amber-500/15 text-amber-500",     border: "border-amber-500/20" },
    emerald: { iconBg: "bg-emerald-500/15 text-emerald-500", border: "border-emerald-500/20" },
    sky:     { iconBg: "bg-sky-500/15 text-sky-500",         border: "border-sky-500/20" },
  }[tone];

  return (
    <Card className={cn("overflow-hidden border", tones.border)}>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
            {subline && <div className="text-[10px] text-muted-foreground">{subline}</div>}
          </div>
          <div className={cn("grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg", tones.iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TierCard({
  href, active, emoji, ad, count, total, bonusPct, endirimPct,
}: {
  href: string;
  active: boolean;
  emoji: string;
  ad: string;
  count: number;
  total: number;
  bonusPct?: number;
  endirimPct?: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Link href={href} className="block">
      <Card className={cn(
        "relative overflow-hidden border transition hover:-translate-y-0.5 hover:shadow-md",
        active && "ring-2 ring-primary border-primary/60",
      )}>
        <CardContent className="space-y-1.5 py-3">
          <div className="flex items-center justify-between">
            <div className="text-2xl">{emoji}</div>
            <Badge variant="outline" className="text-[10px] tabular-nums">{count}</Badge>
          </div>
          <h3 className="text-sm font-bold">{ad}</h3>
          {bonusPct !== undefined && (
            <div className="text-[10px] text-muted-foreground">
              +{bonusPct}% bonus
              {endirimPct ? ` · −${endirimPct}% endirim` : ""}
            </div>
          )}
          {total > 0 && (
            <div className="h-0.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
