import Link from "next/link";
import { ShieldCheck, Database, Sparkles } from "lucide-react";

/* === Public səhifələr üçün ortaq dizayn sistemi (Premium Dərinlik) === */

export const DEEP_MESH: React.CSSProperties = {
  background:
    "radial-gradient(circle at 18% 22%, hsl(165 84% 38% / 0.45), transparent 42%)," +
    "radial-gradient(circle at 82% 8%, hsl(174 88% 44% / 0.40), transparent 40%)," +
    "radial-gradient(circle at 60% 100%, hsl(158 84% 40% / 0.32), transparent 48%)," +
    "linear-gradient(155deg, hsl(177 78% 8%), hsl(171 70% 13%), hsl(164 62% 12%))",
};

export const GRID_OVERLAY: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(hsl(0 0% 100% / 0.05) 1px, transparent 1px)," +
    "linear-gradient(90deg, hsl(0 0% 100% / 0.05) 1px, transparent 1px)",
  backgroundSize: "44px 44px",
  maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black, transparent 75%)",
  WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black, transparent 75%)",
};

export function MeshHero({
  badge, title, sub, children,
}: {
  badge?: string;
  title: React.ReactNode;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden text-white" style={DEEP_MESH}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={GRID_OVERLAY} />
      <div aria-hidden className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-14 text-center md:pb-20 md:pt-20">
        {badge && (
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            {badge}
          </div>
        )}
        <h1 className="text-balance text-4xl font-black leading-[1.08] tracking-tight md:text-5xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-white/80">{sub}</p>
        {children && <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{children}</div>}
      </div>
    </section>
  );
}

export function SectionHead({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-light">{kicker}</p>
      <h2 className="mt-3 text-balance text-3xl font-black tracking-tight md:text-4xl">{title}</h2>
      <p className="mt-3 text-balance text-muted-foreground">{sub}</p>
    </div>
  );
}

export function PublicFooter() {
  const cols = [
    { title: "Platforma", links: [["Funksiyalar", "/funksiyalar"], ["Paketlər", "/paketler"], ["Demo", "/demo"], ["FAQ", "/faq"]] },
    { title: "Modullar", links: [["Satış & POS", "/funksiyalar"], ["Anbar & maliyyə", "/funksiyalar"], ["CRM & tapşırıq", "/funksiyalar"], ["İşçilər & HR", "/funksiyalar"]] },
    { title: "Başla", links: [["Pulsuz qeydiyyat", "/qeydiyyat"], ["Giriş", "/login"], ["Abunə", "/abune"]] },
  ];
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: "var(--brand-gradient)" }}>
              <span className="font-black">3</span>
            </div>
            <span className="brand-text text-xl font-black tracking-tight">360Biznes</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Satış, anbar, maliyyə, tapşırıq, HR və müştəri — biznesinizin hər prosesi üçün hazırlanmış AI-lı ERP platforması. Bir sistem, sonsuz imkan.
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary-light" /> SSL + bcrypt</span>
            <span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-primary-light" /> Multi-tenant</span>
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="text-sm font-bold">{c.title}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.links.map(([label, href]) => (
                <li key={label}><Link href={href} className="transition hover:text-foreground">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© 2026 360Biznes. Bütün hüquqlar qorunur.</span>
          <span>Bir platforma · sonsuz imkan</span>
        </div>
      </div>
    </footer>
  );
}
