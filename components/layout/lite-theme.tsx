"use client";

import { useEffect } from "react";
import type { LiteDesign } from "@/lib/lite/config";

/**
 * Lite dizayn formasını `<html>` data-atributları kimi tətbiq edir.
 * globals.css bu atributlara görə şrift/sıxlıq/aksent/mobil-layout dəyişir.
 * Yalnız Lite rejimində aktiv (active=false → atributlar silinir, Pro normal).
 */
export function LiteThemeApplier({
  design,
  active,
}: {
  design: LiteDesign | null;
  active: boolean;
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
  }, [active, design?.density, design?.fontScale, design?.accent, design?.mobileLayout]);

  return null;
}
