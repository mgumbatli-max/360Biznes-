import type { Metadata } from "next";
import Link from "next/link";
import { Settings, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { LoyaltySettingsForm } from "@/features/kampaniyalar/components/loyalty-settings-form";

export const metadata: Metadata = { title: "Kampaniya ayarları" };

async function getLoyaltySettings() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: "loyalty" },
      select: { acar: true, deyer: true },
    });
    const map = new Map(rows.map((r) => [r.acar, r.deyer]));
    return {
      auto_create: map.get("auto_create") !== "false",                  // default true
      max_serf_pct: Number(map.get("max_serf_pct") ?? "30"),            // default 30%
      min_serf_meblegh: Number(map.get("min_serf_meblegh") ?? "5"),     // default 5 ₼
      expire_ay: Number(map.get("expire_ay") ?? "6"),                   // default 6 ay
    };
  });
}

export default async function LoyaltyAyarlarPage() {
  const settings = await getLoyaltySettings();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/kampaniyalar" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Kampaniyalar
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="h-6 w-6 text-amber-500" />
          Loyalty proqram ayarları
        </h1>
        <p className="text-sm text-muted-foreground">
          Sadiqlik kartının nəcür işlədiyini buradan tənzimlə — avto-yaratma, bonus istifadə limitləri, müddət
        </p>
      </header>

      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sahibkar ayarları</CardTitle>
        </CardHeader>
        <CardContent>
          <LoyaltySettingsForm initial={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
