import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsTopNav } from "@/features/ayar/components/settings-top-nav";
import { getRiskRules } from "@/features/ayarlar/risk-rules";
import { RiskRulesForm } from "@/features/ayarlar/components/risk-rules-form";

export const metadata: Metadata = { title: "Risk qaydaları" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rules = await getRiskRules();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackButton fallback="/ayarlar" label="Tənzimləmələr" />

      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tənzimləmələr</div>
          <h1 className="text-2xl font-bold tracking-tight">Risk qaydaları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Riskli əməliyyatlarda sistem davranışı: xəbərdarlıq, təsdiq tələbi, və ya qadağa.
          </p>
        </div>
      </header>

      <SettingsTopNav />

      <RiskRulesForm initial={rules} />

      <Card className="glass">
        <CardContent className="space-y-2 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Əlaqəli ayarlar</div>
          <RelatedLink href="/ayarlar/satis-tesdiq" label="Endirim təsdiq həddləri" desc="Hansı endirim faizinə kim icazə verə bilər" />
          <RelatedLink href="/ayarlar/borc-avto" label="Borc avtomatlaşdırması" desc="Gec gələn borca SMS/WhatsApp avto-xatırlatma" />
          <RelatedLink href="/avtomatlasdirma" label="Avtomatlaşdırma qaydaları" desc="Trigger əsaslı bütün qaydalar" />
          <RelatedLink href="/tesdiq" label="Təsdiq mərkəzi" desc="Gözləyən təsdiq sorğularına bax" />
          <RelatedLink href="/xeberdarliqlar" label="Risk paneli" desc="Aktiv risklər və anomaliyalar" />
        </CardContent>
      </Card>
    </div>
  );
}

function RelatedLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-border/30 px-3 py-2 transition hover:border-border hover:bg-secondary/30"
    >
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
