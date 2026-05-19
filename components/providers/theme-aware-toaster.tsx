"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}
