"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global naviqasiya progress bar — YouTube/GitHub üslubunda nazik xətt.
 *
 * Necə işləyir:
 *  1. Document-də anchor[href] click-ləri tutulur — daxili link olduğu təsdiqlənirsə
 *     progress başlayır.
 *  2. usePathname / useSearchParams dəyişəndə naviqasiya tamamlanıb sayılır,
 *     bar finish edib gizlənir.
 *  3. Cmd/Ctrl/middle-click yeni tab açan klick-lər iqnor olunur.
 *  4. prefers-reduced-motion-də heç görünmür.
 *
 * Görsel: 2px nazik gradient bar — primary rəng + sağda subtle glow.
 *         Tamamlanan zaman 100%-ə smooth sürüşür, sonra 200ms fade-out.
 *
 * Performance: passive event listener, RAF əsaslı progress animation,
 * cleanup dəqiq — leak yoxdur.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const finishingRef = useRef(false);

  // Global click interceptor — daxili linkə klikdən progress başlat
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Eyni URL — naviqasiya olmayacaq
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }

      start();
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, []);

  // Pathname/search dəyişdi → naviqasiya bitdi
  useEffect(() => {
    if (active) finish();
  }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    if (finishingRef.current) {
      // Sürətli ardıcıl klik — yenidən başla
      finishingRef.current = false;
    }
    setActive(true);
    setProgress(0);
    startedAtRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Logaritmik artım: tez 0→60, sonra getdikcə yavaşıyır 60→90
    const tick = () => {
      const elapsed = performance.now() - startedAtRef.current;
      // 800ms-də 80%-ə çat, sonra çox yavaş davam et
      const t = Math.min(elapsed / 800, 4);
      const p = 1 - Math.exp(-2.2 * t); // asimptotik → 1
      const next = Math.min(0.9, p * 0.9);
      setProgress(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function finish() {
    finishingRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setProgress(1);
    // 220ms-də 100%-ə tamamlan, sonra fade-out
    window.setTimeout(() => {
      setActive(false);
      finishingRef.current = false;
      setProgress(0);
    }, 280);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] motion-reduce:hidden"
      style={{ opacity: active ? 1 : 0, transition: "opacity 220ms ease-out" }}
    >
      <div
        className="h-full bg-gradient-to-r from-primary via-primary to-primary/80"
        style={{
          width: `${progress * 100}%`,
          transition: progress === 1 ? "width 220ms ease-out" : "width 120ms linear",
          boxShadow: "0 0 8px hsl(var(--primary) / 0.6), 0 0 2px hsl(var(--primary))",
        }}
      />
    </div>
  );
}
