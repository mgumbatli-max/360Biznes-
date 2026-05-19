import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/20 blur-3xl"
      />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--brand-gradient)" }}>
            <span className="font-bold text-white">3</span>
          </div>
          <span className="brand-text text-xl font-bold tracking-tight">360Biznes</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link href="/paketler" className="transition hover:text-foreground">Paketlər</Link>
          <Link href="/demo" className="transition hover:text-foreground">Demo</Link>
          <Link href="/faq" className="transition hover:text-foreground">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Giriş
          </Link>
          <Link
            href="/qeydiyyat"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--brand-gradient)" }}
          >
            Pulsuz başla
          </Link>
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
