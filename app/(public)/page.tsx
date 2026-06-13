import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Check, ShoppingCart, Boxes, Wallet, Users, Globe, Bot,
  Wrench, BarChart3, ShieldCheck, Sparkles, Clock, TrendingUp, Gauge,
  CheckSquare, UserCog, Gift, Star, PlayCircle,
} from "lucide-react";
import { DEEP_MESH, GRID_OVERLAY, SectionHead, PublicFooter } from "@/components/public/ui";

export const metadata: Metadata = {
  title: "360Biznes — Bir platformada bütün biznesiniz",
  description:
    "Satış/POS, anbar, maliyyə, CRM, tapşırıq, HR, marketplace və AI köməkçi — biznesinizin hər prosesi tək platformada. 15 günlük pulsuz demo, kart tələb olunmur.",
};

const MODULES = [
  {
    icon: ShoppingCart, title: "Satış & POS", color: "from-emerald-400 to-teal-500",
    items: ["Sürətli kassir (POS)", "Qaimə, faktura, kupon", "Kart · nağd · hissəli ödəniş", "Marketdən satış"],
  },
  {
    icon: Boxes, title: "Anbar & Mal", color: "from-teal-400 to-cyan-500",
    items: ["Stok, qalıq, transfer", "Barkod & seriya nömrə", "İnventarizasiya", "Min stokda auto-sifariş"],
  },
  {
    icon: Wallet, title: "Maliyyə", color: "from-emerald-400 to-green-500",
    items: ["Kassa & bank, valyuta", "Mənfəət (P&L), pul axını", "Xərclər, ƏDV", "Debitor / kreditor borc"],
  },
  {
    icon: Users, title: "CRM & Müştəri", color: "from-teal-400 to-emerald-500",
    items: ["Müştəri kartı & segment", "WhatsApp · Telegram · Instagram", "Broadcast & şablonlar", "Loyallıq, follow-up"],
  },
  {
    icon: CheckSquare, title: "Tapşırıq & Layihə", color: "from-cyan-400 to-teal-500",
    items: ["Komanda tapşırıqları", "Layihə & mərhələ izləmə", "AI tapşırıq analizi", "Şablon & statistika"],
  },
  {
    icon: UserCog, title: "İşçilər & HR", color: "from-emerald-400 to-teal-400",
    items: ["Əməkdaş kartı & rol", "Maaş & bordro", "Davamiyyət · məzuniyyət", "KPI & performans"],
  },
  {
    icon: Globe, title: "Marketplace", color: "from-cyan-400 to-emerald-500",
    items: ["Bolt, Wolt, Yango", "ProGo, Tap.az sinxron", "Avto-poster", "Webhook sifarişlər"],
  },
  {
    icon: Bot, title: "AI & Avtomatlaşdırma", color: "from-teal-400 to-emerald-400",
    items: ["Claude AI biznes köməkçi", "Müştəriyə auto-cavab", "Anomali aşkarlama", "Trigger → əməliyyat qaydaları"],
  },
  {
    icon: Wrench, title: "Servis & Zəmanət", color: "from-teal-500 to-emerald-400",
    items: ["Servis qəbulu & SLA", "Zəmanət izləmə", "Problemli məhsul", "Müştəri track linki"],
  },
  {
    icon: Gift, title: "Kampaniya & Loyallıq", color: "from-emerald-400 to-green-500",
    items: ["Endirim & kampaniya", "Hədiyyə kartı", "Loyallıq proqramı", "Hədəf & bonus"],
  },
  {
    icon: BarChart3, title: "Hesabat & Analitika", color: "from-green-400 to-emerald-500",
    items: ["Satış, marja, rentabellik", "Saat × gün heatmap", "KPI & hədəflər", "Filial müqayisəsi"],
  },
  {
    icon: ShieldCheck, title: "Nəzarət & Təhlükəsizlik", color: "from-teal-400 to-cyan-400",
    items: ["Nəzarət mərkəzi & anomali", "Təsdiq axını (approval)", "Audit log — kim, nə vaxt", "Rol/icazə · multi-tenant"],
  },
];

const BENEFITS = [
  {
    icon: Clock, title: "Vaxtınıza qənaət edin",
    text: "5 ayrı proqram əvəzinə tək sistem. Anbar, satış, maliyyə, HR və CRM bir-biri ilə avtomatik danışır — manual köçürmə və Excel cədvəlləri tarixə qovuşur.",
  },
  {
    icon: TrendingUp, title: "Gəlirinizi artırın",
    text: "AI marja analizi və ölü-stok aşkarlama ilə hansı məhsulun qazandırdığını, hansının zərər verdiyini dəqiq görün. Doğru qərar — artan mənfəət.",
  },
  {
    icon: Gauge, title: "Hər şeyə tam nəzarət",
    text: "Hər filial, hər kassir, hər tapşırıq və hər manat — real vaxtda. İstənilən cihazdan biznesinizin nəbzini tutun, audit log ilə hər addımı izləyin.",
  },
  {
    icon: Sparkles, title: "AI ilə qabaqda olun",
    text: "Claude AI biznesinizi təhlil edir, suallarınıza canlı cavab verir, şübhəli əməliyyatları tutur. Sanki yanınızda 7/24 işləyən analitik komanda.",
  },
];

const STATS = [
  { value: "12", label: "inteqrasiya olunmuş modul" },
  { value: "60+", label: "hazır funksiya" },
  { value: "5+", label: "marketplace inteqrasiyası" },
  { value: "∞", label: "filial & istifadəçi" },
];

const MARKETPLACES = ["Bolt", "Wolt", "Yango", "ProGo", "Tap.az", "WhatsApp", "Telegram", "Instagram"];

export default function HomePage() {
  return (
    <>
      {/* ============ HERO — dərin mesh ============ */}
      <section className="relative isolate overflow-hidden text-white" style={DEEP_MESH}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={GRID_OVERLAY} />
        <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-40 h-96 w-96 rounded-full bg-teal-300/15 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 text-center md:pb-24 md:pt-20">
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            Satış · Anbar · Maliyyə · HR · CRM — hamısı bir sistemdə
          </div>

          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Bütün biznesiniz —
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
              {" "}bir platformada{" "}
            </span>
            idarə olunur
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-white/80">
            Satışdan anbara, maliyyədən komandaya, tapşırıqdan hesabata — 360Biznes biznesinizin
            hər prosesini tək, sürətli və ağıllı sistemdə birləşdirir. Daha çox proqram yox — daha çox nəzarət.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/qeydiyyat"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-emerald-950 shadow-2xl shadow-black/20 transition hover:scale-[1.02] hover:bg-emerald-50">
              15 gün pulsuz başla
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
              <PlayCircle className="h-4 w-4" />
              Canlı demo
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/65">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" /> Kart tələb olunmur</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" /> 5 dəqiqəyə qurulum</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-300" /> İstənilən vaxt ləğv</span>
          </div>

          <DashboardPreview />
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10 bg-black/15 backdrop-blur">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-6 py-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-black tracking-tight text-white md:text-4xl">{s.value}</div>
                <div className="mt-1 text-xs text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ NƏ QAZANIRSINIZ ============ */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <SectionHead
          kicker="Niyə 360Biznes?"
          title="Qeydiyyatdan keçəndə nə qazanırsınız"
          sub="Sadəcə proqram deyil — biznesinizi böyütmək üçün komanda yoldaşı."
        />
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="group glass flex gap-4 rounded-2xl p-6 transition hover:border-primary/40">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary-light transition group-hover:scale-105">
                <b.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ MODULLAR (12 — tam) ============ */}
      <section className="relative overflow-hidden border-y border-border bg-secondary/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHead
            kicker="12 modul · 1 sistem"
            title="Biznesinizin hər tərəfi bir yerdə"
            sub="POS-dan HR-a, tapşırıqdan AI-ə qədər — bütün modullar bir-birinə bağlı işləyir. Heç bir əlavə proqrama ehtiyac yoxdur."
          />
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.title} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${m.color} text-white shadow-lg`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold">{m.title}</h3>
                <ul className="mt-3 space-y-1.5">
                  {m.items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-light" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ AI spotlight ============ */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-border p-8 text-white md:p-14" style={DEEP_MESH}>
          <div aria-hidden className="pointer-events-none absolute inset-0" style={GRID_OVERLAY} />
          <div className="relative grid items-center gap-8 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-200 backdrop-blur">
                <Bot className="h-3.5 w-3.5" /> Claude AI daxilində
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                Süni intellekt biznesinizi <span className="text-emerald-300">sizinlə birlikdə</span> idarə edir
              </h2>
              <p className="mt-4 max-w-md text-white/80">
                «Bu ay hansı məhsul ən çox qazandırdı?» — sadəcə soruşun. AI hesabatlarınızı
                təhlil edir, anomaliyaları tutur, müştərilərə avtomatik cavab verir.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-white/85">
                {["Canlı dildə biznes sualları", "Avtomatik anomali siqnalı", "Müştəri mesajlarına AI cavab", "Mənfəət & marja tövsiyələri"].map((x) => (
                  <li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" /> {x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" /> AI köməkçi
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-white/15 px-4 py-2.5">Bu həftə ən çox zərər verən məhsul hansıdır?</div>
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-emerald-400/20 px-4 py-2.5 ring-1 ring-emerald-300/30">
                  «Adapter X» — 12 ədəd satıldı, lakin maya artımı səbəbindən marja −4%. Qiyməti 8% qaldırmağı tövsiyə edirəm.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ İnteqrasiyalar ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-20 text-center md:pb-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Sevdiyiniz platformalarla inteqrasiya
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {MARKETPLACES.map((m) => (
            <span key={m} className="glass rounded-full px-5 py-2 text-sm font-semibold text-foreground/80">{m}</span>
          ))}
        </div>
      </section>

      {/* ============ Final CTA ============ */}
      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center text-white md:py-20" style={DEEP_MESH}>
          <div aria-hidden className="pointer-events-none absolute inset-0" style={GRID_OVERLAY} />
          <div className="relative">
            <div className="mx-auto mb-4 flex items-center justify-center gap-1 text-emerald-300">
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}
            </div>
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-black tracking-tight md:text-4xl">
              Biznesinizi bu gün növbəti səviyyəyə qaldırın
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              15 günlük tam funksiyalı pulsuz demo. Kart məlumatı tələb olunmur, istənilən vaxt ləğv edə bilərsiniz.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/qeydiyyat"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-emerald-950 shadow-2xl shadow-black/25 transition hover:scale-[1.02]">
                Pulsuz başla
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/paketler"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-8 py-3.5 text-sm font-semibold backdrop-blur transition hover:bg-white/10">
                Paketləri gör
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </>
  );
}

function DashboardPreview() {
  const bars = [38, 62, 45, 78, 56, 90, 70];
  return (
    <div className="relative mx-auto mt-14 max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="rounded-xl bg-emerald-950/40 p-4 ring-1 ring-white/10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Bu gün satış", v: "₼ 24,580", d: "+12%", icon: TrendingUp },
              { l: "Aktiv sifariş", v: "37", d: "+5", icon: ShoppingCart },
              { l: "Anbar dəyəri", v: "₼ 312k", d: "3,476", icon: Boxes },
              { l: "Net mənfəət", v: "₼ 8,140", d: "+9%", icon: Wallet },
            ].map((k) => (
              <div key={k.l} className="rounded-lg bg-white/5 p-3 text-left ring-1 ring-white/10">
                <div className="flex items-center justify-between text-white/50">
                  <k.icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold text-emerald-300">{k.d}</span>
                </div>
                <div className="mt-2 text-lg font-bold text-white">{k.v}</div>
                <div className="text-[10px] text-white/50">{k.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/70">Həftəlik satış trendi</span>
              <span className="text-[10px] text-white/40">Son 7 gün</span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-2">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-emerald-500/40 to-emerald-300/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
