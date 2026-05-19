import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = { title: "FAQ" };

const FAQS = [
  {
    q: "15 günlük demo nə qədər funksiya verir?",
    a: "Bütün modullar tamamilə açıqdır — POS, anbar, satış, maliyyə, CRM, AI köməkçi və daha çoxu. Heç bir məhdudiyyət yoxdur. 15 gün bitəndə paket seçə bilərsiniz.",
  },
  {
    q: "Kart məlumatı tələb olunurmu?",
    a: "Yox. Qeydiyyat üçün yalnız email, şirkət adı və telefon kifayətdir. Paket aldığınızda yalnız ödəniş üsulunu daxil edirsiniz.",
  },
  {
    q: "Paketdə hansı modullar daxildir?",
    a: "Başlanğıc paketdə anbar, satış, müştəri və əsas hesabatlar. Peşəkar paket marketplace inteqrasiyaları və AI funksiyaları əlavə edir. Korporativ paket limitsizdir və xüsusi dəstək verir. Detallar üçün paketlər səhifəsinə baxın.",
  },
  {
    q: "Datalarımız təhlükəsizdir?",
    a: "Bəli. Multi-tenant izolyasiya hər müştəri datasını ayrı saxlayır. Şifrələr bcrypt-12 ilə hash olunur. Bütün dəyişikliklər audit log-da qeydə alınır. Sahibkar bölməsi əlavə PIN ilə qorunur.",
  },
  {
    q: "Marketplace inteqrasiyası necə işləyir?",
    a: "Peşəkar paketdə Umico, Birmarket, Wolt və Tap kimi platformaları qoşa bilərsiniz. Stok və qiymət avtomatik sinxron olur, sifarişlər birbaşa ERP-yə düşür.",
  },
  {
    q: "Bir neçə filialım var. Hamısı tək hesabda idarə oluna bilərmi?",
    a: "Bəli. İstənilən qədər filial əlavə edə bilərsiniz. Hər filialın öz anbarı, kassası və işçiləri olur. Sahibkar bölməsində filiallar üzrə müqayisəli hesabat görəcəksiniz.",
  },
  {
    q: "POS-da hardware (skaner, çek printeri) qoşula bilərmi?",
    a: "Bəli. USB barkod skanerləri brauzerdə standart klaviatura kimi işləyir. Çek printeri üçün thermal printer dəstəklənir (80mm). Detallı bələdçi sənədləşmədə var.",
  },
  {
    q: "Subscription bitsə dataya nə olacaq?",
    a: "Data 30 gün ərzində saxlanılır. Bu dövrdə yenidən aktivləşdirsəniz hər şey qaytarılır. 30 gündən sonra anonimləşdirilir (audit qaydalarına uyğun).",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 pb-20 pt-12">
      <header className="text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--brand-gradient)" }}>
          <HelpCircle className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Tez-tez verilən suallar</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Cavabını tapa bilmədiyiniz sual varsa bizə yazın.
        </p>
      </header>

      <div className="space-y-3">
        {FAQS.map((f, i) => (
          <details key={i} className="group rounded-xl border border-border bg-card/40 p-4 transition open:bg-card/60">
            <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
              <span className="font-medium">{f.q}</span>
              <span className="text-muted-foreground transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="rounded-2xl border border-primary/30 p-6 text-center" style={{ background: "linear-gradient(135deg, hsl(239 84% 67% / 0.12), hsl(262 83% 67% / 0.08))" }}>
        <p className="text-sm">Sualınız hələ də var?</p>
        <a href="mailto:salam@360biznes.az" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-light hover:underline">
          salam@360biznes.az <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
