"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheatSheetModal } from "@/features/help/cheat-sheet-modal";

/**
 * Qlobal klaviatura qısayolları — route-aware.
 *
 * Mövcud Cmd+K paletti `command-palette.tsx`-da idarə olunur (toxunulmur).
 *
 * Burada əlavə olunur:
 *   - Cmd/Ctrl + N        — route-əsaslı "yeni" link-ə yönləndir
 *   - Cmd/Ctrl + /  | ?   — cheat-sheet modal aç/bağla
 *   - g s / g m / g a / g t / g d — chord naviqasiya
 *   - Esc                 — modal bağla
 *
 * Bütün form/input/textarea aktiv olduqda qısayollar dayandırılır (Esc və Cmd+/ istisna).
 */

const CHORD_TIMEOUT_MS = 1100;

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  // Radix combobox / popover-lərdə role=combobox açıq inputlar
  const role = t.getAttribute("role");
  if (role === "combobox" || role === "textbox") return true;
  return false;
}

function getNewRouteFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname.startsWith("/ticaret")) return "/ticaret/satis-yeni";
  if (pathname.startsWith("/maliyye")) return "/maliyye/emeliyyat/yeni";
  if (pathname.startsWith("/anbar")) return "/anbar/mehsullar?yeni=1";
  if (pathname.startsWith("/tapshiriqlar")) return "/tapshiriqlar?new=1";
  return null;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [cheatOpen, setCheatOpen] = useState(false);

  // chord state ("g" əvvəldə basıldığını yadda saxla)
  const chordPrefix = useRef<string | null>(null);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearChord() {
      chordPrefix.current = null;
      if (chordTimer.current) {
        clearTimeout(chordTimer.current);
        chordTimer.current = null;
      }
    }

    function onKey(e: KeyboardEvent) {
      const editable = isEditableTarget(e.target);

      // 1) Cmd/Ctrl + / — cheat sheet (həmişə işləməlidir)
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }

      // 2) "?" (shift+/) — cheat sheet (yalnız form-da deyilsə)
      if (!editable && e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCheatOpen((v) => !v);
        return;
      }

      // 3) Cmd/Ctrl + N — route-aware new
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !e.shiftKey && !e.altKey) {
        const target = getNewRouteFromPath(pathname);
        if (target) {
          e.preventDefault();
          router.push(target);
          return;
        }
      }

      // 4) Esc — cheat-sheet bağla (Dialog özü də onu edir; bu fallback)
      if (e.key === "Escape" && cheatOpen) {
        setCheatOpen(false);
        return;
      }

      // 5) Chord naviqasiya — yalnız form/input olmadıqda
      if (editable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();

      if (chordPrefix.current === "g") {
        // ikinci düymə
        let nav: string | null = null;
        if (k === "s") nav = "/ticaret/satislar";
        else if (k === "m") nav = "/maliyye/emeliyyat";
        else if (k === "a") nav = "/anbar/mehsullar";
        else if (k === "t") nav = "/tapshiriqlar";
        else if (k === "d") nav = "/dashboard";
        if (nav) {
          e.preventDefault();
          router.push(nav);
        }
        clearChord();
        return;
      }

      if (k === "g") {
        chordPrefix.current = "g";
        chordTimer.current = setTimeout(clearChord, CHORD_TIMEOUT_MS);
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearChord();
    };
  }, [pathname, router, cheatOpen]);

  return <CheatSheetModal open={cheatOpen} onOpenChange={setCheatOpen} />;
}
