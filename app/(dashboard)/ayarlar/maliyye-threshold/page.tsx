import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getMaliyyeThresholds } from "@/features/maliyye/extended-queries";
import { MaliyyeThresholdForm } from "@/features/maliyye/components/threshold-form";

export const metadata: Metadata = { title: "Maliyyə təsdiq hədləri" };
export const dynamic = "force-dynamic";

export default async function MaliyyeThresholdPage() {
  const limits = await getMaliyyeThresholds();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Maliyyə təsdiq hədləri</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hədddən yuxarı əməliyyatlar üçün avtomatik təsdiq tələbi yaranır. AZN-də.
        </p>
      </header>

      <Card className="glass">
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center gap-2 text-sm text-info">
            <ShieldCheck className="h-4 w-4" />
            <span>
              Təsdiq tələb edən əməliyyat status &ldquo;tesdiq_gozleyir&rdquo; (gozleyen_tesdiq) olur və admin
              icazəli istifadəçi /tesdiq səhifəsindən təsdiqləyir.
            </span>
          </div>
          <MaliyyeThresholdForm initial={limits} />
        </CardContent>
      </Card>
    </div>
  );
}
