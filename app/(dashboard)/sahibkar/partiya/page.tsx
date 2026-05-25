import type { Metadata } from "next";
import Link from "next/link";
import { Truck, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerPartiyas } from "@/features/sahibkar/owner-queries";
import { PartiyaDialog } from "@/features/sahibkar/components/partiya-dialog";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Idxal partiyaları" };
export const dynamic = "force-dynamic";

export default async function SahibkarPartiyaPage() {
  await requireSahibkarSession();
  const rows = await getOwnerPartiyas();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partiyalar (idxal)</h1>
          <p className="mt-1 text-sm text-muted-foreground">Maya, xərc və ROI izlənməsi.</p>
        </div>
        <PartiyaDialog />
      </header>

      <SectionExplainer
        icon={Truck}
        title="Partiya nədir?"
        tone="amber"
        description="Hər idxal/topdan alış bir partiyadır. Daşınma, gömrük, toplama xərcləri partiya səviyyəsində saxlanır, sonra bu partiyadan satılan məhsulun real mayası (AZN-də) hesablanır. ROI = (satışdan gələn mənfəət) / (partiya maya + xərclər)."
        bullets={[
          { label: "İzlə", text: "valyuta kursu, ölkə, təchizatçı" },
          { label: "Hesabla", text: "real maya AZN-də, paylanmış xərclər" },
          { label: "Bağla", text: "alış qaiməsi, məhsul, sənəd (DB migration sonra)" },
        ]}
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Truck className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Partiya yoxdur</h3>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Ad</th>
                <th className="px-3 py-2.5">Ölkə</th>
                <th className="px-3 py-2.5">Təchizatçı</th>
                <th className="px-3 py-2.5">Valyuta</th>
                <th className="px-3 py-2.5 text-right">Real maya (AZN)</th>
                <th className="px-3 py-2.5 text-right">Xərc (AZN)</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Tarix</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/30">
                  <td className="px-3 py-2 font-medium">{r.ad}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.olke ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.techizatci_ad ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.valyuta ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.cemi_real_maya_azn)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.cemi_xerc_azn)}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{r.status ?? "qaralama"}</Badge></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.tarix ? formatDate(r.tarix) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/sahibkar/partiya/${r.id}`} className="inline-flex items-center gap-0.5 text-[11px] text-primary-light hover:underline">
                      Detal <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
