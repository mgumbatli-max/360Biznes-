import type { Metadata } from "next";
import Link from "next/link";
import {
  Ticket, ChevronLeft, Plus, Search, Hash, Calendar,
  UserCircle2, Sparkles, ArrowRight, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAllCoupons, getCouponStats, getCampaigns } from "@/features/kampaniyalar/queries";
import { CouponBulkDialog } from "@/features/kampaniyalar/components/coupon-bulk-dialog";
import { CouponCodeCell } from "@/features/kampaniyalar/components/coupon-code-cell";
import { CouponRowActions } from "@/features/kampaniyalar/components/coupon-row-actions";
import { cn, formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Kuponlar — promokod idarəetmə" };

type SP = { q?: string; status?: "aktiv" | "passiv" | "bitdi" | "tukenmis" };

export default async function KuponlarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const [stats, coupons, kuponCampaigns] = await Promise.all([
    getCouponStats(),
    getAllCoupons({ q: sp.q }),
    getCampaigns({ tip: "coupon" }),
  ]);

  const now = new Date();
  // İlk filter-i client-side et — status pillərinə görə.
  const filtered = coupons.filter((k) => {
    const expired = k.bitme_tarixi && new Date(k.bitme_tarixi) < now;
    const sonsuz = k.max_uses === 0 || k.max_uses == null;
    const tukenmis = !sonsuz && k.current_uses >= k.max_uses;
    if (sp.status === "aktiv") return k.aktiv && !expired && !tukenmis;
    if (sp.status === "passiv") return !k.aktiv;
    if (sp.status === "bitdi") return expired;
    if (sp.status === "tukenmis") return tukenmis;
    return true;
  });

  const aktivKampaniyalar = kuponCampaigns.filter((c) => c.status === "active");
  const draftKampaniyalar = kuponCampaigns.filter((c) => c.status !== "active");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-card to-pink-500/5 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 opacity-10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg shadow-rose-500/20">
              <Ticket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Kuponlar</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Promokod yarat, müştərilərə payla — POS-da kod yazılır, endirim avtomatik tətbiq olunur.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Link href="/kampaniyalar/yeni?tip=coupon">
              <Plus className="h-4 w-4" /> Yeni kupon kampaniyası
            </Link>
          </Button>
        </div>
      </header>

      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={Sparkles}
          label="Kupon kampaniyaları"
          value={stats.kampaniyalar}
          tone="violet"
          subline={`${aktivKampaniyalar.length} aktiv`}
        />
        <KpiTile
          icon={Hash}
          label="Cəm kupon kod"
          value={stats.total}
          tone="slate"
          subline={`${stats.aktiv} aktiv`}
        />
        <KpiTile
          icon={CheckCircle2}
          label="İstifadə sayı"
          value={stats.istifade}
          tone="emerald"
          subline="Tətbiq olunmuş"
        />
        <KpiTile
          icon={Ticket}
          label="Konversiya"
          value={stats.total > 0 ? `${Math.round((stats.istifade / stats.total) * 100)}%` : "—"}
          tone="rose"
          subline="kod / istifadə"
        />
      </section>

      {/* Aktiv kupon kampaniyaları — istifadə üçün */}
      {aktivKampaniyalar.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Aktiv kampaniyalar ({aktivKampaniyalar.length}) — kod generate et
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {aktivKampaniyalar.map((c) => (
              <CampaignTile key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      {/* Qaralama / passiv kampaniyalar */}
      {draftKampaniyalar.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Qaralama / bitmiş ({draftKampaniyalar.length})
          </h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {draftKampaniyalar.map((c) => (
              <Link
                key={c.id}
                href={`/kampaniyalar/${c.id}`}
                className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card/30 px-3 py-2 text-sm transition hover:border-primary/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{c.ikon ?? "🎟"}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.ad}</div>
                    <div className="text-[10px] text-muted-foreground">{c._count.coupons} kod</div>
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {kuponCampaigns.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20">
              <Ticket className="h-6 w-6 text-rose-500" />
            </div>
            <h3 className="mt-3 font-semibold">Hələ kupon kampaniyası yoxdur</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Yeni kupon kampaniyası yarat, endirim faizini təyin et, sonra kodlar generate edib müştərilərə payla.
            </p>
            <Button asChild className="mt-3 text-white" style={{ background: "var(--brand-gradient)" }}>
              <Link href="/kampaniyalar/yeni?tip=coupon">
                <Plus className="h-3.5 w-3.5" /> İlk kupon kampaniyası
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter + axtarış */}
      {stats.total > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterPill href="/kampaniyalar/kuponlar" active={!sp.status}>
                Hamısı ({coupons.length})
              </FilterPill>
              <FilterPill href="/kampaniyalar/kuponlar?status=aktiv" active={sp.status === "aktiv"}>
                <CheckCircle2 className="h-3 w-3" /> Aktiv ({stats.aktiv})
              </FilterPill>
              <FilterPill href="/kampaniyalar/kuponlar?status=tukenmis" active={sp.status === "tukenmis"}>
                <Hash className="h-3 w-3" /> Tükənmiş
              </FilterPill>
              <FilterPill href="/kampaniyalar/kuponlar?status=bitdi" active={sp.status === "bitdi"}>
                <Clock className="h-3 w-3" /> Bitmiş
              </FilterPill>
              <FilterPill href="/kampaniyalar/kuponlar?status=passiv" active={sp.status === "passiv"}>
                <XCircle className="h-3 w-3" /> Passiv
              </FilterPill>
            </div>

            <form className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Kod axtar..."
                className="h-9 w-[240px] rounded-lg border border-input bg-background pl-8 pr-3 font-mono text-xs uppercase placeholder:font-sans placeholder:normal-case"
              />
              {sp.status && <input type="hidden" name="status" value={sp.status} />}
            </form>
          </div>

          {/* Kupon kart-grid */}
          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {sp.q ? `«${sp.q}» tapılmadı` : "Bu filterdə kupon yoxdur"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((k) => {
                const expired = k.bitme_tarixi && new Date(k.bitme_tarixi) < now;
                const sonsuz = k.max_uses === 0 || k.max_uses == null;
                const tukenmis = !sonsuz && k.current_uses >= k.max_uses;
                const isAktiv = k.aktiv && !expired && !tukenmis;
                const usagePct = sonsuz ? 0 : Math.min(100, Math.round((k.current_uses / k.max_uses) * 100));

                return (
                  <Card
                    key={k.id}
                    className={cn(
                      "group relative overflow-hidden border transition",
                      isAktiv && "border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-md hover:shadow-emerald-500/10",
                      !isAktiv && "border-border/60 opacity-75",
                    )}
                  >
                    {/* Sol bordur */}
                    <div className={cn(
                      "absolute left-0 top-0 h-full w-1",
                      isAktiv && "bg-gradient-to-b from-emerald-500 to-teal-500",
                      tukenmis && "bg-amber-500",
                      expired && "bg-rose-500",
                      !k.aktiv && "bg-slate-400",
                    )} />

                    <CardContent className="space-y-2.5 py-3 pl-4">
                      <div className="flex items-start justify-between gap-2">
                        <CouponCodeCell kod={k.kod} dim={!isAktiv} />
                        <div className="flex items-center gap-0.5">
                          <StatusBadge isAktiv={isAktiv} tukenmis={tukenmis} expired={!!expired} passiv={!k.aktiv} />
                          <CouponRowActions couponId={k.id} aktiv={k.aktiv} />
                        </div>
                      </div>

                      {/* Kampaniya */}
                      <Link
                        href={`/kampaniyalar/${k.campaign_id}`}
                        className="flex items-center gap-1.5 text-xs hover:text-primary"
                      >
                        <span className="text-base">{k.campaigns?.ikon ?? "🎟"}</span>
                        <span className="truncate">{k.campaigns?.ad}</span>
                      </Link>

                      {/* İstifadə progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                          <span>İstifadə</span>
                          <span className="tabular-nums">
                            {k.current_uses} / {sonsuz ? "∞" : k.max_uses}
                          </span>
                        </div>
                        {!sonsuz && (
                          <div className="h-1 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                usagePct >= 100 ? "bg-amber-500" :
                                usagePct >= 60 ? "bg-amber-400" :
                                "bg-emerald-500",
                              )}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Müştəri / bitmə */}
                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10.5px] text-muted-foreground">
                        {k.kontragentler ? (
                          <Link href={`/elaqe/musteriler/${k.kontragentler.id}`} className="inline-flex items-center gap-1 hover:text-primary truncate">
                            <UserCircle2 className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">{k.kontragentler.ad}</span>
                          </Link>
                        ) : (
                          <span>👥 Hamı üçün</span>
                        )}
                        {k.bitme_tarixi ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {formatRelativeTime(k.bitme_tarixi)}
                          </span>
                        ) : (
                          <span>♾ Müddətsiz</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Köməkçi */}
      <details className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
        <summary className="cursor-pointer font-semibold">💡 Necə işləyir? (kliklə aç)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>«Yeni kupon kampaniyası» — endirim faizi (məs. 15%) və bitmə tarixini təyin et</li>
          <li>Kampaniya kartında «Kod generate et» — istədiyin qədər kod (məs. 100 ədəd) hazırlanır</li>
          <li>Kodları seç, klik et — kopyalanır. Müştərilərə SMS/Telegram ilə göndər</li>
          <li>Müştəri POS-da kodu yazır → endirim avtomatik tətbiq olunur</li>
        </ol>
      </details>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function KpiTile({
  icon: Icon, label, value, subline, tone,
}: {
  icon: typeof Ticket;
  label: string;
  value: string | number;
  subline?: string;
  tone: "violet" | "rose" | "emerald" | "slate";
}) {
  const tones = {
    violet:  { iconBg: "bg-violet-500/10 text-violet-500", valueColor: "text-violet-500" },
    rose:    { iconBg: "bg-rose-500/10 text-rose-500",     valueColor: "text-rose-500" },
    emerald: { iconBg: "bg-emerald-500/10 text-emerald-500", valueColor: "text-emerald-500" },
    slate:   { iconBg: "bg-slate-500/10 text-slate-500",   valueColor: "text-foreground" },
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={cn("mt-0.5 text-2xl font-bold tabular-nums", tones.valueColor)}>{value}</div>
            {subline && <div className="text-[10px] text-muted-foreground">{subline}</div>}
          </div>
          <div className={cn("grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg", tones.iconBg)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignTile({ c }: { c: { id: string; ad: string; ikon: string | null; tip: string; status: string; _count: { coupons: number; campaign_usage: number } } }) {
  return (
    <Card className="group relative overflow-hidden border-rose-500/20 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-rose-500/10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
      <CardContent className="space-y-2.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/kampaniyalar/${c.id}`} className="flex items-start gap-2 min-w-0 flex-1 hover:text-primary">
            <span className="text-2xl shrink-0">{c.ikon ?? "🎟"}</span>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{c.ad}</h3>
              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <span><Hash className="mr-0.5 inline h-2.5 w-2.5" />{c._count.coupons} kod</span>
                <span><CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" />{c._count.campaign_usage} istifadə</span>
              </div>
            </div>
          </Link>
        </div>
        <div className="border-t border-border/40 pt-2">
          <CouponBulkDialog campaignId={c.id} campaignName={c.ad} />
        </div>
      </CardContent>
    </Card>
  );
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ isAktiv, tukenmis, expired, passiv }: { isAktiv: boolean; tukenmis: boolean; expired: boolean; passiv: boolean }) {
  if (isAktiv) {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-[10px] dark:text-emerald-400">
        Aktiv
      </Badge>
    );
  }
  if (tukenmis) {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px] dark:text-amber-400">
        Tükənmiş
      </Badge>
    );
  }
  if (expired) {
    return (
      <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-600 text-[10px] dark:text-rose-400">
        Bitmiş
      </Badge>
    );
  }
  if (passiv) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Passiv
      </Badge>
    );
  }
  return null;
}
