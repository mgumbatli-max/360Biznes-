import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, Shield, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="px-6">
      <section className="mx-auto max-w-5xl pb-20 pt-16 text-center md:pt-24">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary-light" />
          AI ilə gücləndirilmiş ERP — 15 günlük pulsuz demo
        </div>

        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-6xl">
          Biznesin
          <br className="hidden sm:block" />
          <span className="brand-text"> tək platformada </span>
          idarəsi
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Anbar, satış, maliyyə, CRM, marketplace inteqrasiyaları, AI köməkçi və daha çoxu —
          hamısı 360Biznes-də. Müasir, sürətli, multi-tenant SaaS.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/qeydiyyat"
            className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
            style={{ background: "var(--brand-gradient)", boxShadow: "var(--brand-glow)" }}
          >
            Pulsuz başla
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/paketler"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card/50 px-6 py-3 text-sm font-semibold transition hover:bg-card"
          >
            Paketlərə bax
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 pb-24 md:grid-cols-3">
        <FeatureCard
          icon={<Zap className="h-5 w-5" />}
          title="Sürətli"
          text="POS, satış, anbar bir neçə klikdə. Klaviatura kısaylarları ilə tam idarə."
        />
        <FeatureCard
          icon={<Sparkles className="h-5 w-5" />}
          title="AI gücü"
          text="Claude AI ilə müştəri cavabları, business advisor, anomali aşkarlama."
        />
        <FeatureCard
          icon={<Shield className="h-5 w-5" />}
          title="Multi-tenant SaaS"
          text="Bir hesabınız ola bilər, və ya öz mağazalarınız üçün abunə paylaşa bilərsiniz."
        />
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary-light">
        {icon}
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
      <CheckCircle2 className="mt-3 hidden h-4 w-4 text-success" />
    </div>
  );
}
