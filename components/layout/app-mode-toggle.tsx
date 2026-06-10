"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { useAppMode, type AppMode } from "@/stores/app-mode";
import { cn } from "@/lib/utils";

/**
 * Qlobal Lite / Pro keçidi — Topbar-da, bütün səhifələrdə görünür.
 *  - Lite: yalnız ən vacib məlumatlar, sadə — sahibkar rahat görsün.
 *  - Pro: tam funksional, bütün detallar.
 *
 * Cookie-ni yazır + `router.refresh()` ilə server-render səhifələri yeniləyir.
 */
export function AppModeToggle({ serverMode }: { serverMode?: AppMode }) {
  const router = useRouter();
  const mode = useAppMode((s) => s.mode);
  const hydrated = useAppMode((s) => s.hydrated);
  const setMode = useAppMode((s) => s.setMode);
  const hydrate = useAppMode((s) => s.hydrate);

  useEffect(() => {
    hydrate(serverMode);
  }, [hydrate, serverMode]);

  // Hidrasiyadan əvvəl serverMode-u göstər (SSR=client uyğun, "pro" flash olmaz).
  const displayMode = hydrated ? mode : serverMode ?? mode;

  function pick(next: AppMode) {
    if (next === displayMode) return;
    setMode(next);
    // Server-render olunan səhifələr (dashboard, hesabatlar…) yeni rejimə görə
    // yenilənsin — cookie artıq yazılıb, refresh server-də getAppMode-u yenidən oxuyur.
    router.refresh();
  }

  return (
    <div
      className="inline-flex h-8 items-center rounded-lg bg-secondary/70 p-0.5 text-[11px] font-semibold"
      role="group"
      aria-label="Görünüş rejimi"
    >
      <button
        type="button"
        onClick={() => pick("lite")}
        className={cn(
          "inline-flex h-7 items-center rounded-md px-2.5 transition",
          displayMode === "lite"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="Lite — sadə, yalnız ən vacib məlumatlar"
        aria-pressed={displayMode === "lite"}
      >
        Lite
      </button>
      <button
        type="button"
        onClick={() => pick("pro")}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md px-2.5 transition",
          displayMode === "pro"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="Pro — tam funksional, bütün detallar"
        aria-pressed={displayMode === "pro"}
      >
        <Zap className="h-3 w-3" />
        Pro
      </button>
    </div>
  );
}
