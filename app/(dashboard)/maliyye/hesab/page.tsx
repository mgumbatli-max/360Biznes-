import type { Metadata } from "next";
import { Wallet, Landmark, Coins, Banknote } from "lucide-react";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { AccountsTable } from "@/features/maliyye/components/accounts-table";
import { AccountDialog } from "@/features/maliyye/components/account-dialog";
import { getAccounts, getAccountStats } from "@/features/maliyye/account-queries";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Hesablar" };

type SearchParams = { kateqoriya?: string };

export default async function HesabPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const kat = sp.kateqoriya ?? "";

  const [rows, stats] = await Promise.all([getAccounts(), getAccountStats()]);
  const filtered =
    kat === "kassa"
      ? rows.filter((r) => r.is_kassa)
      : kat === "bank"
        ? rows.filter((r) => r.nov === "bank" || r.nov === "kart")
        : kat === "diger"
          ? rows.filter((r) => !r.is_kassa && r.nov !== "bank" && r.nov !== "kart")
          : rows;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hesablar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kassalar, bank hesabları və əlavə hesablar bir cədvəldə.
          </p>
        </div>
        <AccountDialog />
      </header>

      <MaliyyeSubNav active="/maliyye/hesab" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Wallet} label="Cəm hesab" value={String(stats.hesab_say)} subline="Bütün növlər" />
        <KpiCard icon={Coins} label="Kassa" value={String(stats.kassa_say)} subline="Aktiv kassalar" tone="success" />
        <KpiCard icon={Landmark} label="Bank/Kart" value={String(stats.bank_say)} subline="Bank hesabları" />
        <KpiCard icon={Banknote} label="Cəm balans (AZN)" value={formatMoney(stats.cem_balans_azn)} tone="success" />
      </section>

      {/* Kateqoriya filter */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(["", "kassa", "bank", "diger"] as const).map((k) => {
          const label = k === "" ? "Hamısı" : k === "kassa" ? "Kassa" : k === "bank" ? "Bank/Kart" : "Digər";
          const href = k === "" ? "/maliyye/hesab" : `/maliyye/hesab?kateqoriya=${k}`;
          const on = (kat || "") === k;
          return (
            <a
              key={k || "all"}
              href={href}
              className={`rounded-lg border px-3 py-1.5 font-semibold ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card/40 text-muted-foreground hover:bg-secondary"}`}
            >
              {label}
            </a>
          );
        })}
      </div>

      <AccountsTable items={filtered} />
    </div>
  );
}
