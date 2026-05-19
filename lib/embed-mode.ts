/**
 * Helpers for pages that may be rendered inside the PageModal iframe.
 *
 * Usage in client forms:
 *   if (isEmbedded()) {
 *     closePageModal();
 *   } else {
 *     router.push(`/ticaret/satislar/${id}`);
 *   }
 */

export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true; // cross-origin throw — assume embedded
  }
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("embed-mode")) return true;
  }
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get("embed") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function closePageModal(): void {
  if (typeof window === "undefined") return;
  try {
    window.parent.postMessage({ type: "page-modal-close" }, "*");
  } catch {
    /* ignore */
  }
}
