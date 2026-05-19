import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Boxes, Tags, Users, Sparkles, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Onboarding — 360Biznes" };

const STEPS = [
  {
    n: 1,
    icon: Building2,
    title: "Kompaniya məlumatları",
    desc: "Şirkət adı, VÖEN, ünvan və əlaqə məlumatlarını daxil edin. Bu məlumatlar fakturalarda və sənədlərdə görünəcək.",
    cta: { href: "/ayarlar/kompaniya", label: "Kompaniya ayarına keç" },
  },
  {
    n: 2,
    icon: Boxes,
    title: "İlk anbarınızı yaradın",
    desc: "Mərkəzi anbar, mağaza anbarı və ya filial anbarı yaradın. Hər anbar üçün məsul və ünvan təyin edə bilərsiniz.",
    cta: { href: "/anbar", label: "Anbar yarat" },
  },
  {
    n: 3,
    icon: Tags,
    title: "Qiymət növlərini seçin",
    desc: "Pərakəndə, topdan, VIP, partnyor — sistem 5 standart qiymət növü ilə gəlir. Lazımsızları passiv edə bilərsiniz.",
    cta: { href: "/ayarlar/qiymet", label: "Qiymət növlərinə bax" },
  },
  {
    n: 4,
    icon: Users,
    title: "İşçilərinizi əlavə edin (istəyə görə)",
    desc: "Komandanızı dəvət edin, rol təyin edin, icazələri konfiqurasiya edin. Bunu sonra da edə bilərsiniz.",
    cta: { href: "/iscilier", label: "İşçi dəvət et" },
  },
  {
    n: 5,
    icon: Sparkles,
    title: "Hazırsan!",
    desc: "Dashboard-a keçin və biznesinizi idarə etməyə başlayın. Hər zaman bizimlə əlaqə saxlaya bilərsiniz.",
    cta: { href: "/dashboard", label: "Dashboard-a get" },
  },
];

export default function OnboardingPage() {
  return (
    <div className="px-6">
      <section className="mx-auto max-w-3xl pb-8 pt-12 text-center md:pt-16">
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          <span className="brand-text">Xoş gəldiniz!</span> Quraşdırmaya başlayaq
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          5 sadə addım — biznesinizi 10 dəqiqəyə hazır vəziyyətə gətirin.
        </p>
      </section>

      <div className="mx-auto max-w-3xl space-y-4 pb-16">
        {STEPS.map((step, idx) => (
          <div key={step.n} className="glass rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary-light">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Addım {step.n}
                  </span>
                  {idx === STEPS.length - 1 && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                </div>
                <h3 className="mt-0.5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                <Link
                  href={step.cta.href}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-light hover:underline"
                >
                  {step.cta.label} →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="mx-auto max-w-2xl pb-20 text-center">
        <p className="text-sm text-muted-foreground">
          Sual yaranarsa <Link href="/faq" className="text-primary-light hover:underline">FAQ-a</Link> baxın
          və ya <Link href="/demo" className="text-primary-light hover:underline">demo sifariş edin</Link>.
        </p>
      </section>
    </div>
  );
}
