"use client";

import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "view" | "doc" | "print" | "pay-in" | "pay-out" | "danger" | "primary";

const TONE_CLS: Record<Tone, string> = {
  default: "text-muted-foreground hover:bg-secondary hover:text-foreground",
  view: "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300",
  doc: "text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300",
  print: "text-slate-500 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
  "pay-in": "text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300",
  "pay-out": "text-amber-700 hover:bg-amber-500/15 dark:text-amber-300",
  danger: "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400",
  primary: "text-primary hover:bg-primary/10",
};

type CommonProps = {
  tone?: Tone;
  title: string;
  children: ReactNode;
  className?: string;
};

/**
 * Unified inline action button — modern, smooth hover/active animations.
 * Subtle scale on hover, press effect on active, focus ring for keyboard nav.
 */
export function RowIconButton({
  tone = "default",
  title,
  children,
  className,
  ...rest
}: CommonProps & ComponentProps<"button">): React.ReactElement;
export function RowIconButton(
  props: CommonProps & { as: "a" } & ComponentProps<"a">,
): React.ReactElement;
export function RowIconButton(props: any) {
  const { tone = "default", title, children, className, as, ...rest } = props;
  const cls = cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-lg",
    "transition-all duration-200 ease-out",
    "hover:scale-110 active:scale-95",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    TONE_CLS[tone as Tone],
    className,
  );
  if (as === "a") {
    const Tag: ElementType = "a";
    return (
      <Tag className={cls} title={title} aria-label={title} {...rest}>
        {children}
      </Tag>
    );
  }
  return (
    <button type="button" className={cls} title={title} aria-label={title} {...rest}>
      {children}
    </button>
  );
}

/**
 * Modern pill button for primary actions — gradient tint, hover lift, active press.
 */
export function RowPillButton({
  tone,
  title,
  children,
  onClick,
  disabled,
}: {
  tone: "pay-in" | "pay-out" | "primary" | "danger";
  title: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const PILL: Record<typeof tone, string> = {
    "pay-in":
      "bg-gradient-to-b from-emerald-500/20 to-emerald-500/10 text-emerald-700 hover:from-emerald-500/30 hover:to-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/20 dark:text-emerald-300",
    "pay-out":
      "bg-gradient-to-b from-amber-500/20 to-amber-500/10 text-amber-700 hover:from-amber-500/30 hover:to-amber-500/20 hover:shadow-md hover:shadow-amber-500/20 dark:text-amber-300",
    primary:
      "bg-gradient-to-b from-primary/20 to-primary/10 text-primary hover:from-primary/30 hover:to-primary/20 hover:shadow-md hover:shadow-primary/20",
    danger:
      "bg-gradient-to-b from-rose-500/20 to-rose-500/10 text-rose-700 hover:from-rose-500/30 hover:to-rose-500/20 hover:shadow-md hover:shadow-rose-500/20 dark:text-rose-300",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[10.5px] font-semibold",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-px active:translate-y-0 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
        PILL[tone],
      )}
    >
      {children}
    </button>
  );
}

/**
 * Glass-morphism container for grouping action icons.
 * Subtle backdrop blur, soft border, gentle elevation.
 */
export function RowIconGroup({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl px-1 py-0.5",
        "border border-border/40 bg-card/60 backdrop-blur-sm",
        "shadow-sm shadow-black/[0.03] dark:shadow-black/20",
        "transition-shadow duration-200 hover:shadow-md hover:shadow-black/[0.05] dark:hover:shadow-black/30",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Subtle vertical divider for separating icon groups.
 */
export function RowIconDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-border/60" />;
}
