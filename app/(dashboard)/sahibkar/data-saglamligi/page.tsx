import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getDataHealth } from "@/features/sahibkar/owner-queries";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";

export const metadata: Metadata = { title: "Data sağlamlığı" };
export const dynamic = "force-dynamic";

const PRIO_TONE: Record<string, string> = {
  yuksek: "text-danger",
  orta: "text-warning",
  asagi: "text-muted-foreground",
};

export default async function DataSaglamliqPage() {
  await requireSahibkarSession();
  const rows = await getDataHealth();
  const totalIssues = rows.reduce((s, r) => s + r.say, 0);
  const imageless = rows.find((r) => r.kod === "seki_olmayan");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data sağlamlığı</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sistem anomaliyaları və düzəltməli vəziyyətlər.</p>
        </div>
        {imageless && imageless.say > 0 ? (
          <Button asChild size="sm" variant="outline" className="border-primary/30">
            <Link href={`/anbar/anomali?fix=seki_olmayan`}>
              <Sparkles className="h-3.5 w-3.5" /> Bütün şəkilsizləri auto-AI ilə düzəlt ({imageless.say})
            </Link>
          </Button>
        ) : null}
      </header>

      <SectionExplainer
        icon={Activity}
        title="Data sağlamlığı nəyə yarayır?"
        tone="rose"
        description="Datanda olan problemləri bir baxışda görürsən: şəkilsiz məhsul, barkodsuz mal, mayasız partiya, qiymətsiz mal və s. Hər anomaliya birbaşa /anbar/anomali bölməsinə bağlanır — orada düzəliş edə bilərsən. Defekt rezerv, AI-bazalı toplu düzəltmə bölmələri də əlavədir."
        bullets={[
          { label: "Anomaliya", text: "şəkilsiz, barkodsuz, mayasız mal" },
          { label: "AI fix", text: "şəkilsiz məhsullara avto-şəkil" },
          { label: "Prioritet", text: "yüksək (qırmızı) → aşağı (boz)" },
        ]}
      />

      <Card className="glass">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary-light" />
            <span className="text-sm font-semibold">Cəmi problem</span>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${totalIssues > 0 ? "text-warning" : "text-success"}`}>{totalIssues}</span>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.kod} className="glass">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                {r.say > 0 ? <AlertTriangle className={`h-4 w-4 ${PRIO_TONE[r.prioritet]}`} /> : <Activity className="h-4 w-4 text-success" />}
                <div>
                  <div className="text-sm font-semibold">{r.ad}</div>
                  <div className="text-xs text-muted-foreground">Kod: <span className="font-mono">{r.kod}</span></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${PRIO_TONE[r.prioritet]}`}>{r.prioritet}</Badge>
                <span className="text-lg font-bold tabular-nums">{r.say}</span>
                {r.say > 0 ? (
                  <Link href={r.hed_link} className="inline-flex items-center gap-1 text-xs text-primary-light">
                    Düzəlt <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
