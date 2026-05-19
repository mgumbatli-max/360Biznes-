import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes, ShoppingCart, CreditCard, BarChart3, Users, Sparkles,
  Store, Receipt, Bell, Shield, Database, Bot, Activity, Wallet,
  Globe, Phone,
} from "lucide-react";

export const metadata: Metadata = { title: "Funksiyalar — 360Biznes" };

const SECTIONS = [
  {
    title: "Əməliyyat və satış",
    items: [
      { icon: ShoppingCart, title: "POS satış", desc: "Sürətli kassir interfeysi, vergi kassası, kuponlar" },
      { icon: CreditCard, title: "Kart və nağd ödəniş", desc: "Bütün ödəniş üsulları, hissə-hissə satış" },
      { icon: Receipt, title: "Faktura və qaimə", desc: "Avtomatik nömrələnmə, PDF eksport" },
      { icon: Store, title: "Filiallar", desc: "Çoxlu mağaza və anbar idarəsi" },
    ],
  },
  {
    title: "Anbar və mal",
    items: [
      { icon: Boxes, title: "Anbar idarəsi", desc: "Stok, qalıqlar, transferlər, inventarizasiya" },
      { icon: Database, title: "Barkod və seriya nömrə", desc: "EAN, custom barkod, seri nömrə izi" },
      { icon: Activity, title: "Avtomatik sifariş", desc: "Min stok hədinə çatdıqda alqı tövsiyəsi" },
    ],
  },
  {
    title: "Maliyyə",
    items: [
      { icon: Wallet, title: "Kassa və bank", desc: "Çoxlu hesab, valyuta dönüşümü, mənfəət hesabı" },
      { icon: BarChart3, title: "Hesabatlar", desc: "Satış, mənfəət, rentabellik, pul axını" },
      { icon: Receipt, title: "Xərclər", desc: "Kateqoriyalı, filial üzrə, vergi göstəricisi" },
    ],
  },
  {
    title: "Müştəri və CRM",
    items: [
      { icon: Users, title: "Müştəri kartı", desc: "Tarixçə, segment, loyallıq" },
      { icon: Phone, title: "Çoxkanallı dəstək", desc: "WhatsApp, Telegram, Instagram inbox" },
      { icon: Bell, title: "Bildirişlər", desc: "Email, SMS, push, in-app" },
    ],
  },
  {
    title: "Marketplace və inteqrasiyalar",
    items: [
      { icon: Globe, title: "Marketplace sinxron", desc: "Bolt, Wolt, Yango, ProGo, Tap.az" },
      { icon: Activity, title: "Webhook", desc: "Hadisə əsaslı inteqrasiyalar" },
    ],
  },
  {
    title: "AI və avtomatlaşdırma",
    items: [
      { icon: Sparkles, title: "Claude AI köməkçi", desc: "Sualınıza canlı cavab, mənfəət təhlili" },
      { icon: Bot, title: "Auto cavab", desc: "Müştəri mesajlarına AI cavab" },
      { icon: Activity, title: "Anomali aşkarlama", desc: "Şübhəli əməliyyatları AI tutur" },
    ],
  },
  {
    title: "Təhlükəsizlik və idarəetmə",
    items: [
      { icon: Shield, title: "Rol və icazə", desc: "Granular permission matrisi" },
      { icon: Database, title: "Backup", desc: "Avtomatik və əl ilə yedək, restore" },
      { icon: Activity, title: "Audit log", desc: "Hər dəyişikliyin izi, kim, nə vaxt" },
    ],
  },
];

export default function FunksiyalarPage() {
  return (
    <div className="px-6">
      <section className="mx-auto max-w-5xl pb-10 pt-12 text-center md:pt-16">
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Biznesiniz üçün
          <span className="brand-text"> tam toolkit</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted-foreground">
          Anbardan POS-a, hesabatdan AI-ə — bütün modullar bir platformada inteqrasiya olunub.
        </p>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 pb-16">
        {SECTIONS.map((sec) => (
          <section key={sec.title}>
            <h2 className="mb-4 text-xl font-semibold">{sec.title}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sec.items.map((item) => (
                <div key={item.title} className="glass rounded-xl p-5">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary-light">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h3 className="mb-1 font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mx-auto max-w-3xl pb-20 text-center">
        <h2 className="text-2xl font-bold">Hazırsan?</h2>
        <p className="mt-2 text-sm text-muted-foreground">15 günlük pulsuz sınaq, kart məlumatı tələb olunmur.</p>
        <Link
          href="/qeydiyyat"
          className="mt-6 inline-flex rounded-md px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          Pulsuz başla
        </Link>
      </section>
    </div>
  );
}
