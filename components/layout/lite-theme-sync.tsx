"use client";

import { useEffect } from "react";
import type { LiteDesign } from "@/lib/lite/config";

/**
 * QA-orta: SSR inline script yalnız İLK yüklənmədə işləyir — client-side
 * naviqasiya/router.refresh-də (rejim və ya dizayn dəyişəndə) atributlar
 * köhnə qalırdı. Bu client komponent hər render-də cari server dəyərləri
 * ilə <html> atributlarını sinxronlayır. (Script ilk paint FOUC-unu örtür,
 * bu isə sonrakı dəyişiklikləri.)
 */
export function LiteThemeSync({
  design,
  active,
  icmal,
}: {
  design: LiteDesign | null;
  active: boolean;
  icmal: string[];
}) {
  useEffect(() => {
    const el = document.documentElement;
    if (active && design) {
      el.dataset.lite = "1";
      el.dataset.density = design.density;
      el.dataset.font = design.fontScale;
      el.dataset.accent = design.accent;
      el.dataset.mlayout = design.mobileLayout;
    } else {
      delete el.dataset.lite;
      delete el.dataset.density;
      delete el.dataset.font;
      delete el.dataset.accent;
      delete el.dataset.mlayout;
    }
    el.dataset.icmal = icmal.join(",");
  }, [active, design?.density, design?.fontScale, design?.accent, design?.mobileLayout, icmal.join(",")]);
  return null;
}
