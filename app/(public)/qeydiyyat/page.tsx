import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/features/auth/signup-form";
import { Sparkles, Check, ShieldCheck, Lock, CreditCard, Clock, Bot } from "lucide-react";
import { DEEP_MESH } from "@/components/public/ui";

export const metadata: Metadata = { title: "Pulsuz başla — 360Biznes" };

const GRID_OVERLAY: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(hsl(0 0% 100% / 0.05) 1px, transparent 1px)," +
    "linear-gradient(90deg, hsl(0 0% 100% / 0.05) 1px, transparent 1px)",
  backgroundSize: "40px 40px",
  maskImage: "radial-gradient(ellipse 90% 80% at 40% 40%, black, transparent 80%)",
  WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 40% 40%, black, transparent 80%)",
};

const GAINS = [
  { icon: Sparkles, title: "15 gün tam funksiya", desc: "Bütün modullar, heç bir məhdudiyyət olmadan" },
  { icon: CreditCard, title: "Kart tələb olunmur", desc: "Sadəcə email — dərhal başlayın" },
  { icon: Clock, title: "5 dəqiqəyə qurulum", desc: "Quraşdırma yox, dərhal işə başlayın" },
  { icon: Bot, title: "AI köməkçi daxildir", desc: "İlk gündən biznes analitika sizinlə" },
];

export default function SignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[1fr_1.05fr]">
      {/* === FORM (LEFT on desktop) === */}
      <main className="order-2 flex flex-col items-center justify-center bg-secondary/30 px-6 py-12 lg:order-1">
        <div className="w-full max-w-sm space-y-6 animate-fade-up">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Pulsuz başla
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              <span className="brand-text">Hesab yaradın</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              15 günlük tam funksiyalı demo. Kart məlumatı tələb edilmir.
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xl shadow-foreground/5">
            <SignupForm />
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Hesabınız var?{" "}
            <Link href="/login" className="font-semibold text-primary-light hover:underline">Daxil ol</Link>
          </div>
        </div>
      </main>

      {/* === GAINS HERO (RIGHT) === */}
      <aside className="relative order-1 hidden flex-col justify-between overflow-hidden p-10 text-white lg:order-2 lg:flex xl:p-14" style={DEEP_MESH}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={GRID_OVERLAY} />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <span className="text-xl font-black">3</span>
          </div>
          <div className="text-lg font-black tracking-tight">360Biznes</div>
        </div>

        <div className="relative space-y-7">
          <h2 className="text-4xl font-black leading-[1.08] tracking-tight xl:text-5xl">
            Bu gün başlayın,
            <br /> <span className="text-emerald-300">sabah qabaqda olun.</span>
          </h2>
          <div className="space-y-3">
            {GAINS.map((g) => (
              <div key={g.title} className="flex items-start gap-3.5 rounded-xl border border-white/12 bg-white/8 p-3.5 backdrop-blur">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/12 text-emerald-300">
                  <g.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{g.title}</div>
                  <div className="text-xs text-white/70">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> SSL + bcrypt</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3" /> İstənilən vaxt ləğv</span>
        </div>
      </aside>
    </div>
  );
}
