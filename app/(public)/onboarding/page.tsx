import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Boxes, Tags, Users, Sparkles, ArrowRight } from "lucide-react";
import { MeshHero, PublicFooter } from "@/components/public/ui";

export const metadata: Metadata = { title: "Onboarding — 360Biznes" };

const STEPS = [
  {
    n: 1, icon: Building2, title: "Kompaniya məlumatları",
    desc: "Şirkət adı, VÖEN, ünvan və əlaqə məlumatlarını daxil edin. Bu məlumatlar fakturalarda və sənədlərdə görünəcək.",
    cta: { href: "/ayarlar/kompaniya", label: "Kompaniya ayarına keç" },
  },
  {
    n: 2, icon: Boxes, title: "İlk anbarınızı yaradın",
    desc: "Mərkəzi anbar, mağaza anbarı və ya filial anbarı yaradın. Hər anbar üçün məsul və ünvan təyin edə bilərsiniz.",
    cta: { href: "/anbar", label: "Anbar yarat" },
  },
  {
    n: 3, icon: Tags, title: "Qiymət növlərini seçin",
    desc: "Pərakəndə, topdan, VIP, partnyor — sistem 5 standart qiymət növü ilə gəlir. Lazımsızları passiv edə bilərsiniz.",
    cta: { href: "/ayarlar/qiymet", label: "Qiymət növlərinə bax" },
  },
  {
    n: 4, icon: Users, title: "İşçilərinizi əlavə edin",
    desc: "Komandanızı dəvət edin, rol təyin edin, icazələri konfiqurasiya edin. Bunu sonra da edə bilərsiniz.",
    cta: { href: "/iscilier", label: "İşçi dəvət et" },
  },
  {
    n: 5, icon: Sparkles, title: "Hazırsınız!",
    desc: "Dashboard-a keçin və biznesinizi idarə etməyə başlayın. Hər zaman bizimlə əlaqə saxlaya bilərsiniz.",
    cta: { href: "/dashboard", label: "Dashboard-a get" },
  },
];

export default function OnboardingPage() {
  return (
    <>
      <MeshHero
        badge="Xoş gəldiniz!"
        title="Biznesinizi 10 dəqiqəyə hazır vəziyyətə gətirin"
        sub="5 sadə addım — quraşdırmadan ilk satışa qədər sizinləyik."
      />

      <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <ol className="relative space-y-5 before:absolute before:left-[27px] before:top-2 before:bottom-2 before:w-px before:bg-border md:before:left-[31px]">
          {STEPS.map((step, idx) => {
            const last = idx === STEPS.length - 1;
            return (
              <li key={step.n} className="relative flex gap-5">
                <div
                  className={`relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg ${last ? "" : "bg-card text-primary-light ring-1 ring-border"}`}
                  style={last ? { background: "var(--brand-gradient)" } : { background: "hsl(var(--card))" }}
                >
                  {last ? <step.icon className="h-6 w-6" /> : <span className="text-lg font-black text-primary-light">{step.n}</span>}
                </div>
                <div className="flex-1 rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <div className="flex items-center gap-2">
                    <step.icon className="h-4 w-4 text-primary-light" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Addım {step.n}</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  <Link href={step.cta.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-light hover:underline">
                    {step.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 text-center text-sm text-muted-foreground">
          Sual yaranarsa{" "}
          <Link href="/faq" className="text-primary-light hover:underline">FAQ-a</Link> baxın
          və ya{" "}
          <Link href="/demo" className="text-primary-light hover:underline">demo sifariş edin</Link>.
        </div>
      </div>

      <PublicFooter />
    </>
  );
}
