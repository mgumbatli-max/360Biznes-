import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes, ShoppingCart, CreditCard, BarChart3, Users, Sparkles, Store,
  Receipt, Bell, Shield, Database, Bot, Activity, Wallet, Globe, Phone,
  CheckSquare, FolderKanban, UserCog, CalendarClock, Wallet2, Award,
  Gift, Percent, Wrench, ShieldAlert, ClipboardCheck, History, ArrowRight,
} from "lucide-react";
import { MeshHero, PublicFooter } from "@/components/public/ui";

export const metadata: Metadata = {
  title: "Funksiyalar — 360Biznes",
  description: "POS, anbar, maliyyə, tapşırıq, HR, CRM, marketplace, AI və daha çoxu — 12 modul, 60+ funksiya bir platformada.",
};

const SECTIONS = [
  {
    title: "Əməliyyat & Satış",
    items: [
      { icon: ShoppingCart, title: "POS satış", desc: "Sürətli kassir, klaviatura kısayolları, kupon" },
      { icon: CreditCard, title: "Kart, nağd, hissəli", desc: "Bütün ödəniş üsulları, qarışıq ödəniş" },
      { icon: Receipt, title: "Faktura & qaimə", desc: "Avtomatik nömrələnmə, PDF, çap" },
      { icon: Store, title: "Çoxlu filial", desc: "Hər filialın öz anbarı, kassası, işçiləri" },
    ],
  },
  {
    title: "Anbar & Mal",
    items: [
      { icon: Boxes, title: "Anbar idarəsi", desc: "Stok, qalıq, transfer, inventarizasiya" },
      { icon: Database, title: "Barkod & seriya", desc: "EAN, custom barkod, seriya nömrə izi" },
      { icon: Activity, title: "Auto-sifariş", desc: "Min stok hədinə çatanda alqı tövsiyəsi" },
    ],
  },
  {
    title: "Maliyyə",
    items: [
      { icon: Wallet, title: "Kassa & bank", desc: "Çoxlu hesab, valyuta, gün sonu" },
      { icon: BarChart3, title: "Mənfəət (P&L)", desc: "Gəlir−xərc, marja, EBITDA, pul axını" },
      { icon: Receipt, title: "Xərclər & ƏDV", desc: "Kateqoriyalı, filial üzrə, vergi" },
      { icon: Wallet2, title: "Debitor / kreditor", desc: "Borc izləmə, avto-xatırlatma" },
    ],
  },
  {
    title: "Tapşırıq & Layihə",
    items: [
      { icon: CheckSquare, title: "Komanda tapşırıqları", desc: "Təyinat, son tarix, status, prioritet" },
      { icon: FolderKanban, title: "Layihə idarəsi", desc: "Mərhələ, bağlantı, irəliləyiş" },
      { icon: Bot, title: "AI tapşırıq analizi", desc: "Yükün bölüşdürülməsi, gecikmə riski" },
      { icon: Activity, title: "Şablon & statistika", desc: "Təkrar tapşırıqlar, performans" },
    ],
  },
  {
    title: "İşçilər & HR",
    items: [
      { icon: UserCog, title: "Əməkdaş kartı", desc: "Profil, rol, icazə, sənədlər" },
      { icon: Wallet2, title: "Maaş & bordro", desc: "Hesablama, bonus, bordro çapı" },
      { icon: CalendarClock, title: "Davamiyyət & məzuniyyət", desc: "Giriş-çıxış, məzuniyyət balansı" },
      { icon: Award, title: "KPI & performans", desc: "Hədəf, satış nəticəsi, reytinq" },
    ],
  },
  {
    title: "Müştəri & CRM",
    items: [
      { icon: Users, title: "Müştəri kartı", desc: "Tarixçə, segment, loyallıq" },
      { icon: Phone, title: "Çoxkanallı inbox", desc: "WhatsApp, Telegram, Instagram bir yerdə" },
      { icon: Bell, title: "Broadcast & bildiriş", desc: "Toplu mesaj, email, SMS, push" },
    ],
  },
  {
    title: "Kampaniya & Loyallıq",
    items: [
      { icon: Percent, title: "Endirim & kampaniya", desc: "Vaxtlı aksiyalar, kupon, qaydalar" },
      { icon: Gift, title: "Hədiyyə kartı", desc: "Satış, qaliq, çap, izləmə" },
      { icon: Award, title: "Loyallıq proqramı", desc: "Bal, bonus, müştəri hədəfi" },
    ],
  },
  {
    title: "Marketplace & İnteqrasiya",
    items: [
      { icon: Globe, title: "Marketplace sinxron", desc: "Bolt, Wolt, Yango, ProGo, Tap.az" },
      { icon: Store, title: "Avto-poster", desc: "Məhsulları platformalara avtomatik yerləşdir" },
      { icon: Activity, title: "Webhook & API", desc: "Hadisə əsaslı inteqrasiyalar" },
    ],
  },
  {
    title: "AI & Avtomatlaşdırma",
    items: [
      { icon: Sparkles, title: "Claude AI köməkçi", desc: "Canlı biznes sualları, mənfəət təhlili" },
      { icon: Bot, title: "Auto cavab", desc: "Müştəri mesajlarına AI cavab" },
      { icon: Activity, title: "Anomali aşkarlama", desc: "Şübhəli əməliyyatları AI tutur" },
      { icon: Activity, title: "Trigger qaydaları", desc: "Hadisə → avtomatik əməliyyat" },
    ],
  },
  {
    title: "Servis & Zəmanət",
    items: [
      { icon: Wrench, title: "Servis qəbulu & SLA", desc: "Qəbul, status, vaxt hədləri" },
      { icon: Shield, title: "Zəmanət izləmə", desc: "Müddət, qeydiyyat, müştəri track" },
      { icon: ShieldAlert, title: "Problemli məhsul", desc: "Defekt, qaytarma, statistika" },
    ],
  },
  {
    title: "Hesabat & Analitika",
    items: [
      { icon: BarChart3, title: "Satış & marja hesabatları", desc: "Trend, YoY, top məhsul/satıcı" },
      { icon: Activity, title: "Saat × gün heatmap", desc: "Pik vaxtlar, boş slotlar" },
      { icon: Award, title: "KPI & hədəflər", desc: "Filial müqayisəsi, hədəf izləmə" },
    ],
  },
  {
    title: "Nəzarət & Təhlükəsizlik",
    items: [
      { icon: ShieldAlert, title: "Nəzarət mərkəzi", desc: "Real-time anomali, risk siqnalları" },
      { icon: ClipboardCheck, title: "Təsdiq axını", desc: "Endirim, xərc, əməliyyat təsdiqi" },
      { icon: Shield, title: "Rol & icazə", desc: "Granular permission matrisi" },
      { icon: History, title: "Audit log & backup", desc: "Hər dəyişikliyin izi, avto yedək" },
    ],
  },
];

export default function FunksiyalarPage() {
  return (
    <>
      <MeshHero
        badge="12 modul · 60+ funksiya"
        title={<>Biznesiniz üçün <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">tam toolkit</span></>}
        sub="Anbardan POS-a, tapşırıqdan HR-a, hesabatdan AI-ə — bütün modullar bir platformada inteqrasiya olunub."
      >
        <Link href="/qeydiyyat" className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-emerald-950 shadow-2xl shadow-black/20 transition hover:scale-[1.02]">
          Pulsuz başla <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </MeshHero>

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-16 md:py-20">
        {SECTIONS.map((sec) => (
          <section key={sec.title}>
            <h2 className="mb-5 flex items-center gap-3 text-xl font-bold">
              <span className="h-5 w-1 rounded-full" style={{ background: "var(--brand-gradient)" }} />
              {sec.title}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sec.items.map((item) => (
                <div key={item.title} className="group rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary-light transition group-hover:scale-105">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <h2 className="text-2xl font-black tracking-tight">Hamısını 15 gün pulsuz sınayın</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Kart məlumatı tələb olunmur. Bütün modullar açıq.</p>
        <Link href="/qeydiyyat" className="mt-6 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]" style={{ background: "var(--brand-gradient)", boxShadow: "var(--brand-glow)" }}>
          Pulsuz başla <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <PublicFooter />
    </>
  );
}
