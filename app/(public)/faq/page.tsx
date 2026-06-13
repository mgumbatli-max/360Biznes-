import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { MeshHero, PublicFooter } from "@/components/public/ui";

export const metadata: Metadata = { title: "FAQ — 360Biznes" };

const FAQS = [
  {
    q: "15 günlük demo nə qədər funksiya verir?",
    a: "Bütün 12 modul tamamilə açıqdır — POS, anbar, satış, maliyyə, CRM, tapşırıq, HR, AI köməkçi və daha çoxu. Heç bir məhdudiyyət yoxdur. 15 gün bitəndə paket seçə bilərsiniz.",
  },
  {
    q: "Kart məlumatı tələb olunurmu?",
    a: "Xeyr. Qeydiyyat üçün yalnız email, şirkət adı və telefon kifayətdir. Paket aldığınızda yalnız ödəniş üsulunu daxil edirsiniz.",
  },
  {
    q: "Tapşırıq və əməkdaş idarəçiliyi necə işləyir?",
    a: "Komandanıza tapşırıq təyin edin, son tarix və prioritet qoyun, AI iş yükünü təhlil etsin. HR modulunda əməkdaş kartı, maaş/bordro, davamiyyət, məzuniyyət və KPI izlənir — hamısı satış nəticələri ilə bağlı.",
  },
  {
    q: "Biznesimə tam nəzarəti necə əldə edirəm?",
    a: "Nəzarət mərkəzi real vaxtda anomaliyaları və riskləri göstərir. Təsdiq axını ilə endirim/xərc kimi həssas əməliyyatlar icazə tələb edir. Audit log hər dəyişikliyi kim, nə vaxt etdiyi ilə qeydə alır.",
  },
  {
    q: "Paketdə hansı modullar daxildir?",
    a: "Başlanğıc paketdə anbar, satış, müştəri və əsas hesabatlar. Peşəkar paket marketplace inteqrasiyaları, AI, tapşırıq və HR funksiyalarını əlavə edir. Korporativ paket limitsizdir və xüsusi dəstək verir.",
  },
  {
    q: "Datalarımız təhlükəsizdir?",
    a: "Bəli. Multi-tenant izolyasiya hər müştəri datasını ayrı saxlayır. Şifrələr bcrypt-12 ilə hash olunur. Bütün dəyişikliklər audit log-da qeydə alınır. Sahibkar bölməsi əlavə PIN ilə qorunur.",
  },
  {
    q: "Marketplace inteqrasiyası necə işləyir?",
    a: "Peşəkar paketdə Bolt, Wolt, Yango, ProGo və Tap.az kimi platformaları qoşa bilərsiniz. Stok və qiymət avtomatik sinxron olur, sifarişlər birbaşa ERP-yə düşür.",
  },
  {
    q: "Bir neçə filialım var. Hamısı tək hesabda idarə oluna bilərmi?",
    a: "Bəli. İstənilən qədər filial əlavə edə bilərsiniz. Hər filialın öz anbarı, kassası və işçiləri olur. Sahibkar bölməsində filiallar üzrə müqayisəli hesabat görəcəksiniz.",
  },
  {
    q: "POS-da hardware (skaner, çek printeri) qoşula bilərmi?",
    a: "Bəli. USB barkod skanerləri brauzerdə standart klaviatura kimi işləyir. Çek printeri üçün thermal printer dəstəklənir (80mm).",
  },
  {
    q: "Abunə bitsə dataya nə olacaq?",
    a: "Data 30 gün ərzində saxlanılır. Bu dövrdə yenidən aktivləşdirsəniz hər şey qaytarılır. 30 gündən sonra audit qaydalarına uyğun anonimləşdirilir.",
  },
];

export default function FaqPage() {
  return (
    <>
      <MeshHero
        badge="Tez-tez verilən suallar"
        title="Ağlınıza gələn hər sualın cavabı"
        sub="Cavabını tapa bilmədiyiniz sual varsa bizə yazın — kömək etməyə hazırıq."
      />

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-16 md:py-20">
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card p-5 transition open:border-primary/30 open:shadow-lg open:shadow-primary/5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-semibold">{f.q}</span>
                <span className="text-xl leading-none text-primary-light transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
          <p className="text-sm font-medium">Sualınız hələ də var?</p>
          <a href="mailto:salam@360biznes.az" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary-light hover:underline">
            salam@360biznes.az <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <PublicFooter />
    </>
  );
}
