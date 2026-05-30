import type { Metadata } from "next";
import { GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmSubNav } from "@/components/crm-subnav";
import { getLeadFunnel } from "@/features/crm/dashboard-queries";
import { getFunnelFilters } from "@/features/crm/funnel-queries";
import { FunnelView } from "@/features/crm/components/funnel-view";

export const metadata: Metadata = { title: "Sifariş axını (Funnel)" };

type SearchParams = Promise<{ menecer?: string; menbe?: string; from?: string; to?: string }>;

export default async function FunnelPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filter = {
    menecer_id: sp.menecer || null,
    menbe: sp.menbe || null,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
  };

  const [funnel, filters] = await Promise.all([getLeadFunnel(filter), getFunnelFilters()]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <CrmSubNav active="/crm/funnel" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GitBranch className="h-5 w-5" /> Sifariş axını
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lead pipeline-ında hər mərhələdə nə qədər müştəri və potensial dəyər var.
        </p>
      </header>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <FunnelView funnel={funnel} users={filters.users} menbeler={filters.menbeler} />
        </CardContent>
      </Card>
    </div>
  );
}
