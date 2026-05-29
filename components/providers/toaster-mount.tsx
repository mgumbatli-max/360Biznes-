"use client";

import dynamic from "next/dynamic";

// Sonner (~25KB) ilkin hidrasiyanı bloklamasın deyə dinamik yüklə.
// Yalnız client-də göstərilir — toast SSR-da heç vaxt lazım deyil.
const ThemeAwareToaster = dynamic(
  () => import("./theme-aware-toaster").then((m) => m.ThemeAwareToaster),
  { ssr: false }
);

export function ToasterMount() {
  return <ThemeAwareToaster />;
}
