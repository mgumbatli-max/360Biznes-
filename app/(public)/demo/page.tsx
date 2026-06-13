import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Zap, ShieldCheck, Sparkles, Layers } from "lucide-react";
import { MeshHero, PublicFooter } from "@/components/public/ui";

export const metadata: Metadata = { title: "Demo — 360Biznes" };

const POINTS = [
  { icon: Zap, title: "Dərhal başla", desc: "2 dəqiqədə hesab açılır, quraşdırma yoxdur" },
  { icon: Layers, title: "12 modul açıq", desc: "POS-dan HR-a bütün funksiyalar tam işlək" },
  { icon: Sparkles, title: "AI köməkçi daxil", desc: "İlk gündən biznes analitika sizinlə" },
  { icon: ShieldCheck, title: "Risk yoxdur", desc: "15 gün sonra avtomatik bitir, kart yoxdur" },
];

const STEPS = [
  { n: "1", t: "Qeydiyyat", d: "Şirkət adı, email və telefon — bu qədər." },
  { n: "2", t: "Quraşdırma", d: "İlkin qalıq və ya boş başla, dərhal işə düş." },
  { n: "3", t: "İdarə et", d: "Satış, anbar, komanda — hamısını izlə." },
];

export default function DemoPage() {
  return (
    <>
      <MeshHero
        badge="15 günlük tam funksiyalı sınaq"
        title={<>Bir kliklə <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">başlayın</span></>}
        sub="Kart məlumatı yox, kompromis yox. Qeydiyyatdan sonra dərhal bütün modullara giriş."
      >
        <Link href="/qeydiyyat" className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-emerald-950 shadow-2xl shadow-black/20 transition hover:scale-[1.02]">
          Pulsuz demo başlat <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </MeshHero>

      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border bg-card p-6 text-center transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary-light">
                <p.icon className="h-5 w-5" />
              </div>
              <div className="font-bold">{p.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{p.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="text-center text-2xl font-black tracking-tight">3 addımda başlayın</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-black text-white" style={{ background: "var(--brand-gradient)" }}>
                  {s.n}
                </div>
                <div className="mt-4 font-bold">{s.t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border border-border p-8 text-center text-white md:p-12" style={{ background: "var(--brand-gradient)" }}>
          <CheckCircle2 className="mx-auto h-8 w-8" />
          <h2 className="mt-3 text-2xl font-black tracking-tight">Hazırsınız?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/85">
            Şirkət adı, email və telefon yetər. Bir neçə saniyədə dashboard-a daxil olun.
          </p>
          <Link href="/qeydiyyat" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-emerald-950 shadow-xl transition hover:scale-[1.02]">
            Pulsuz başla <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Suallar?{" "}
          <Link href="/faq" className="text-primary-light hover:underline">FAQ</Link>
          {" "}və ya{" "}
          <a href="mailto:salam@360biznes.az" className="text-primary-light hover:underline">salam@360biznes.az</a>
        </div>
      </div>

      <PublicFooter />
    </>
  );
}
