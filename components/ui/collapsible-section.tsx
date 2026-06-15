"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobil-də yığcam bölmə: telefon görünüşündə (< md) BAĞLI gəlir — başlığa basıb
 * açırsan. Desktop-da (md+) heç nə dəyişmir — uşaqlar olduğu kimi göstərilir
 * (başlıq/toggle gizlənir). Uzun filtr/məlumat blokları üçün.
 *
 * defaultOpen — mobil-də ilkin açıq olsun (default false = bağlı).
 *
 * Boş məzmun: əgər uşaqlar heç nə render etmirsə (məs. data yoxdursa null qaytaran
 * bölmə, ya da Suspense → null), mobil-də boş başlıq görünməsin deyə bütün bölmə
 * gizlədilir. MutationObserver ilə Suspense stream-in də tutulur.
 */
export function CollapsibleSection({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(false);

  // Məzmun divində element uşaq sayını izlə (comment/whitespace sayılmır →
  // Suspense placeholder-ları problem yaratmır). Stream-in / sonradan dolma üçün
  // MutationObserver. collapsed olsa belə (display:none) uşaqlar DOM-da qalır.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => setIsEmpty(el.childElementCount === 0);
    check();
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return (
    <section
      className={cn(
        "max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card/40",
        isEmpty && "max-md:hidden",
      )}
    >
      {/* Toggle başlığı — yalnız mobil-də */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="md:hidden flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {icon}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {subtitle ? <span className="block text-[11px] text-muted-foreground">{subtitle}</span> : null}
        </span>
        {badge}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {/* Məzmun — desktop həmişə görünür; mobil yalnız open olanda */}
      <div
        ref={contentRef}
        className={cn(!open && "max-md:hidden", "max-md:border-t max-md:border-border/60 max-md:p-4 max-md:pt-3")}
      >
        {children}
      </div>
    </section>
  );
}
