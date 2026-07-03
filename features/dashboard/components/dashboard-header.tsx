import Link from "next/link";
import { ShieldAlert, FileBarChart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/types";

function getGreeting(): { label: string; emoji: string } {
  // Bakı saatı (UTC+4) — server UTC-də işlədiyi üçün getHours() səhv salamlama verirdi.
  const hour = (new Date().getUTCHours() + 4) % 24;
  if (hour < 6) return { label: "Sakit gecələr", emoji: "🌙" };
  if (hour < 12) return { label: "Sabahın xeyir", emoji: "☀️" };
  if (hour < 17) return { label: "Gününüz xeyir", emoji: "🌤️" };
  if (hour < 22) return { label: "Axşamın xeyir", emoji: "🌆" };
  return { label: "Gecəniz xeyirə qalsın", emoji: "🌙" };
}

export function DashboardHeader({ user }: { user: SessionUser }) {
  const greet = getGreeting();
  const today = formatDate(new Date(), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const firstName = user.ad_soyad.split(" ")[0];

  return (
    <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 px-5 py-6 shadow-sm md:px-7 md:py-7">
      {/* Animated gradient halos — dark/light mode-da subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, hsl(217 91% 60% / 0.25), transparent 60%)",
        }}
      />
      {/* Subtle dotted texture overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2 animate-fade-up">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
            <span className="text-xs leading-none">{greet.emoji}</span>
            {greet.label}
          </div>
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">
            <span className="gradient-text">{firstName}</span>
            <span className="text-foreground/80" aria-hidden>👋</span>
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              biznesin hazırdır
            </span>
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="capitalize">{today}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <Sparkles className="h-3 w-3 text-primary" />
              {user.sahibkar_ad}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="backdrop-blur">
            <Link href="/nezaret-merkezi">
              <ShieldAlert className="h-3.5 w-3.5" /> Nəzarət
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="backdrop-blur">
            <Link href="/hesabatlar">
              <FileBarChart className="h-3.5 w-3.5" /> Hesabat
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
