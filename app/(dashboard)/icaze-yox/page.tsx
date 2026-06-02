import type { Metadata } from "next";
import Link from "next/link";
import { ShieldOff, Home, Mail } from "lucide-react";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "İcazə yoxdur" };

type SP = { kod?: string; from?: string };

export default async function ForbiddenPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const session = await auth();
  const rolAd = session?.user?.rol_ad ?? "İstifadəçi";

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-card to-amber-500/5 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/20">
          <ShieldOff className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">403</h1>
        <h2 className="mt-1 text-lg font-bold">İcazəniz çatmır</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cari rolunuz (<strong className="text-foreground">{rolAd}</strong>) bu səhifəyə girişə icazəli deyil.
        </p>
        {sp.kod && (
          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Tələb olunan icazə: <code className="font-mono font-bold">{sp.kod}</code>
          </div>
        )}
        {sp.from && (
          <p className="mt-2 text-[10.5px] text-muted-foreground">
            Mənbə: <code className="font-mono">{sp.from}</code>
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Home className="h-4 w-4" />
            Ana səhifə
          </Link>
          <Link
            href="/komekci"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
          >
            <Mail className="h-4 w-4" />
            Sahibkardan icazə istə
          </Link>
        </div>

        <p className="mt-4 text-[10.5px] text-muted-foreground">
          Bu səhifəyə girişə ehtiyacınız varsa sahibkar / admin ilə əlaqə saxlayın.
        </p>
      </div>
    </div>
  );
}
