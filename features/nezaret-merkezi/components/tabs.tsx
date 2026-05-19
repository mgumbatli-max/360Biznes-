import Link from "next/link";
import {
  LayoutDashboard, Radar, ShieldCheck, Workflow, History, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NezaretTab = "dashboard" | "xeberdarliqlar" | "tesdiqler" | "qaydalar" | "loglar" | "ayarlar";

export type TabBadge = {
  count?: number;
  tone?: "rose" | "amber" | "emerald" | "primary";
};

const TABS: { id: NezaretTab; label: string; href: string; icon: typeof Radar; color: string }[] = [
  { id: "dashboard",      label: "Dashboard",      href: "/nezaret-merkezi",          icon: LayoutDashboard, color: "text-primary" },
  { id: "xeberdarliqlar", label: "Xəbərdarlıqlar", href: "/xeberdarliqlar",            icon: Radar,           color: "text-amber-500" },
  { id: "tesdiqler",      label: "Təsdiqlər",      href: "/tesdiq",                    icon: ShieldCheck,     color: "text-emerald-500" },
  { id: "qaydalar",       label: "Avtomatlaşdırma", href: "/avtomatlasdirma",          icon: Workflow,        color: "text-violet-500" },
  { id: "loglar",         label: "Loglar",         href: "/nezaret-merkezi/loglar",   icon: History,         color: "text-slate-500" },
  { id: "ayarlar",        label: "Ayarlar",        href: "/nezaret-merkezi/ayarlar",  icon: Settings,        color: "text-muted-foreground" },
];

const BADGE_TONE: Record<NonNullable<TabBadge["tone"]>, string> = {
  rose: "bg-rose-500 text-white",
  amber: "bg-amber-500 text-white",
  emerald: "bg-emerald-500 text-white",
  primary: "bg-primary text-primary-foreground",
};

export function NezaretMerkeziTabs({
  current,
  badges = {},
}: {
  current: NezaretTab;
  badges?: Partial<Record<NezaretTab, TabBadge>>;
}) {
  return (
    <nav className="overflow-x-auto rounded-xl border border-border/40 bg-card/40 p-1">
      <div className="flex min-w-max items-center gap-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === current;
          const badge = badges[t.id];
          const showBadge = badge?.count && badge.count > 0;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", !active && t.color)} />
              <span>{t.label}</span>
              {showBadge && (
                <span
                  className={cn(
                    "ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                    active ? "bg-background/20 text-background" : BADGE_TONE[badge!.tone ?? "rose"]
                  )}
                >
                  {(badge!.count ?? 0) > 99 ? "99+" : badge!.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
