import type { Metadata } from "next";
import { Percent } from "lucide-react";
import { CommissionRulesForm } from "@/features/ticaret/components/commission-rules-form";
import {
  getCommissionTiers,
  getBonusOnTarget,
} from "@/features/ticaret/commission-queries";

export const metadata: Metadata = { title: "Komissiya qaydaları" };

export default async function KomissiyaQaydalariPage() {
  const [tiers, bonus] = await Promise.all([getCommissionTiers(), getBonusOnTarget()]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
          <Percent className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Komissiya qaydaları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Satıcı komissiyası — mərhələli (marginal) faiz cədvəli + hədəf bonusu.
          </p>
        </div>
      </header>

      <CommissionRulesForm initialTiers={tiers} initialBonus={bonus} />
    </div>
  );
}
