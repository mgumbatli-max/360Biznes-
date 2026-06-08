import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck, KeyRound, EyeOff, Clock, Lock, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PinInput } from "@/features/sahibkar/components/pin-input";
import { DEFAULT_SECRET_CODE } from "@/features/sahibkar/constants";

export const metadata: Metadata = { title: "Sahibkar — İlk qurum" };

export default async function PinSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol_ad !== "sahibkar") redirect("/dashboard");

  // If already set, send to verify instead
  const hasPin = await withTenant(async () => {
    const cfg = await prisma.sahibkar_ayar.findFirst();
    return !!cfg?.sifre_hash;
  });
  if (hasPin) redirect("/sahibkar/verify");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl shadow-lg" style={{ background: "var(--brand-gradient)" }}>
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Sahibkar bölməsinə xoş gəlmisiniz</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bu zona <strong className="text-foreground">yalnız sizə</strong> aiddir. İlk qurum üçün PIN seçin.
        </p>
      </header>

      {/* Welcome cards */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <WelcomeCard
          icon={KeyRound}
          tone="primary"
          title="2 cür giriş"
          desc="Sahibkar bölməsinə PIN ilə və ya axtarış (⌘K) kodunda gizli kodla daxil ola bilərsiniz. Default kod —"
          extra={
            <code className="mt-1 inline-block rounded bg-secondary/60 px-2 py-0.5 font-mono text-foreground">
              {DEFAULT_SECRET_CODE}
            </code>
          }
        />
        <WelcomeCard
          icon={EyeOff}
          tone="rose"
          title="Sidebar-da gizli rejim"
          desc="Bölməni sidebar-dan gizlədə bilərsiniz. Onda yalnız search-də gizli kod yazaraq açılır."
        />
        <WelcomeCard
          icon={Clock}
          tone="amber"
          title="Avto-kilid"
          desc="Aktivlik olmayan 15 dəq sonra (dəyişilə bilən) avto-kilidlənir. Hər kliklə vaxt yenilənir."
        />
      </section>

      {/* PIN form */}
      <Card className="glass mx-auto max-w-md">
        <CardContent className="space-y-4 py-6">
          <div className="text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold">PIN seçin</h2>
              <Badge variant="outline" className="text-[10px]">addım 1/1</Badge>
            </div>
            <p className="text-xs text-muted-foreground">4-8 rəqəm. Bu PIN PIN-i bilməyən hər kəsi blok edir.</p>
          </div>
          <PinInput mode="setup" />
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center text-[11px] text-amber-600 dark:text-amber-300">
        <strong>İpucu:</strong> PIN qoyulduqdan sonra <code className="rounded bg-secondary/60 px-1">/sahibkar/ayarlar</code> səhifəsindən
        sidebar görünüşü, sessiya müddəti, gizli kod, bərpa email kimi parametrləri dəqiq tənzimləyə bilərsiniz.
      </div>
    </div>
  );
}

function WelcomeCard({
  icon: Icon, tone, title, desc, extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "rose" | "amber";
  title: string;
  desc: string;
  extra?: React.ReactNode;
}) {
  const cls = tone === "primary"
    ? "border-primary/30 bg-primary/5"
    : tone === "rose"
    ? "border-rose-500/30 bg-rose-500/5"
    : "border-amber-500/30 bg-amber-500/5";
  const iconCls = tone === "primary" ? "text-primary" : tone === "rose" ? "text-rose-500" : "text-amber-500";
  return (
    <Card className={`glass ${cls}`}>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconCls}`} />
          <h3 className="text-sm font-bold">{title}</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{desc}{extra}</p>
        <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
      </CardContent>
    </Card>
  );
}
