"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import type { ReactNode } from "react";

/**
 * URL-yə bağlı tab idarəetməsi.
 *
 * Müştəri kartı kimi multi-tab səhifələrdə tab dəyişdikdə browser back/forward
 * ilə uyumlu vəziyyət saxlayır. Drawer və ya yeni səhifə açıb geri qayıtdıqda
 * istifadəçi əvvəlki tab-da qalır.
 *
 * URL: `?tab=sefer` — current tab is "sefer"
 *
 * `paramKey` overrride imkanı (default "tab") çoxlu Tabs istifadəsi üçün.
 */
export function TabsUrlSync({
  defaultValue,
  paramKey = "tab",
  children,
}: {
  defaultValue: string;
  paramKey?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const value = sp.get(paramKey) ?? defaultValue;

  function onValueChange(v: string) {
    const params = new URLSearchParams(sp.toString());
    if (v === defaultValue) {
      params.delete(paramKey);
    } else {
      params.set(paramKey, v);
    }
    const q = params.toString();
    router.replace(`${window.location.pathname}${q ? `?${q}` : ""}`, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={onValueChange}>
      {children}
    </Tabs>
  );
}
