import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandMark } from "@/components/brand/brand-mark";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9" />
            <span className="brand-text text-xl font-black tracking-tight">360Biznes</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/funksiyalar" className="transition hover:text-foreground">Funksiyalar</Link>
            <Link href="/paketler" className="transition hover:text-foreground">Paketlər</Link>
            <Link href="/demo" className="transition hover:text-foreground">Demo</Link>
            <Link href="/faq" className="transition hover:text-foreground">FAQ</Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
              Giriş
            </Link>
            <Link
              href="/qeydiyyat"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:scale-[1.02] hover:opacity-95"
              style={{ background: "var(--brand-gradient)" }}
            >
              Pulsuz başla
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
