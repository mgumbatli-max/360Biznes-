import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, ListChecks, ShieldCheck } from "lucide-react";
import type { LabFeature } from "../catalog";

/**
 * Placeholder sandbox for features that don't yet have a custom interactive demo.
 * Shows the feature's promised benefits and a "Demo simulation" panel.
 */
export function SandboxGeneric({ feature }: { feature: LabFeature }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-4 w-4 text-amber-500" />
            Demo simulyasiyası
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="leading-relaxed">
              <strong>{feature.ad}</strong> — bu funksiya hazırda <strong>preview</strong> mərhələsindədir. Yuxarıdakı
              &ldquo;Aktivləşdir&rdquo; düyməsi ilə öz LAB hesabınızda aktiv edə bilərsiniz.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Necə işləyəcək</h4>
            <p className="rounded-md border border-border bg-secondary/30 p-3 text-sm leading-relaxed">
              {feature.tesvir}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Test addımları</h4>
            <ol className="space-y-1.5 text-sm">
              {[
                "Yuxarıdan funksiyanı aktivləşdir (Aktivləşdir düyməsi)",
                "Aktiv olduqda, bu sandbox-da əlavə UI element görünəcək",
                "Test verilənləri ilə əməliyyatları yoxla",
                "Bəyənmədinsə, eyni düymə ilə söndür",
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border border-border/40 bg-secondary/20 px-3 py-1.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" />
            Faydalar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {feature.faydasi && feature.faydasi.length > 0 ? (
            <ul className="space-y-1.5">
              {feature.faydasi.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Bu funksiya işlənərkən faydalar əlavə olunacaq.</p>
          )}

          <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
            <div className="flex items-center gap-1 font-semibold text-emerald-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Təhlükəsizlik
            </div>
            <p className="mt-1 text-emerald-700 dark:text-emerald-300">
              Bu funksiya yalnız LAB içində işləyir. Aktivləşdirsən belə, başqa modullarda heç bir dəyişiklik baş verməz.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
