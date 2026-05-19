import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/login-form";
import {
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  Lock,
  Users,
} from "lucide-react";

export const metadata: Metadata = { title: "Giriş — 360Biznes" };

const FEATURES = [
  { icon: TrendingUp, title: "Satış & Anbar", desc: "POS, qaimə, maya, marja, AI tövsiyə" },
  { icon: Users, title: "CRM & Team", desc: "Müştəri, mesaj, kanal, audit log" },
  { icon: Zap, title: "Avtomatlaşdırma", desc: "Trigger → Action, AI-powered alerts" },
  { icon: ShieldCheck, title: "Multi-tenant", desc: "Sahibkar bazlı izolyasiya, role/permission" },
];

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* === BRAND HERO (LEFT) === */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{ background: "var(--brand-gradient)" }}
      >
        {/* Animated blobs */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />

        {/* Brand mark */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 backdrop-blur ring-1 ring-white/30">
            <span className="text-2xl font-black">3</span>
          </div>
          <div>
            <div className="text-xl font-black tracking-tight">360Biznes</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">ERP / SaaS Platform</div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative space-y-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Yeni nəsil ERP</p>
            <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight md:text-5xl">
              Hər biznesin
              <br />
              gücləndirici
              <br />
              motoru.
            </h1>
            <p className="mt-4 max-w-md text-base text-white/80">
              Anbar, satış, maliyyə, müştəri münasibətləri, hesabatlar — hamısı bir yerdə. AI tövsiyə, multi-filial və tam audit.
            </p>
          </div>

          <div className="grid max-w-md grid-cols-2 gap-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl bg-white/10 p-3 backdrop-blur transition hover:bg-white/15"
                >
                  <Icon className="h-4 w-4 text-white" />
                  <div className="mt-2 text-sm font-bold">{f.title}</div>
                  <div className="text-[10.5px] text-white/75">{f.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer trust */}
        <div className="relative flex flex-wrap items-center gap-3 text-xs text-white/70">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> SSL + bcrypt
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Multi-tenant
          </span>
          <span>·</span>
          <span>2026 © 360Biznes</span>
        </div>
      </aside>

      {/* === LOGIN FORM (RIGHT) === */}
      <main className="flex flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile-only brand */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            <span className="text-lg font-black">3</span>
          </div>
          <div>
            <div className="text-lg font-black tracking-tight">360Biznes</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">ERP Platform</div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6 animate-fade-up">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" />
              Xoş gəldiniz
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              <span className="gradient-text">Hesaba giriş</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Şifrənizlə daxil olun və biznesinizi idarə edin
            </p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-xl shadow-foreground/5 backdrop-blur">
            <LoginForm searchParamsPromise={searchParams} />
          </div>

          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Hesabınız yoxdur?{" "}
              <Link href="/qeydiyyat" className="font-semibold text-primary hover:underline">
                15 günlük demo ilə başlayın
              </Link>
            </p>
            <div className="flex items-center justify-center gap-3 text-[10.5px] text-muted-foreground/70">
              <Link href="/funksiyalar" className="hover:text-foreground transition">Funksiyalar</Link>
              <span>·</span>
              <Link href="/paketler" className="hover:text-foreground transition">Paketlər</Link>
              <span>·</span>
              <Link href="/faq" className="hover:text-foreground transition">FAQ</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
