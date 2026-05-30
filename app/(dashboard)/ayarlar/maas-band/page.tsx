import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { MaasBandPanel } from "@/features/iscilier/components/maas-band-panel";
import { getMaasBands } from "@/features/iscilier/maas-band-queries";

export const metadata: Metadata = { title: "Maaş aralığı" };

export default async function MaasBandPage() {
  const bands = await getMaasBands();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maaş aralığı (salary band)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hər vəzifə üçün min / ortalama / max maaş aralığı. Cari işçi maaşları aralıqdan kənardadırsa qeyd olunur.
          </p>
        </div>
      </header>

      <MaasBandPanel initial={bands} />
    </div>
  );
}
