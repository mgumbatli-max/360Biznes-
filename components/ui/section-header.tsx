import { cn } from "@/lib/utils";

type Props = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
  tone?: "default" | "primary" | "emerald" | "rose" | "amber" | "violet" | "sky";
};

const ICON_TONE: Record<NonNullable<Props["tone"]>, string> = {
  default: "bg-secondary text-foreground",
  primary: "bg-primary/15 text-primary",
  emerald: "bg-emerald-500/15 text-emerald-500",
  rose: "bg-rose-500/15 text-rose-500",
  amber: "bg-amber-500/15 text-amber-500",
  violet: "bg-violet-500/15 text-violet-500",
  sky: "bg-sky-500/15 text-sky-500",
};

export function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
  actions,
  tone = "default",
}: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-sm transition hover:scale-105", ICON_TONE[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {badge && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-primary">
                {badge}
              </span>
            )}
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
