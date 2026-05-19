"use client";

import { useEffect } from "react";

/**
 * Mounts on every dashboard page. If the page is rendered inside the PageModal
 * iframe (either via ?embed=1 query or via iframe nesting), adds the
 * `embed-mode` class on <html>. Global CSS rules in `globals.css` hide the
 * sidebar, topbar, sub-nav and breadcrumbs when this class is present so the
 * embedded form fills the modal cleanly.
 */
export function EmbedDetector() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const inIframe = window.self !== window.top;
      const flag = params.get("embed") === "1";
      if (flag || inIframe) {
        document.documentElement.classList.add("embed-mode");
      }
    } catch {
      // SecurityError when accessing window.top across origins — assume embedded
      document.documentElement.classList.add("embed-mode");
    }
  }, []);
  return null;
}
