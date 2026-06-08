/**
 * Shared Tailwind class strings for modern sub-navigation bars.
 * All module subnavs (ticaret, maliyye, anbar, crm, marketplace) consume these.
 */

export const SUBNAV_CONTAINER =
  "flex min-w-0 items-center gap-2 rounded-2xl border border-border/50 bg-gradient-to-b from-card/70 to-card/40 p-1 backdrop-blur-sm shadow-sm shadow-black/[0.03] dark:shadow-black/20";

export const SUBNAV_TAB_BASE =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-out";

export const SUBNAV_TAB_ACTIVE =
  "bg-gradient-to-b from-background to-background/80 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/15";

export const SUBNAV_TAB_INACTIVE =
  "text-muted-foreground hover:bg-background/60 hover:text-foreground hover:-translate-y-px active:translate-y-0";

export const SUBNAV_SECONDARY_BASE =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ease-out";

export const SUBNAV_SECONDARY_ACTIVE =
  "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 shadow-sm shadow-primary/10";

export const SUBNAV_SECONDARY_INACTIVE =
  "text-muted-foreground hover:bg-secondary hover:text-foreground";

export function subnavTabClass(isActive: boolean): string {
  return `${SUBNAV_TAB_BASE} ${isActive ? SUBNAV_TAB_ACTIVE : SUBNAV_TAB_INACTIVE}`;
}

export function subnavSecondaryClass(isActive: boolean): string {
  return `${SUBNAV_SECONDARY_BASE} ${isActive ? SUBNAV_SECONDARY_ACTIVE : SUBNAV_SECONDARY_INACTIVE}`;
}
