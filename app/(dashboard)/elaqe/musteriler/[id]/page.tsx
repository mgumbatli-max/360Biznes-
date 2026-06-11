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
  Copy,
  MessageSquare,
  Plus,
  Sparkles,
  Building2,
  Globe,
  CreditCard,
  Banknote,
  ReceiptText,
  CalendarPlus,
} from "lucide-react";
import { getServisHistoryForCustomer } from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS } from "@/features/servis/types";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabsUrlSync } from "@/components/ui/tabs-url-sync";
import { TimelinePeekButton } from "@/features/elaqe/components/timeline-peek-drawer";
import { CustomerJourneyClient } from "@/features/elaqe/components/customer-journey-client";
import { ContactDialog } from "@/features/elaqe/components/contact-dialog";
import { MenecerAssignInline } from "@/features/elaqe/components/menecer-assign-inline";
import { PaymentDialog } from "@/features/elaqe/components/payment-dialog";
import { NisyePaymentQuick } from "@/features/maliyye/components/nisye-payment-quick";
import { getOpenSalesForCustomer, getQuickRefs } from "@/features/maliyye/queries";
import { FollowupDialog } from "@/features/elaqe/components/followup-dialog";
import { CustomerLoyaltyPanel } from "@/features/kampaniyalar/components/customer-loyalty-panel";
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
import { CopyInlineBtn } from "@/features/elaqe/components/copy-inline-btn";
import { ObjectTasksTab } from "@/features/tapshiriqlar/components/object-tasks-tab";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Kontragent detayı" };

function CardSkeleton({ h = 120 }: { h?: number }) {
  return <Skeleton style={{ height: h }} className="w-full rounded-xl" />;
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Bu səhifə həm /elaqe/musteriler/[id] həm də /elaqe/techizatcilar/[id] üçün işləyir.
  // Master `elaqe.oxu` + (musteri.oxu və ya techizatci.oxu) yoxlanır.
  const { requireElaqePerm } = await import("@/features/elaqe/access-guard");
  const { icazeler, isOwnerOrAdmin } = await requireElaqePerm();
  if (
    !isOwnerOrAdmin &&
    !icazeler.includes("musteri.oxu") &&
    !icazeler.includes("techizatci.oxu")
  ) {
    const { redirect } = await import("next/navigation");
    redirect("/elaqe");
  }

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
  // SOURCE OF TRUTH: aktiv sənədlərdən hesablanmış real qaliq.
  // `kontragentler.alacaq` / `borc` cache field-ləridir, yenidən hesablanır
  // hər mutate-da. Burada birbaşa real datadan oxuyuruq ki, drift olmasın.
  const customerBorc = isCustomer ? Math.max(0, unpaid) : 0;
  const supplierBorcVal = isSupplier ? Math.max(0, supplierDebt) : 0;
  const borc = isCustomer ? customerBorc : supplierBorcVal;
  const avans = Number(c.avans ?? 0);
  const avgTicket = stats.sales_count > 0 ? stats.sales_total / stats.sales_count : 0;

  // Hero gradient (müştəri vs təchizatçı vs hər ikisi)
  const heroGradient = isCustomer && !isSupplier
    ? "from-emerald-500/15 via-sky-500/10 to-violet-500/5"
    : !isCustomer && isSupplier
      ? "from-rose-500/15 via-orange-500/10 to-amber-500/5"
      : "from-violet-500/15 via-fuchsia-500/10 to-rose-500/5";
  const avatarGradient = isCustomer && !isSupplier
    ? "from-emerald-500 to-sky-500"
    : !isCustomer && isSupplier
      ? "from-rose-500 to-orange-500"
      : "from-violet-500 to-fuchsia-500";
  const phoneDigits = (c.telefon ?? "").replace(/[^0-9+]/g, "");
  const waDigits = phoneDigits.replace(/[^0-9]/g, "");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* === HERO HEADER === */}
      <section className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${heroGradient} p-5 shadow-sm`}>
        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BackButton fallback={isCustomer ? "/elaqe/musteriler" : "/elaqe/techizatcilar"} className="mt-1" />
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${avatarGradient} text-xl font-bold text-white shadow-lg`}>
                  {initials}
                </div>
                {isCustomer && (
                  <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-background shadow-md">
                    <Suspense fallback={<Heart className="h-3 w-3 text-muted-foreground" />}>
                      <HealthScoreIcon id={id} />
                    </Suspense>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <h1 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl">
                  {c.ad}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="outline" className="border-foreground/20 bg-background/60 backdrop-blur-sm">
                    {c.nov === "her_ikisi" ? "🤝 Hər ikisi" : c.nov === "musteri" ? "👤 Müştəri" : "🚛 Təchizatçı"}
                  </Badge>
                  {c.qiymet_tipi && c.qiymet_tipi !== "adi" && (
                    <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-600 capitalize dark:text-violet-300">
                      <Star className="h-3 w-3" /> {c.qiymet_tipi}
                    </Badge>
                  )}
                  <MenecerAssignInline
                    kontragentId={c.id}
                    currentManagerId={c.menecer_id ?? null}
                    currentManagerAd={c.istifadeciler?.ad_soyad ?? null}
                    managers={managers}
                  />
                  {!c.aktiv && (
                    <Badge variant="outline" className="border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground">
                      passiv
                    </Badge>
                  )}
                  {c.qara_siyahi && (
                    <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300">
                      <AlertTriangle className="h-3 w-3" /> qara siyahı
                    </Badge>
                  )}
                  {isCustomer && (
                    <Suspense fallback={null}>
                      <HealthRiskBadge id={id} />
                    </Suspense>
                  )}
                </div>

                {/* Quick info row — modern compact */}
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {c.telefon && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.telefon}
                    </span>
                  )}
                  {c.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {c.email}
                    </span>
                  )}
                  {c.sheher && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {[c.sheher, c.olke].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {c.voen && (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Building2 className="h-3 w-3" /> VÖEN: {c.voen}
                    </span>
                  )}
                  {c.son_temas && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Son əlaqə: {formatDate(c.son_temas)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === QUICK ACTION BAR === */}
        <div className="relative mt-5 flex flex-wrap items-center gap-1.5">
          {/* COMMUNICATION */}
          {phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              title="Zəng et"
              className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-600 transition hover:scale-105 hover:bg-emerald-500/15 dark:text-emerald-300"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Zəng</span>
            </a>
          )}
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 text-xs font-medium text-green-600 transition hover:scale-105 hover:bg-green-500/15 dark:text-green-300"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              title="Email göndər"
              className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 text-xs font-medium text-sky-600 transition hover:scale-105 hover:bg-sky-500/15 dark:text-sky-300"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Email</span>
            </a>
          )}
          {phoneDigits && (
            <a
              href={`sms:${phoneDigits}`}
              title="SMS"
              className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 text-xs font-medium text-violet-600 transition hover:scale-105 hover:bg-violet-500/15 dark:text-violet-300"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">SMS</span>
            </a>
          )}

          {/* Vertical divider */}
          <div className="mx-1 hidden h-6 w-px bg-border md:block" />

          {/* BUSINESS ACTIONS */}
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
          {/* QA-K(Ödəniş): "Ödəniş al" yalnız müştəri borcu üçündür — pure
              təchizatçıda göstərilən borc bizim ona borcumuzdur, recordContactPayment
              onu səhvən MƏDAXİL kimi yazır. Təchizatçıya ödəniş Maliyyə → Kreditor
              axını ilə gedir (server də techizatci-ni bloklayır). her_ikisi-də borc
              müştəri qalığıdır (isCustomer branch), ona görə müştəri ödənişi düzgündür. */}
          {borc > 0 && isCustomer && <PaymentDialog kontragentId={c.id} ad={c.ad} maxAmount={borc} variant="button" />}

          {isCustomer && (
            <Link
              href={`/ticaret/satis-yeni?musteri=${c.id}`}
              title="Yeni satış"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:scale-105 hover:bg-primary/15"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Yeni satış</span>
            </Link>
          )}

          <FollowupDialog contacts={[]} defaultKontragentId={c.id} />

          <Link
            href={isSupplier && !isCustomer
              ? `/elaqe/techizatcilar/${c.id}/hesab-cixaris`
              : `/elaqe/musteriler/${c.id}/hesab-cixaris`}
            title="Hesab çıxarışı"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium backdrop-blur-sm transition hover:scale-105 hover:bg-secondary"
          >
            <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Hesab çıxarışı</span>
          </Link>

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
      </section>

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

      {/* Loyalty kart paneli — sadiqlik bonusu, tier, son əməliyyatlar */}
      {isCustomer && (
        <Suspense fallback={<CardSkeleton h={180} />}>
          <CustomerLoyaltyPanel kontragentId={id} />
        </Suspense>
      )}

      <TabsUrlSync defaultValue="umumi">
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
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* === ƏLAQƏ MƏLUMATLARI === */}
            <Card className="glass overflow-hidden border-sky-500/20 lg:col-span-2">
              <CardHeader className="pb-3 bg-gradient-to-r from-sky-500/5 to-transparent">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
                    <Phone className="h-3.5 w-3.5" />
                  </div>
                  Əlaqə məlumatları
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {c.telefon && (
                  <InfoRow
                    icon={Phone}
                    label="Telefon"
                    value={c.telefon}
                    actions={[
                      { href: `tel:${phoneDigits}`, label: "Zəng", icon: Phone, tone: "emerald" },
                      ...(waDigits ? [{ href: `https://wa.me/${waDigits}`, label: "WA", icon: MessageCircle, tone: "green" as const, target: "_blank" }] : []),
                    ]}
                    copyable
                  />
                )}
                {c.telefon2 && (
                  <InfoRow
                    icon={Phone}
                    label="Telefon 2"
                    value={c.telefon2}
                    actions={[{ href: `tel:${c.telefon2.replace(/[^0-9+]/g, "")}`, label: "Zəng", icon: Phone, tone: "emerald" }]}
                    copyable
                  />
                )}
                {c.email && (
                  <InfoRow
                    icon={Mail}
                    label="Email"
                    value={c.email}
                    actions={[{ href: `mailto:${c.email}`, label: "Yaz", icon: Mail, tone: "sky" }]}
                    copyable
                  />
                )}
                {c.voen && <InfoRow icon={Building2} label="VÖEN" value={c.voen} mono copyable />}
                {c.fin_kod && <InfoRow icon={Building2} label="FİN" value={c.fin_kod} mono copyable />}
                {c.sirket_adi && <InfoRow icon={Building2} label="Şirkət" value={c.sirket_adi} />}
                {(c.sheher || c.olke) && (
                  <InfoRow
                    icon={MapPin}
                    label={c.olke ?? "Şəhər"}
                    value={[c.sheher, c.olke].filter(Boolean).join(", ")}
                  />
                )}
                {c.unvan && <InfoRow icon={MapPin} label="Ünvan" value={c.unvan} copyable />}
                {c.son_temas && (
                  <InfoRow icon={CalendarClock} label="Son əlaqə" value={formatDate(c.son_temas)} />
                )}
                {c.yaradildi && (
                  <InfoRow icon={Sparkles} label="Yaradılıb" value={formatDate(c.yaradildi)} />
                )}
              </CardContent>
            </Card>

            {/* === MALİYYƏ MƏLUMATLARI === */}
            <Card className={`glass overflow-hidden ${borc > 0 ? "border-amber-500/30" : "border-emerald-500/20"}`}>
              <CardHeader className={`pb-3 ${borc > 0 ? "bg-gradient-to-r from-amber-500/5" : "bg-gradient-to-r from-emerald-500/5"} to-transparent`}>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className={`grid h-7 w-7 place-items-center rounded-lg ${borc > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"}`}>
                    <CircleDollarSign className="h-3.5 w-3.5" />
                  </div>
                  Maliyyə
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Big balance display */}
                <div className="text-center py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {borc > 0
                      ? isCustomer
                        ? "Müştəri borcu"
                        : "Bizim borcumuz"
                      : "Borc balansı"}
                  </div>
                  <div className={`mt-1 text-3xl font-bold tabular-nums ${borc > 0 ? (isCustomer ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400") : "text-foreground"}`}>
                    {formatMoney(borc)}
                  </div>
                  {avans > 0 && (
                    <div className="mt-1 text-[11px] text-violet-600 dark:text-violet-400">
                      Avans: {formatMoney(avans)}
                    </div>
                  )}
                  {borc > 0 && (
                    <div className="mt-2 flex justify-center gap-1.5">
                      <NisyePaymentQuick
                        musteriId={c.id}
                        ad={c.ad}
                        borc={borc}
                        hesablar={quickRefs.hesablar}
                        openSales={openSales}
                        variant="gradient"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 border-t border-border/40 pt-3">
                  <InfoMiniRow label="Qiymət tipi" value={(c.qiymet_tipi ?? "adi").toUpperCase()} />
                  <InfoMiniRow
                    label="Kredit limiti"
                    value={c.borc_limiti !== null ? formatMoney(Number(c.borc_limiti)) : "limitsiz"}
                    badge={
                      c.borc_limiti !== null && borc > Number(c.borc_limiti)
                        ? { text: "AŞIB", tone: "rose" }
                        : undefined
                    }
                  />
                  {c.valyuta && <InfoMiniRow label="Valyuta" value={c.valyuta} />}
                  {c.funnel_status && <InfoMiniRow label="Funnel" value={c.funnel_status} />}
                </div>

                {c.qeyd && (
                  <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-2.5 text-[11px] whitespace-pre-line text-muted-foreground">
                    <span className="font-semibold text-foreground">📝 Qeyd: </span>
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
              <SeferTabSection id={id} customerName={c.ad} />
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
      </TabsUrlSync>
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

async function HealthScoreIcon({ id }: { id: string }) {
  const health = await getCustomerHealthScore(id);
  const cls =
    health.is_risk
      ? "text-rose-500"
      : health.score >= 70
        ? "text-emerald-500"
        : "text-amber-500";
  return <Heart className={`h-3.5 w-3.5 ${cls}`} fill="currentColor" />;
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
  const [debtTimeline, finOps, openInvoices] = await Promise.all([
    getContactDebtTimeline(id, 150),
    getContactFinanceOps(id),
    getOpenSalesForCustomer(id, 100),
  ]);

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const openWithAge = openInvoices.map((s) => {
    const tarix = s.tarix instanceof Date ? s.tarix : new Date(s.tarix);
    return { ...s, tarix, gun: Math.max(0, Math.floor((now - tarix.getTime()) / DAY)) };
  });
  const totalOpen = openWithAge.reduce((sum, s) => sum + s.qalig, 0);
  const overdueCount = openWithAge.filter((s) => s.gun >= 30).length;

  return (
    <>
      {/* Açıq qaimələr */}
      <Card className="glass">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Açıq qaimələr ({openWithAge.length})</CardTitle>
          </div>
          <div className="text-[10.5px] text-muted-foreground">
            Cəmi borc: <span className="font-bold tabular-nums text-rose-600">{formatMoney(totalOpen)}</span>
            {overdueCount > 0 && (
              <span className="ml-2">· Gecikmiş: <span className="font-semibold text-amber-700">{overdueCount}</span></span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {openWithAge.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Açıq qaimə yoxdur — bütün borc bağlıdır 🎉</p>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 bg-secondary/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Qaimə №</th>
                    <th className="px-3 py-2">Tarix</th>
                    <th className="px-3 py-2 text-right">Cəmi</th>
                    <th className="px-3 py-2 text-right">Ödənilib</th>
                    <th className="px-3 py-2 text-right">Qalıq</th>
                    <th className="px-3 py-2 text-right">Gün</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Əməl</th>
                  </tr>
                </thead>
                <tbody>
                  {openWithAge.map((s) => {
                    const ageTone =
                      s.gun >= 90 ? "text-rose-600 font-bold" :
                      s.gun >= 30 ? "text-amber-600 font-semibold" :
                      "text-muted-foreground";
                    const odenilmis = s.son_mebleg - s.qalig;
                    const statusBadge = odenilmis > 0
                      ? <Badge variant="outline" className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-700">Qismən</Badge>
                      : <Badge variant="outline" className="text-[10px] border-rose-500/40 bg-rose-500/10 text-rose-700">Açıq</Badge>;
                    return (
                      <tr key={s.id} className="border-b border-border/30 hover:bg-secondary/30">
                        <td className="px-3 py-2 font-mono text-[11px]">
                          <Link href={`/ticaret/satislar/${s.id}`} className="hover:text-primary">{s.nomre}</Link>
                        </td>
                        <td className="px-3 py-2 text-xs">{formatDate(s.tarix)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(s.son_mebleg)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{formatMoney(odenilmis)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-rose-600">{formatMoney(s.qalig)}</td>
                        <td className={`px-3 py-2 text-right text-xs tabular-nums ${ageTone}`}>{s.gun}</td>
                        <td className="px-3 py-2">{statusBadge}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/ticaret/satislar/${s.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-secondary"
                            >
                              Bax
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-border/40 bg-secondary/30 text-xs">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 font-semibold">Cəmi açıq ({openWithAge.length})</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-600">{formatMoney(totalOpen)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass mt-3">
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

async function SeferTabSection({ id, customerName }: { id: string; customerName: string }) {
  const journey = await getCustomerJourney(id, 500);
  // Tarixləri ISO string-ə çevir client-ə ötür
  const items = journey.map((j) => ({
    ts: (j.ts instanceof Date ? j.ts : new Date(j.ts)).toISOString(),
    kind: j.kind,
    title: j.title,
    subtitle: j.subtitle,
    amount: j.amount,
    ref_id: j.ref_id,
    meta: j.meta,
  }));
  return (
    <Card className="glass">
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <RouteIcon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Müştəri səfəri</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <CustomerJourneyClient customerName={customerName} items={items} />
      </CardContent>
    </Card>
  );
}

// Köhnə dolu UI — istinad üçün, artıq client komponentə köçdü
async function _OldSeferTabSection_unused({ id }: { id: string }) {
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
                const m = e.meta;
                const href = m?.href ?? (e.kind === "sale" && e.ref_id ? `/ticaret/satislar/${e.ref_id}` : null);
                const isPayment = e.kind === "payment_in" || e.kind === "payment_out";
                const isSale = e.kind === "sale";
                return (
                  <li key={`${e.kind}-${e.ref_id ?? i}-${i}`} className="relative flex items-start gap-3 pl-1">
                    <div className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border ${meta.cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {href ? (
                          <Link href={href} className="font-medium hover:text-primary-light">{e.title}</Link>
                        ) : (
                          <span className="font-medium">{e.title}</span>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                        {/* Satış üçün status badge */}
                        {isSale && m && m.qalig != null && m.qalig > 0.01 && (
                          <Badge variant="outline" className="text-[10px] border-rose-500/40 bg-rose-500/10 text-rose-700">
                            Qalıq: {formatMoney(m.qalig)}
                          </Badge>
                        )}
                        {isSale && m && m.qalig != null && m.qalig <= 0.01 && Number(m.odenilmis ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
                            Tam ödənilib
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(e.ts)}{e.subtitle ? ` · ${e.subtitle}` : ""}
                      </div>
                      {/* Satış məhsulları */}
                      {isSale && m?.products && m.products.length > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                          📦 {m.products.slice(0, 3).join(", ")}
                        </div>
                      )}
                      {/* Ödəniş bağlandığı qaimələr */}
                      {isPayment && m?.bound_invoices && m.bound_invoices.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                          <span className="text-muted-foreground">Bağlandı:</span>
                          {m.bound_invoices.slice(0, 3).map((nomre, j) => (
                            <span key={j} className="rounded border border-emerald-300 bg-emerald-50 px-1 py-0.5 font-mono font-medium text-emerald-700">
                              {nomre}
                            </span>
                          ))}
                          {m.bound_invoices.length > 3 && (
                            <span className="text-muted-foreground">+{m.bound_invoices.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {e.amount !== null && (
                        <div className={`text-right text-sm font-semibold tabular-nums ${
                          isPayment
                            ? (e.kind === "payment_in" ? "text-emerald-600" : "text-rose-600")
                            : isSale && m?.qalig != null && m.qalig > 0.01
                              ? "text-rose-600"
                              : "text-foreground"
                        }`}>
                          {isPayment && e.kind === "payment_in" ? "+" : ""}
                          {isPayment && e.kind === "payment_out" ? "-" : ""}
                          {formatMoney(e.amount)}
                        </div>
                      )}
                      {/* Action — peek drawer (yeni səhifə yox, eyni səhifədə qısa baxış) */}
                      {(e.kind === "sale" || e.kind === "payment_in" || e.kind === "payment_out" || e.kind === "return" || e.kind === "servis") && e.ref_id ? (
                        <TimelinePeekButton
                          kind={e.kind}
                          refId={e.ref_id}
                          fullPageHref={href ?? null}
                        />
                      ) : href ? (
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] hover:bg-secondary"
                        >
                          Bax
                        </Link>
                      ) : null}
                    </div>
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

type ActionTone = "emerald" | "green" | "sky" | "violet";

function InfoRow({
  icon: Icon,
  label,
  value,
  actions,
  mono,
  copyable,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  actions?: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }>; tone: ActionTone; target?: string }>;
  mono?: boolean;
  copyable?: boolean;
}) {
  const toneCls: Record<ActionTone, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-300",
    green: "border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/15 dark:text-green-300",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-600 hover:bg-sky-500/15 dark:text-sky-300",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-600 hover:bg-violet-500/15 dark:text-violet-300",
  };
  return (
    <div className="group flex items-start gap-2.5 rounded-lg border border-border/40 bg-background/40 p-2 hover:border-border/80 hover:bg-background/80">
      <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-secondary/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-0.5 truncate text-xs font-medium text-foreground ${mono ? "font-mono" : ""}`}>
          {value}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        {actions?.map((a) => {
          const A = a.icon;
          return (
            <a
              key={a.label}
              href={a.href}
              target={a.target}
              rel={a.target === "_blank" ? "noopener noreferrer" : undefined}
              title={a.label}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${toneCls[a.tone]} transition hover:scale-110`}
            >
              <A className="h-3 w-3" />
            </a>
          );
        })}
        {copyable && <CopyValueButton value={value} />}
      </div>
    </div>
  );
}

function InfoMiniRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: { text: string; tone: "rose" | "amber" | "emerald" };
}) {
  const badgeCls = badge
    ? {
        rose: "border-rose-500/40 bg-rose-500/10 text-rose-600",
        amber: "border-amber-500/40 bg-amber-500/10 text-amber-600",
        emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
      }[badge.tone]
    : "";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-medium tabular-nums text-foreground">{value}</span>
        {badge && (
          <Badge variant="outline" className={`px-1 py-0 text-[9px] ${badgeCls}`}>
            {badge.text}
          </Badge>
        )}
      </div>
    </div>
  );
}

function CopyValueButton({ value }: { value: string }) {
  return <CopyInlineBtn value={value} />;
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
