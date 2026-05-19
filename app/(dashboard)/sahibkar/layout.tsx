import type { ReactNode } from "react";
import { ShieldOff, Settings } from "lucide-react";
import Link from "next/link";
import { getPinSession } from "@/lib/sahibkar/session";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { lockSahibkar } from "@/features/sahibkar/actions";
import { SessionCountdown } from "@/features/sahibkar/components/session-countdown";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SahibkarLayout({ children }: { children: ReactNode }) {
  // requireSahibkarSession() ayrı-ayrı page-lərdə qalır (setup/verify istisnadır).
  // Layout-un işi yalnız status strip-i bütün alt-route-larda göstərmək.
  const session = await getPinSession();

  // Setup/verify kimi cookie-siz route-larda strip görünməsin
  if (!session) return <>{children}</>;

  const cfg = await withTenant(() => prisma.sahibkar_ayar.findFirst({ select: { sessiya_muddet: true } })).catch(() => null);
  const ttlMin = cfg?.sessiya_muddet && cfg.sessiya_muddet >= 1 ? cfg.sessiya_muddet : 15;

  return (
    <>
      {/* Sahibkar status zolağı — bütün /sahibkar/* alt-route-larında qalır */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border/40 bg-background/85 px-4 py-1.5 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="hidden font-semibold tracking-wide text-foreground sm:inline">Sahibkar sessiyası</span>
            <SessionCountdown expiresAt={session.exp} ttlSec={ttlMin * 60} />
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/sahibkar/ayarlar">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                <Settings className="h-3 w-3" /> Ayarlar
              </Button>
            </Link>
            <form
              action={async () => {
                "use server";
                await lockSahibkar();
              }}
            >
              <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                <ShieldOff className="h-3 w-3" /> Kilidlə
              </Button>
            </form>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
