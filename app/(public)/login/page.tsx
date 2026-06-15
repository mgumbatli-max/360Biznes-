import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/login-form";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  ShieldCheck, Sparkles, TrendingUp, ShoppingCart, Boxes, Wallet,
  Lock, Check,
} from "lucide-react";
import { DEEP_MESH } from "@/components/public/ui";

export const metadata: Metadata = { title: "Giriş — 360Biznes" };

const GRID_OVERLAY: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(hsl(0 0% 100% / 0.05) 1px, transparent 1px)," +
    "linear-gradient(90deg, hsl(0 0% 100% / 0.05) 1px, transparent 1px)",
  backgroundSize: "40px 40px",
  maskImage: "radial-gradient(ellipse 90% 80% at 40% 40%, black, transparent 80%)",
  WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 40% 40%, black, transparent 80%)",
};

const HIGHLIGHTS = ["Satış & POS", "Anbar & maliyyə", "CRM & marketplace", "AI köməkçi"];

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[1.05fr_1fr]">
      {/* === BRAND HERO (LEFT) === */}
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14" style={DEEP_MESH}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={GRID_OVERLAY} />
        <div aria-hidden className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-teal-300/15 blur-3xl" />

        {/* Brand mark */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <BrandMark tone="white" className="h-7 w-7" />
          </div>
          <div>
            <div className="text-lg font-black tracking-tight">360Biznes</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/60">ERP / SaaS Platform</div>
          </div>
        </div>

        {/* Headline + preview */}
        <div className="relative space-y-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">Yenidən xoş gəldiniz</p>
            <h1 className="mt-3 text-4xl font-black leading-[1.08] tracking-tight xl:text-5xl">
              Biznesinizi <span className="text-emerald-300">bütöv</span>
              <br /> idarə edin.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
              Anbar, satış, maliyyə və müştəri — hamısı tək sistemdə. Daxil olun və davam edin.
            </p>
          </div>

          {/* mini dashboard preview */}
          <div className="max-w-md rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { l: "Bu gün", v: "₼24.5k", d: "+12%", icon: TrendingUp },
                { l: "Sifariş", v: "37", d: "+5", icon: ShoppingCart },
                { l: "Anbar", v: "3,476", d: "mal", icon: Boxes },
              ].map((k) => (
                <div key={k.l} className="rounded-lg bg-white/5 p-2.5 ring-1 ring-white/10">
                  <k.icon className="h-3.5 w-3.5 text-white/50" />
                  <div className="mt-1.5 text-sm font-bold">{k.v}</div>
                  <div className="text-[9px] text-emerald-300">{k.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex h-12 items-end gap-1.5 rounded-lg bg-white/5 px-2.5 py-2 ring-1 ring-white/10">
              {[40, 65, 48, 80, 58, 92, 72].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-emerald-500/40 to-emerald-300/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {HIGHLIGHTS.map((h) => (
              <span key={h} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                <Check className="h-3 w-3 text-emerald-300" /> {h}
              </span>
            ))}
          </div>
        </div>

        {/* Footer trust */}
        <div className="relative flex flex-wrap items-center gap-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> SSL + bcrypt</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Multi-tenant</span>
          <span>·</span>
          <span>2026 © 360Biznes</span>
        </div>
      </aside>

      {/* === LOGIN FORM (RIGHT) === */}
      <main className="flex flex-col items-center justify-center bg-secondary/30 px-6 py-12">
        {/* Mobile-only brand */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <BrandMark className="h-10 w-10" />
          <div>
            <div className="text-lg font-black tracking-tight">360Biznes</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">ERP Platform</div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6 animate-fade-up">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Xoş gəldiniz
            </div>
            <h2 className="text-3xl font-black tracking-tight">
              <span className="brand-text">Hesaba giriş</span>
            </h2>
            <p className="text-sm text-muted-foreground">Şifrənizlə daxil olun və biznesinizi idarə edin</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xl shadow-foreground/5">
            <LoginForm searchParamsPromise={searchParams} />
          </div>

          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Hesabınız yoxdur?{" "}
              <Link href="/qeydiyyat" className="font-semibold text-primary-light hover:underline">
                15 günlük demo ilə başlayın
              </Link>
            </p>
            <div className="flex items-center justify-center gap-3 text-[10.5px] text-muted-foreground/70">
              <Link href="/funksiyalar" className="transition hover:text-foreground">Funksiyalar</Link>
              <span>·</span>
              <Link href="/paketler" className="transition hover:text-foreground">Paketlər</Link>
              <span>·</span>
              <Link href="/faq" className="transition hover:text-foreground">FAQ</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
