"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Horizontal scroll konteyner wrapper-ı — content-də `data-active="true"`
 * olan ilk element-i scroll mərkəzinə gətirir. Mobile UX vacibdir, çünki
 * yan-yana 8+ sub-nav item olduğunda istifadəçi aktiv tab-ı tapmaqda çətinlik çəkir.
 *
 * Pathname dəyişəndə yenidən scroll edir.
 *
 * İstifadə:
 *   <ScrollActiveIntoView>
 *     <Link data-active={isActive} ...>...</Link>
 *   </ScrollActiveIntoView>
 */
export function ScrollActiveIntoView({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>("[data-active='true']");
    if (!active) return;

    // Center the active item horizontally within the scroll container.
    // Use `inline: "center"` for horizontal axis. behaviour smooth, lakin
    // sürətli naviqasiyada motion sickness olmasın deyə kiçik debounce.
    const id = window.requestAnimationFrame(() => {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
