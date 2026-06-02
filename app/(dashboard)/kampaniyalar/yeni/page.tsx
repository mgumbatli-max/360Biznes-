import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Sparkles, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewCampaignForm } from "@/features/kampaniyalar/components/new-campaign-form";
import type { KampaniyaTip } from "@/features/kampaniyalar/types";

export const metadata: Metadata = { title: "Yeni kampaniya" };

const TIP_LIST: KampaniyaTip[] = [
  "percent_endirim", "sabit_endirim", "bogo", "pillevari",
  "sebet_endirim", "pulsuz_catdirilma", "loyalty", "coupon",
  "gift_card", "flash_sale", "doğum_gunu", "welcome", "reaktivlesdir",
];

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ tip?: string }> }) {
  const sp = await searchParams;
  const initialTip = sp.tip && TIP_LIST.includes(sp.tip as KampaniyaTip) ? (sp.tip as KampaniyaTip) : undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Plus className="h-6 w-6 text-violet-500" />
          Yeni kampaniya
        </h1>
        <p className="text-sm text-muted-foreground">
          Sıfırdan kampaniya yarat və ya{" "}
          <Link href="/kampaniyalar/sablonlar" className="font-medium text-violet-500 hover:underline">
            hazır şablondan
          </Link>{" "}
          başla
        </p>
      </header>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-500" /> Kampaniya məlumatları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NewCampaignForm initialTip={initialTip} />
        </CardContent>
      </Card>
    </div>
  );
}
