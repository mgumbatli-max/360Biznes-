"use client";
import { useEffect, useState } from "react";

/**
 * Mount-dan sonra `true` qaytaran hook — render zamanı CARİ VAXTA əsaslanan görünən
 * nəticələr üçün React #418 hidratasiya qoruyucusu.
 *
 * PROBLEM: `new Date()` / `Date.now()` render zamanı server (SSR) və brauzerdə FƏRQLİ
 * instant qaytarır. Əgər bu dəyər görünən nəticəyə çevrilirsə (məs. "overdue" nişanı,
 * "5 dəq əvvəl" relative-time, online indikatoru, keçən vaxt), SSR HTML ilə ilk client
 * render fərqlənə bilər → hidratasiya uyğunsuzluğu (React #418).
 *
 * HƏLL: `const mounted = useMounted();` — SSR və ilk client render-də `false` (hər iki
 * tərəf EYNİ neytral nəticə verir → uyğunluq), mount-dan sonra `true` (brauzerdə cari
 * vaxta görə yenilənir).
 *
 * İstifadə:
 *   const mounted = useMounted();
 *   const overdue = mounted && deadline < new Date();       // boolean nişan
 *   {mounted ? formatRelativeTime(ts) : formatDate(ts)}     // relative-time
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
