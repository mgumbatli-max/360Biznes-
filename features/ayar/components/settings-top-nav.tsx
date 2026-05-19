"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutGrid } from "lucide-react";

/**
 * Ayarlar bölməsi alt-səhifələrində kompakt back navigation.
 * Hub səhifəsində (/ayarlar) göstərilmir — orada artıq qruplaşma var.
 *
 * Köhnə 7-tab sticky nav silindi: 40+ ayar səhifəsi var, 7 tab heç bir
 * faydalı qovşaq deyildi və yalnız vizual yük yaradırdı.
 */
export function SettingsTopNav() {
  const pathname = usePathname();

  // Hub-da gizlədilir
  if (pathname === "/ayarlar") return null;

  return (
    <nav
      aria-label="Ayarlara qayıt"
      className="mb-2 flex items-center gap-2 text-xs"
    >
      <Link
        href="/ayarlar"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        <LayoutGrid className="h-3 w-3" />
        <span>Tənzimləmələr</span>
      </Link>
    </nav>
  );
}
