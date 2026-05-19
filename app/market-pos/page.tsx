import type { Metadata } from "next";
import { auth } from "@/auth";
import { MarketSatisClient } from "@/features/ticaret/components/market-satis-client";
import { getAnbarOptions } from "@/features/ticaret/satis-yeni-queries";
import { getAccounts } from "@/features/maliyye/account-queries";

export const metadata: Metadata = { title: "Marketdən satış" };
export const dynamic = "force-dynamic";

export default async function MarketPosPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [anbarlar, accounts] = await Promise.all([
    getAnbarOptions(),
    getAccounts().catch(() => []),
  ]);

  // Marketplace payouts go to bank / kart accounts (not negd kassa)
  const hesablar = accounts
    .filter((a) => a.aktiv && !a.is_kassa && (a.nov === "bank" || a.nov === "kart"))
    .map((a) => ({
      id: a.id,
      ad: a.ad,
      nov: a.nov,
      bank_adi: a.bank_adi,
      kart_son4: a.kart_son4,
    }));

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
      <MarketSatisClient anbarlar={anbarlar} hesablar={hesablar} />
    </div>
  );
}
