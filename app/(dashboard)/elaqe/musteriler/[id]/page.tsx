import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  ShoppingCart,
  Truck,
  CircleDollarSign,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Wrench,
  Star,
  Activity,
  Heart,
  RotateCcw,
  RouteIcon,
  UserPlus,
  AlertTriangle,
  BarChart3,
  Package,
  Layers,
  FileText,
} from "lucide-react";
import { getServisHistoryForCustomer } from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS } from "@/features/servis/types";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactDialog } from "@/features/elaqe/components/contact-dialog";
import { MenecerAssignInline } from "@/features/elaqe/components/menecer-assign-inline";
import { PaymentDialog } from "@/features/elaqe/components/payment-dialog";
import { NisyePaymentQuick } from "@/features/maliyye/components/nisye-payment-quick";
import { getOpenSalesForCustomer, getQuickRefs } from "@/features/maliyye/queries";
import { FollowupDialog } from "@/features/elaqe/components/followup-dialog";
import { NotesTab } from "@/features/elaqe/components/notes-tab";
import { TagsManager } from "@/features/elaqe/components/tags-manager";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import {
  getContactDetail,
  getManagers,
  getContactNotes,
  getContactCommunications,
  getContactFollowups,
  getContactFinanceOps,
  getContactTags,
} from "@/features/elaqe/queries";
import {
  getContactSalesHistory,
  getContactPurchaseHistory,
  getContactStats,
  getContactDebtTimeline,
  getCustomer360Kpis,
  getCustomerHealthScore,
  getCustomerJourney,
  getCustomerSalesStats,
  getContactDocuments,
} from "@/features/elaqe/detail-queries";
import { SenedTab } from "@/features/elaqe/components/sened-tab";
import { ObjectTasksTab } from "@/features/tapshiriqlar/components/object-tasks-tab";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Kontragent detayı" };
export const dynamic = "force-dynamic";

function CardSkeleton({ h = 120 }: { h?: number }) {
  return <Skeleton style={{ height: h }} className="w-full rounded-xl" />;
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Header üçün minimum lazım olan iki sorğu — onsuz nə tip, nə ad göstərə bilərik.
  // Hər şey paralel: detail + stats (KPI üçün), digər widget-lər öz Suspense-lərində.
  const [c, stats, managers, quickRefs, openSales] = await Promise.all([
    getContactDetail(id),
    getContactStats(id),
    getManagers(),
    getQuickRefs(),
    getOpenSalesForCustomer(id, 50),
  ]);
  if (!c) notFound();

  const isSupplier = c.nov === "techizatci" || c.nov === "her_ikisi";
  const isCustomer = c.nov === "musteri" || c.nov === "her_ikisi";
  const unpaid = stats.sales_total - stats.sales_paid;
  const supplierDebt = stats.purchase_total - stats.purchase_paid;
  const initials = c.ad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const borc = Number(c.borc ?? 0);
  const avgTicket = stats.sales_count > 0 ? stats.sales_total / stats.sales_count : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback={isCustomer ? "/elaqe/musteriler" : "/elaqe/techizatcilar"} className="mt-1" />
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-base font-semibold">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{c.ad}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">
                  {c.nov === "her_ikisi" ? "Hər ikisi" : c.nov === "musteri" ? "Müştəri" : "Təchizatçı"}
                </Badge>
                {c.qiymet_tipi && c.qiymet_tipi !== "adi" && (
                  <Badge variant="outline" className="text-[10px] capitalize">{c.qiymet_tipi}</Badge>
                )}
                <MenecerAssignInline
                  kontragentId={c.id}
                  currentManagerId={c.menecer_id ?? null}
                  currentManagerAd={c.istifadeciler?.ad_soyad ?? null}
                  managers={managers}
                />
                {!c.aktiv && <Badge variant="outline" className="text-[10px]">passiv</Badge>}
                {c.qara_siyahi && <Badge variant="outline" className="text-[10px] text-danger">qara siyahı</Badge>}
                {isCustomer && (
                  <Suspense fallback={null}>
                    <HealthRiskBadge id={id} />
                  </Suspense>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {borc > 0 && (
            <NisyePaymentQuick
              musteriId={c.id}
              ad={c.ad}
              borc={borc}
              hesablar={quickRefs.hesablar}
              openSales={openSales}
              variant="gradient"
            />
          )}
          {borc > 0 && <PaymentDialog kontragentId={c.id} ad={c.ad} maxAmount={borc} variant="button" />}
          <FollowupDialog contacts={[]} defaultKontragentId={c.id} />
          <ContactDialog
            defaultNov={c.nov === "techizatci" ? "techizatci" : "musteri"}
            initial={{
              id: c.id,
              nov: c.nov,
              ad: c.ad,
              voen: c.voen,
              fin_kod: c.fin_kod,
              telefon: c.telefon,
              email: c.email,
              unvan: c.unvan,
              sirket_adi: c.sirket_adi,
              sheher: c.sheher,
              borc: Number(c.borc ?? 0),
              aktiv: c.aktiv ?? true,
              yaradildi: c.yaradildi,
              qiymet_tipi: c.qiymet_tipi ?? null,
              borc_limiti: c.borc_limiti === null ? null : Number(c.borc_limiti),
              son_temas: c.son_temas,
              qara_siyahi: c.qara_siyahi ?? false,
              funnel_status: c.funnel_status,
              menecer_ad: c.istifadeciler?.ad_soyad ?? null,
            }}
            trigger="edit"
            managers={managers}
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={CircleDollarSign}
          label="Borc balansı"
          value={formatMoney(Math.abs(borc))}
          subline={borc > 0 ? "Bizə borcludur" : borc < 0 ? "Biz borcluyuq" : "Sıfır"}
          tone={borc > 0 ? "warning" : borc < 0 ? "danger" : "neutral"}
        />
        {isCustomer && (
          <>
            <KpiCard
              icon={ShoppingCart}
              label="Cəm satış"
              value={String(stats.sales_count)}
              subline={formatMoney(stats.sales_total)}
              tone="success"
            />
            <KpiCard icon={TrendingUp} label="Orta çek" value={formatMoney(avgTicket)} subline="Sifariş başına" />
            <KpiCard
              icon={CircleDollarSign}
              label="Ödənilməyən"
              value={formatMoney(Math.max(0, unpaid))}
              subline="Müştəri borcu"
              tone={unpaid > 0 ? "warning" : "neutral"}
            />
          </>
        )}
        {!isCustomer && isSupplier && (
          <>
            <KpiCard icon={Truck} label="Cəm alış" value={String(stats.purchase_count)} subline={formatMoney(stats.purchase_total)} />
            <KpiCard icon={CircleDollarSign} label="Ödəyilmiş" value={formatMoney(stats.purchase_paid)} subline="Onlara" tone="success" />
            <KpiCard
              icon={CircleDollarSign}
              label="Borc qaldıq"
              value={formatMoney(Math.max(0, supplierDebt))}
              subline="Ödənməli"
              tone={supplierDebt > 0 ? "warning" : "neutral"}
            />
          </>
        )}
      </section>

      {isCustomer && (
        <Suspense
          fallback={
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
              <CardSkeleton h={160} />
              <CardSkeleton h={160} />
            </section>
          }
        >
          <Customer360Section id={id} />
        </Suspense>
      )}

      {isCustomer && (
        <Suspense fallback={<CardSkeleton h={140} />}>
          <SalesStatsSection id={id} />
        </Suspense>
      )}

      <Tabs defaultValue="umumi">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="umumi">Ümumi</TabsTrigger>
          {isCustomer && <TabsTrigger value="satislar">Satışlar ({stats.sales_count})</TabsTrigger>}
          {isSupplier && <TabsTrigger value="alislar">Alışlar ({stats.purchase_count})</TabsTrigger>}
          {isCustomer && <TabsTrigger value="servis">Servis</TabsTrigger>}
          <TabsTrigger value="maliyye">Borc / Ödəniş</TabsTrigger>
          {isCustomer && <TabsTrigger value="sefer">Səfər</TabsTrigger>}
          <TabsTrigger value="qeyd">Qeyd</TabsTrigger>
          <TabsTrigger value="followup">Follow-up</TabsTrigger>
          <TabsTrigger value="elaqe">Əlaqə tarixçəsi</TabsTrigger>
          <TabsTrigger value="tapshiriqlar">Tapşırıqlar</TabsTrigger>
          <TabsTrigger value="sened">
            <FileText className="h-3 w-3" /> Sənəd
          </TabsTrigger>
          <TabsTrigger value="tag">Tag</TabsTrigger>
        </TabsList>

        <TabsContent value="umumi" className="pt-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Əlaqə</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {c.telefon && (
                  <Row icon={Phone} value={c.telefon}>
                    <a href={`tel:${c.telefon}`} className="ml-2 text-xs text-primary-light hover:underline">Zəng</a>
                    <a
                      href={`https://wa.me/${c.telefon.replace(/\D+/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-success hover:underline"
                    >
                      <MessageCircle className="inline h-3 w-3" /> WhatsApp
                    </a>
                  </Row>
                )}
                {c.telefon2 && <Row icon={Phone} value={c.telefon2} />}
                {c.email && (
                  <Row icon={Mail} value={c.email}>
                    <a href={`mailto:${c.email}`} className="ml-2 text-xs text-primary-light hover:underline">Email yaz</a>
                  </Row>
                )}
                {c.voen && <Row label="VÖEN" value={c.voen} mono />}
                {c.fin_kod && <Row label="FİN" value={c.fin_kod} mono />}
                {c.sirket_adi && <Row label="Şirkət" value={c.sirket_adi} />}
                {(c.sheher || c.olke) && <Row icon={MapPin} value={[c.sheher, c.olke].filter(Boolean).join(", ")} />}
                {c.unvan && <Row icon={MapPin} value={c.unvan} />}
                {c.son_temas && (
                  <Row icon={CalendarClock} value={`Son əlaqə: ${formatDate(c.son_temas)}`} />
                )}
                {c.yaradildi && (
                  <div className="border-t border-border/40 pt-2 text-xs text-muted-foreground">
                    <CalendarClock className="inline h-3 w-3" /> Yaradılıb: {formatDate(c.yaradildi)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Maliyyə</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Qiymət tipi" value={c.qiymet_tipi ?? "adi"} />
                <Row label="Borc limiti" value={c.borc_limiti !== null ? formatMoney(Number(c.borc_limiti)) : "limitsiz"} />
                <Row label="Borc balansı" value={formatMoney(borc)} />
                {c.valyuta && <Row label="Valyuta" value={c.valyuta} />}
                {c.funnel_status && <Row label="Funnel" value={c.funnel_status} />}
                {c.qeyd && (
                  <div className="border-t border-border/40 pt-2 text-xs whitespace-pre-line text-muted-foreground">
                    {c.qeyd}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isCustomer && (
          <TabsContent value="satislar" className="pt-3">
            <Suspense fallback={<CardSkeleton h={400} />}>
              <SalesTabSection id={id} />
            </Suspense>
          </TabsContent>
        )}

        {isSupplier && (
          <TabsContent value="alislar" className="pt-3">
            <Suspense fallback={<CardSkeleton h={400} />}>
              <PurchasesTabSection id={id} />
            </Suspense>
          </TabsContent>
        )}

        {isCustomer && (
          <TabsContent value="servis" className="pt-3">
            <Suspense fallback={<CardSkeleton h={400} />}>
              <ServisTabSection id={id} />
            </Suspense>
          </TabsContent>
        )}

        <TabsContent value="maliyye" className="pt-3">
          <Suspense fallback={<CardSkeleton h={400} />}>
            <MaliyyeTabSection id={id} />
          </Suspense>
        </TabsContent>

        {isCustomer && (
          <TabsContent value="sefer" className="pt-3">
            <Suspense fallback={<CardSkeleton h={400} />}>
              <SeferTabSection id={id} />
            </Suspense>
          </TabsContent>
        )}

        <TabsContent value="qeyd" className="pt-3">
          <Suspense fallback={<CardSkeleton h={300} />}>
            <NotesTabSection id={c.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="followup" className="pt-3">
          <Suspense fallback={<CardSkeleton h={300} />}>
            <FollowupTabSection id={id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="elaqe" className="pt-3">
          <Suspense fallback={<CardSkeleton h={300} />}>
            <CommsTabSection id={id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="tapshiriqlar" className="pt-3">
          <ObjectTasksTab obyektNov="musteri" obyektId={c.id} obyektBasliq={c.ad} />
        </TabsContent>

        <TabsContent value="sened" className="pt-3">
          <Suspense fallback={<CardSkeleton h={200} />}>
            <SenedTabSection id={c.id} />
          </Suspense>
        </TabsContent>

        <TabsContent value="tag" className="pt-3">
          <Suspense fallback={<CardSkeleton h={200} />}>
            <TagsTabSection id={c.id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function HealthRiskBadge({ id }: { id: string }) {
  const health = await getCustomerHealthScore(id);
  if (!health.is_risk) return null;
  return (
    <Badge variant="outline" className="border-rose-400/40 bg-rose-400/10 text-[10px] text-rose-300">
      <AlertTriangle className="h-3 w-3" /> Risk müştəri
    </Badge>
  );
}

async function Customer360Section({ id }: { id: string }) {
  const [kpis360, health] = await Promise.all([
    getCustomer360Kpis(id),
    getCustomerHealthScore(id),
  ]);
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Customer 360°</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi360 label="LTV" value={formatMoney(kpis360.ltv)} tone="emerald" />
            <Kpi360 label="Cəmi satış" value={String(kpis360.sales_count)} tone="sky" />
            <Kpi360 label="Borc" value={formatMoney(Math.abs(kpis360.borc))} tone={kpis360.borc > 0 ? "amber" : "neutral"} />
            <Kpi360 label="Son alış (gün)" value={kpis360.son_alish_gun === null ? "—" : `${kpis360.son_alish_gun}g`} tone={kpis360.son_alish_gun !== null && kpis360.son_alish_gun > 90 ? "rose" : "neutral"} />
            <Kpi360 label="Ortalama çek" value={formatMoney(kpis360.avg_check)} tone="violet" />
            <Kpi360 label="NPS / Reyting" value={kpis360.nps !== null ? `${kpis360.nps}` : "—"} tone="cyan" />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Health score</CardTitle>
          <Heart className={`h-4 w-4 ${health.is_risk ? "text-rose-400" : health.score >= 70 ? "text-emerald-400" : "text-amber-400"}`} />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-bold tabular-nums ${health.is_risk ? "text-rose-400" : health.score >= 70 ? "text-emerald-400" : "text-amber-400"}`}>{health.score}</span>
            <span className="text-xs text-muted-foreground pb-1">/ 100</span>
            {health.is_risk && (
              <span className="ml-auto text-[10.5px] font-semibold text-rose-300">RİSK</span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className={`h-full transition-all ${health.is_risk ? "bg-rose-500" : health.score >= 70 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${health.score}%` }}
            />
          </div>
          <ul className="space-y-1 pt-1 text-[10.5px]">
            {health.factors.map((f) => (
              <li key={f.label} className="flex items-center justify-between text-muted-foreground">
                <span>{f.label} <span className="opacity-60">({f.weight}%)</span></span>
                <span className="tabular-nums font-medium text-foreground">{f.score}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

async function SalesStatsSection({ id }: { id: string }) {
  const salesStats = await getCustomerSalesStats(id);
  return (
    <Card className="glass">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Satış statistikası</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <SalesStatBox
            icon={ShoppingCart}
            label="Satış sayı"
            value={String(salesStats.sales_count)}
            subline={`Cəm: ${formatMoney(salesStats.sales_total)}`}
            tone="sky"
          />
          <SalesStatBox
            icon={TrendingUp}
            label="Ortalama çek"
            value={formatMoney(salesStats.avg_check)}
            subline="Sifariş başına"
            tone="violet"
          />
          <SalesStatBox
            icon={CalendarClock}
            label="Son satış"
            value={salesStats.last_sale_at ? formatDate(salesStats.last_sale_at) : "—"}
            subline={
              salesStats.last_sale_days_ago !== null
                ? `${salesStats.last_sale_days_ago} gün əvvəl`
                : "—"
            }
            tone={
              salesStats.last_sale_days_ago !== null && salesStats.last_sale_days_ago > 90
                ? "rose"
                : "emerald"
            }
          />
          <SalesStatBox
            icon={Layers}
            label="Ən çox kateqoriya"
            value={salesStats.top_category?.ad ?? "—"}
            subline={salesStats.top_category ? `${salesStats.top_category.sayi} satır` : "—"}
            tone="amber"
          />
          <SalesStatBox
            icon={Package}
            label="Ən sevdiyi məhsul"
            value={salesStats.top_product?.ad ?? "—"}
            subline={salesStats.top_product ? `${salesStats.top_product.sayi} satır` : "—"}
            tone="cyan"
          />
          <SalesStatBox
            icon={salesStats.yoy_delta_pct !== null && salesStats.yoy_delta_pct < 0 ? TrendingDown : TrendingUp}
            label="Bu il vs Keçən il"
            value={
              salesStats.yoy_delta_pct === null
                ? "—"
                : `${salesStats.yoy_delta_pct > 0 ? "+" : ""}${salesStats.yoy_delta_pct}%`
            }
            subline={`${formatMoney(salesStats.bu_il_total)} / ${formatMoney(salesStats.kechen_il_total)}`}
            tone={
              salesStats.yoy_delta_pct === null
                ? "neutral"
                : salesStats.yoy_delta_pct >= 0
                  ? "emerald"
                  : "rose"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

async function SalesTabSection({ id }: { id: string }) {
  const sales = await getContactSalesHistory(id, 50);
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Satış tarixçəsi</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sales.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Satış yoxdur</p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            {sales.map((s) => (
              <Link
                key={s.id}
                href={`/ticaret/satislar/${s.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40"
              >
                <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-medium">{s.nomre}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(s.tarix)} · {s._count.satis_sifaris_satirlari} sətr · {s.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums font-semibold">{formatMoney(Number(s.son_mebleg ?? 0))}</div>
                  {Number(s.odenilmis ?? 0) < Number(s.son_mebleg ?? 0) && (
                    <div className="text-[10.5px] text-warning">
                      Qalıq: {formatMoney(Number(s.son_mebleg ?? 0) - Number(s.odenilmis ?? 0))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function PurchasesTabSection({ id }: { id: string }) {
  const purchases = await getContactPurchaseHistory(id, 50);
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Alış tarixçəsi</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {purchases.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Alış yoxdur</p>
        ) : (
          <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-medium">{p.nomre}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(p.tarix)} · {p.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums font-semibold">{formatMoney(Number(p.umumi_mebleg ?? 0))}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function ServisTabSection({ id }: { id: string }) {
  const servis = await getServisHistoryForCustomer(id);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Cəmi servis</div>
            <div className="mt-1 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-sky-400" />
              <span className="text-xl font-bold tabular-nums">{servis.stats.total}</span>
              {servis.stats.loyal && (
                <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-300">
                  <Star className="h-3 w-3" /> VIP
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Aktiv</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{servis.stats.acig}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Ortalama qiymət</div>
            <div className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(servis.stats.ortalama_qiymet)}
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="py-3">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Son servis</div>
            <div className="mt-1 text-sm font-medium">
              {servis.stats.son_servis ? formatDate(servis.stats.son_servis) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass mt-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Servis tarixçəsi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {servis.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Servis qeydi yoxdur.</p>
          ) : (
            <div className="divide-y divide-border/30 max-h-[600px] overflow-y-auto">
              {servis.rows.map((r) => {
                const meta = SERVIS_STATUS_LABELS[r.status] ?? { label: r.status, cls: "" };
                return (
                  <Link
                    key={r.id}
                    href={`/servis/${r.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40"
                  >
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">{r.nomre}</span>
                        <Badge variant="outline" className={meta.cls}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.mehsul_ad} · {r.yaradildi ? formatDate(r.yaradildi) : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums font-semibold">{formatMoney(r.musteriden_alinan)}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        xərc: {formatMoney(r.temir_xerci)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

async function MaliyyeTabSection({ id }: { id: string }) {
  const [debtTimeline, finOps] = await Promise.all([
    getContactDebtTimeline(id, 150),
    getContactFinanceOps(id),
  ]);
  return (
    <>
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Borc / Ödəniş xronologiyası</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {debtTimeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hələ əməliyyat yoxdur</p>
          ) : (
            (() => {
              const sorted = [...debtTimeline].sort((a, b) => a.ts.getTime() - b.ts.getTime());
              let run = 0;
              const withBalance = sorted.map((e) => {
                run += e.delta;
                return { ...e, balance: run };
              });
              const display = withBalance.slice().reverse();
              return (
                <div className="divide-y divide-border/30 max-h-[640px] overflow-y-auto">
                  {display.map((e, i) => {
                    const dotClass = e.delta > 0 ? "bg-warning" : e.delta < 0 ? "bg-success" : "bg-muted-foreground";
                    const amount = e.delta > 0 ? `+${formatMoney(Math.abs(e.delta))}` : e.delta < 0 ? `−${formatMoney(Math.abs(e.delta))}` : "—";
                    const amtClass = e.delta > 0 ? "text-warning" : e.delta < 0 ? "text-success" : "";
                    return (
                      <div key={`${e.kind}-${e.ref_id ?? i}-${i}`} className="relative flex items-start gap-3 px-4 py-2.5 text-sm">
                        <div className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {e.kind === "sale" && e.ref_id ? (
                              <Link href={`/ticaret/satislar/${e.ref_id}`} className="font-medium hover:text-primary-light">
                                {e.label}
                              </Link>
                            ) : (
                              <span className="font-medium">{e.label}</span>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {e.kind === "sale" ? "satış"
                                : e.kind === "purchase" ? "alış"
                                : e.kind === "payment_in" ? "bizə ödəniş"
                                : e.kind === "payment_out" ? "bizdən ödəniş"
                                : "qaytarma"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(e.ts)} · Cəmi: {formatMoney(e.mebleg)}
                            {e.qeyd ? ` · ${e.qeyd}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`tabular-nums font-semibold ${amtClass}`}>{amount}</div>
                          <div className="text-[10px] text-muted-foreground">Qalıq: {formatMoney(e.balance)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      {finOps.length > 0 && (
        <Card className="glass mt-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Maliyyə əməliyyatları (xam)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {finOps.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-4 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{f.type_kod}</div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {formatDate(f.tarix)}{f.qeyd ? ` · ${f.qeyd}` : ""}
                    </div>
                  </div>
                  <div className={`text-right tabular-nums font-semibold ${f.y_n === "daxil" ? "text-success" : f.y_n === "xaric" ? "text-warning" : ""}`}>
                    {f.y_n === "daxil" ? "+" : f.y_n === "xaric" ? "-" : ""}{formatMoney(Number(f.meblegh))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

async function SeferTabSection({ id }: { id: string }) {
  const journey = await getCustomerJourney(id, 200);
  return (
    <Card className="glass">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <RouteIcon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Müştəri səfəri</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {journey.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Hələ hadisə yoxdur</p>
        ) : (
          <div className="relative px-4 py-3">
            <div className="absolute left-[26px] top-3 bottom-3 w-px bg-border/40" />
            <ul className="space-y-3">
              {journey.map((e, i) => {
                const meta = JOURNEY_META[e.kind];
                const Icon = meta.icon;
                return (
                  <li key={`${e.kind}-${e.ref_id ?? i}-${i}`} className="relative flex items-start gap-3 pl-1">
                    <div className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border ${meta.cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-2 text-sm">
                        {e.kind === "sale" && e.ref_id ? (
                          <Link href={`/ticaret/satislar/${e.ref_id}`} className="font-medium hover:text-primary-light">
                            {e.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{e.title}</span>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(e.ts)}{e.subtitle ? ` · ${e.subtitle}` : ""}
                      </div>
                    </div>
                    {e.amount !== null && (
                      <div className="text-right text-sm font-semibold tabular-nums">
                        {formatMoney(e.amount)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function NotesTabSection({ id }: { id: string }) {
  const notes = await getContactNotes(id);
  return <NotesTab kontragentId={id} initialNotes={notes} />;
}

async function FollowupTabSection({ id }: { id: string }) {
  const followups = await getContactFollowups(id);
  return (
    <Card className="glass">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Follow-up tarixçəsi</CardTitle>
        <FollowupDialog contacts={[]} defaultKontragentId={id} />
      </CardHeader>
      <CardContent className="p-0">
        {followups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Follow-up yoxdur</p>
        ) : (
          <div className="divide-y divide-border/30">
            {followups.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{f.basliq}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(f.vaxt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {f.istifadeciler_contact_followups_istifadeci_idToistifadeciler?.ad_soyad
                      ? ` · ${f.istifadeciler_contact_followups_istifadeci_idToistifadeciler.ad_soyad}`
                      : ""}
                  </div>
                  {f.qeyd && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{f.qeyd}</div>}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {f.status === "tamamlandi" ? "Tamamlandı" : "Gözləyir"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function CommsTabSection({ id }: { id: string }) {
  const comms = await getContactCommunications(id);
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Əlaqə tarixçəsi</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {comms.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Əlaqə qeydi yoxdur</p>
        ) : (
          <div className="divide-y divide-border/30">
            {comms.map((co) => (
              <div key={String(co.id)} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{co.m_vzu ?? co.kanal}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(co.yaradildi)} · {co.istifadeciler?.ad_soyad ?? "Sistem"}
                  </span>
                </div>
                {co.metn && <div className="mt-0.5 text-xs text-muted-foreground whitespace-pre-line">{co.metn}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function SenedTabSection({ id }: { id: string }) {
  const documents = await getContactDocuments(id);
  return <SenedTab kontragentId={id} initial={documents} />;
}

async function TagsTabSection({ id }: { id: string }) {
  const tagLinks = await getContactTags(id);
  const tags = tagLinks.map((tl) => ({
    id: tl.id,
    tagId: tl.contact_tags.id,
    ad: tl.contact_tags.ad,
    reng: tl.contact_tags.reng,
    emoji: tl.contact_tags.emoji,
  }));
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tag idarəetməsi</CardTitle>
      </CardHeader>
      <CardContent>
        <TagsManager kontragentId={id} tags={tags} />
      </CardContent>
    </Card>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  value: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
      {label && <span className="text-xs text-muted-foreground">{label}:</span>}
      <span className={`flex-1 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
      {children}
    </div>
  );
}

const KPI_TONE: Record<string, string> = {
  emerald: "text-emerald-300",
  sky: "text-sky-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  violet: "text-violet-300",
  cyan: "text-cyan-300",
  neutral: "text-foreground",
};

function Kpi360({ label, value, tone = "neutral" }: { label: string; value: string; tone?: keyof typeof KPI_TONE }) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${KPI_TONE[tone] ?? KPI_TONE.neutral}`}>{value}</div>
    </div>
  );
}

function SalesStatBox({
  icon: Icon,
  label,
  value,
  subline,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subline?: string;
  tone?: keyof typeof KPI_TONE;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 truncate text-sm font-bold ${KPI_TONE[tone] ?? KPI_TONE.neutral}`}>
        {value}
      </div>
      {subline && (
        <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{subline}</div>
      )}
    </div>
  );
}

const JOURNEY_META: Record<
  "lead" | "sale" | "return" | "servis" | "elaqe" | "payment_in" | "payment_out",
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  lead: { label: "Lead", icon: UserPlus, cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  sale: { label: "Satış", icon: ShoppingCart, cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  return: { label: "Qaytarma", icon: RotateCcw, cls: "border-rose-400/40 bg-rose-400/10 text-rose-300" },
  servis: { label: "Servis", icon: Wrench, cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  elaqe: { label: "Əlaqə", icon: MessageCircle, cls: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  payment_in: { label: "Daxil ödəniş", icon: Activity, cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  payment_out: { label: "Xaric ödəniş", icon: Activity, cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
};
