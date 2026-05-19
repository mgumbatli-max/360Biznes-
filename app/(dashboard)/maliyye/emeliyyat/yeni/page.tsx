import type { Metadata } from "next";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { OperationForm } from "@/features/maliyye/components/operation-form";
import { getQuickRefs } from "@/features/maliyye/queries";

export const metadata: Metadata = { title: "Yeni əməliyyat" };
export const dynamic = "force-dynamic";

export default async function YeniEmeliyyatPage({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const sp = await searchParams;
  const initialTip = sp.tip ?? "qaime";

  const refs = await getQuickRefs();

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Yeni əməliyyat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tipi seç və müvafiq formanı doldur. Prospect ERP üslublu vahid axın.
        </p>
      </header>

      <MaliyyeSubNav active="/maliyye/emeliyyat" />

      <OperationForm
        initialTip={initialTip}
        hesablar={refs.hesablar}
        iscilier={refs.iscilier}
        kontragentler={refs.kontragentler}
      />
    </div>
  );
}
