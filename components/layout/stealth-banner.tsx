import { EyeOff } from "lucide-react";
import Link from "next/link";
import { getStealthState } from "@/lib/stealth/server";

/**
 * Gizli rejim aktivdirsə, hər səhifədə üst hissədə sticky banner göstərir.
 * Sahibkar səhv etməsin deyə — daimi xəbərdarlıq.
 */
export async function StealthBanner() {
  const stealth = await getStealthState();
  if (!stealth.aktiv) return null;
  return (
    <div className="sticky top-0 z-40 w-full border-b border-violet-500/30 bg-violet-500/15 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-1.5 text-[11px]">
        <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
          <EyeOff className="h-3.5 w-3.5" />
          <span className="font-bold">🔒 Gizli mod aktivdir</span>
          <span className="text-muted-foreground">
            — ekranda rəqəmlər {Math.round(stealth.scale * 100)}% göstərilir (real data DB-də toxunulmaz)
          </span>
        </div>
        <Link
          href="/sahibkar/gizli-mod"
          className="rounded border border-violet-500/30 bg-background/40 px-2 py-0.5 font-semibold text-violet-700 hover:bg-background/60 dark:text-violet-300"
        >
          İdarə et
        </Link>
      </div>
    </div>
  );
}
