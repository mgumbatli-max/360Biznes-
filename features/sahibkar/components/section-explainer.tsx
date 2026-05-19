import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Bullet = { label: string; text: string };

/**
 * Sahibkar alt-bölmələrində səhifə başlığının altına qoyulan izahedici kart.
 * Bölmənin nə işə yaradığını, hansı vərdişlərə uyğun olduğunu göstərir.
 */
export function SectionExplainer({
  title,
  icon: Icon,
  description,
  bullets,
  tone = "indigo",
}: {
  title?: string;
  icon?: LucideIcon;
  description: string;
  bullets?: Bullet[];
  tone?: "indigo" | "emerald" | "amber" | "rose" | "violet" | "sky";
}) {
  const toneClasses: Record<string, { border: string; bg: string; icon: string; chip: string }> = {
    indigo: { border: "border-indigo-500/30", bg: "bg-indigo-500/5", icon: "text-indigo-500", chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
    emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: "text-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    amber: { border: "border-amber-500/30", bg: "bg-amber-500/5", icon: "text-amber-500", chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    rose: { border: "border-rose-500/30", bg: "bg-rose-500/5", icon: "text-rose-500", chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
    violet: { border: "border-violet-500/30", bg: "bg-violet-500/5", icon: "text-violet-500", chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
    sky: { border: "border-sky-500/30", bg: "bg-sky-500/5", icon: "text-sky-500", chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  };
  const t = toneClasses[tone];
  const HeadIcon = Icon ?? Info;

  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} px-4 py-3`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background/60 ${t.icon}`}>
          <HeadIcon className="h-4 w-4" />
        </div>
        <div className="space-y-1.5">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {bullets.map((b) => (
                <li key={b.label} className={`rounded-md px-2 py-0.5 text-[10.5px] ${t.chip}`}>
                  <span className="font-semibold">{b.label}:</span> <span className="opacity-90">{b.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
