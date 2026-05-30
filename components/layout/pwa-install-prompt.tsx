"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "biznes:pwa-install-dismissed";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün
const SHOW_AFTER_MS = 30 * 1000; // 30s istifadədən sonra

// BeforeInstallPromptEvent Chrome/Edge-də mövcuddur. iOS Safari-də yoxdur —
// orada manual "Share → Add to Home Screen" istiqaməti göstərmək olar (gələcəkdə).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Add to Home Screen" banner — Chrome/Edge/Brave-də beforeinstallprompt
 * eventini tutur. 30s istifadədən sonra mobile-da görünür.
 * Dismiss → 7 gün cooldown.
 *
 * Standalone display mode-da (artıq install olunub) heç vaxt görünmür.
 */
export function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Artıq install olunubsa, prompt göstərmə
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // iOS Safari-də beforeinstallprompt yoxdur — return
    if (!("BeforeInstallPromptEvent" in window) && typeof window !== "undefined") {
      // Yenə də eventi dinləyirik (Chrome desktop-da, iOS-da event heç gəlməyəcək)
    }
    // Cooldown yoxla
    const last = localStorage.getItem(DISMISS_KEY);
    if (last) {
      const elapsed = Date.now() - parseInt(last, 10);
      if (elapsed < DISMISS_COOLDOWN_MS) return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // 30s sonra göstər
    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible || !event) return null;

  const handleInstall = async () => {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      setEvent(null);
    } else {
      // Rədd edilibsə 7 gün cooldown
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  return (
    <div
      className={cn(
        "fixed left-3 right-3 z-40 flex items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-lg",
        // Bottom nav-ın üstündə yerləş (mobile-da)
        "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] md:bottom-6 md:max-w-md md:left-auto md:right-6",
        "animate-fade-up",
      )}
      role="dialog"
      aria-label="Tətbiqi quraşdır"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: "var(--brand-gradient)" }}>
        <Download className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">360Biznes-i quraşdır</div>
        <div className="text-[11px] text-muted-foreground">Tam ekran, offline və sürətli giriş</div>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm active:scale-95"
      >
        Quraşdır
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Bağla"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
