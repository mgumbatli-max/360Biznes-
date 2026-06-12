"use client";

import { useEffect } from "react";
import { useLiteMenu } from "@/stores/lite-menu";

/**
 * Server-də hesablanan `hiddenModules` (Lite rejimində gizli modullar)
 * dəyərini client-tərəfli LiteMenu store-una köçürür. Beləcə mobil-web
 * LiteMenu grid-i sidebar/komanda-palitrası ilə eyni gizlətməyə tabe olur.
 * Pro rejimində `hiddenModules` boşdur — davranış dəyişmir.
 */
export function LiteMenuHydrator({ hiddenModules }: { hiddenModules: string[] }) {
  const setHiddenModules = useLiteMenu((s) => s.setHiddenModules);
  useEffect(() => {
    setHiddenModules(hiddenModules);
  }, [setHiddenModules, hiddenModules.join(",")]);
  return null;
}
