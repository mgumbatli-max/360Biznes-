import type { Metadata } from "next";
import Link from "next/link";
import { Copy as CopyIcon, ArrowLeft } from "lucide-react";
import { findDuplicates } from "@/features/elaqe/queries";
import { DuplicateCard } from "@/features/elaqe/components/duplicate-card";
import { AutoMergeButton } from "@/features/elaqe/components/auto-merge-button";

export const metadata: Metadata = { title: "Dublikat tapan" };
export const dynamic = "force-dynamic";

export default async function DublikatPage() {
  const pairs = await findDuplicates();

  // High-confidence suggestions: pairs of size exactly 2 with same VÖEN, FİN, or telefon
  // and which share at least one of (telefon match) — these are auto-mergeable.
  const suggested = pairs
    .filter((p) => p.contacts.length === 2 && (p.kind === "voen" || p.kind === "fin" || p.kind === "telefon"))
    .map((p) => {
      // Pick "primary" = the contact with more existing data (non-null fields count + earliest yaradildi)
      const scored = p.contacts.map((c) => {
        let score = 0;
        if (c.telefon) score++;
        if (c.email) score++;
        if (c.voen) score++;
        if (c.fin_kod) score++;
        if (c.borc > 0) score++;
        return { c, score };
      });
      scored.sort((a, b) => b.score - a.score || (a.c.yaradildi?.getTime() ?? 0) - (b.c.yaradildi?.getTime() ?? 0));
      const primary = scored[0].c;
      const others = scored.slice(1).map((s) => s.c.id);
      return {
        primaryId: primary.id,
        primaryAd: primary.ad,
        mergeIds: others,
        kind: p.kind,
        value: p.value,
      };
    });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dublikat tapan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Telefon, VÖEN, FİN, email və ad oxşarlığına görə təkrarlanan qeydlər.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/elaqe" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Geri
          </Link>
          {suggested.length > 0 && <AutoMergeButton suggestions={suggested} />}
        </div>
      </header>

      {pairs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-success/15">
            <CopyIcon className="h-5 w-5 text-success" />
          </div>
          <h3 className="font-semibold">Dublikat tapılmadı</h3>
          <p className="mt-1 text-sm text-muted-foreground">Bazada təkrarlanan qeyd yoxdur.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{pairs.length} dublikat qrupu</span> tapıldı.
            Saxlamaq istədiyiniz qeydi seçin, sonra Birləşdir düyməsinə basın.
          </p>
          {pairs.map((p, i) => (
            <DuplicateCard key={`${p.kind}-${p.value}-${i}`} pair={p} />
          ))}
        </div>
      )}
    </div>
  );
}
