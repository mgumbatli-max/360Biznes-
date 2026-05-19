import { cn } from "@/lib/utils";

type Action = {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "primary" | "secondary";
  icon?: React.ComponentType<{ className?: string }>;
};

type ExampleCard = {
  title: string;
  desc: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type Props = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actions?: Action[];
  /** Qısa "Necə işləyir?" izahı — istifadəçiyə kontekst verir. */
  help?: string;
  /** İki-üç istiqamət nümunəsi (məs: konsiqnasiya — Verilən/Götürülən). */
  examples?: ExampleCard[];
  className?: string;
  tone?: "default" | "primary" | "muted";
};

const ICON_TONE: Record<NonNullable<Props["tone"]>, string> = {
  default: "from-foreground/10 to-foreground/0 text-muted-foreground",
  primary: "from-primary/20 to-primary/0 text-primary",
  muted: "from-secondary to-secondary/0 text-muted-foreground/50",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  help,
  examples,
  className,
  tone = "default",
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/40 bg-card/30 px-6 py-10 text-center backdrop-blur",
        className,
      )}
    >
      <div className={cn("grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br shadow-inner", ICON_TONE[tone])}>
        <Icon className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {description && <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>

      {actions && actions.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a, i) => {
            const Cmp = a.href ? "a" : "button";
            const ActionIcon = a.icon;
            return (
              <Cmp
                key={i}
                {...(a.href ? { href: a.href } : { type: "button" as const, onClick: a.onClick })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition",
                  a.tone === "primary" || (i === 0 && !a.tone)
                    ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                    : "border border-border bg-secondary text-foreground hover:bg-secondary/70",
                )}
              >
                {ActionIcon && <ActionIcon className="h-3.5 w-3.5" />}
                {a.label}
              </Cmp>
            );
          })}
        </div>
      )}

      {help && (
        <details className="mx-auto mt-2 max-w-md text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none rounded-md px-2 py-1 font-semibold text-primary hover:bg-primary/5">
            Necə işləyir? →
          </summary>
          <p className="mt-2 rounded-md bg-secondary/40 p-3 leading-relaxed">{help}</p>
        </details>
      )}

      {examples && examples.length > 0 && (
        <div className="mt-3 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((ex, i) => {
            const ExIcon = ex.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border/40 bg-secondary/30 p-3 text-left"
              >
                {ExIcon && (
                  <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
                    <ExIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{ex.title}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground">{ex.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
