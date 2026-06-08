"use client";

import Link from "next/link";
import { toast } from "sonner";
import type { Blocker } from "@/lib/blockers/types";
import { ArrowRight, CreditCard, FileText, Package, Truck, User, Wrench } from "lucide-react";

const TYPE_ICON: Record<Blocker["type"], React.ReactNode> = {
  odenis: <CreditCard className="h-4 w-4 shrink-0" />,
  kassa_emeliyyati: <CreditCard className="h-4 w-4 shrink-0" />,
  hesab_emeliyyati: <CreditCard className="h-4 w-4 shrink-0" />,
  satis: <FileText className="h-4 w-4 shrink-0" />,
  alis: <FileText className="h-4 w-4 shrink-0" />,
  qaytarma: <FileText className="h-4 w-4 shrink-0" />,
  teklif: <FileText className="h-4 w-4 shrink-0" />,
  kredit_satis: <FileText className="h-4 w-4 shrink-0" />,
  transfer: <Package className="h-4 w-4 shrink-0" />,
  stok_duzelis: <Package className="h-4 w-4 shrink-0" />,
  defekt: <Package className="h-4 w-4 shrink-0" />,
  musteri: <User className="h-4 w-4 shrink-0" />,
  techizatci: <User className="h-4 w-4 shrink-0" />,
  servis: <Wrench className="h-4 w-4 shrink-0" />,
  leyd: <User className="h-4 w-4 shrink-0" />,
  kampaniya: <FileText className="h-4 w-4 shrink-0" />,
  tapsiriq: <FileText className="h-4 w-4 shrink-0" />,
  iscik: <User className="h-4 w-4 shrink-0" />,
};

const TYPE_LABEL: Record<Blocker["type"], string> = {
  odenis: "Ödəniş",
  kassa_emeliyyati: "Kassa hərəkəti",
  hesab_emeliyyati: "Hesab hərəkəti",
  satis: "Satış",
  alis: "Alış",
  qaytarma: "Qaytarma",
  teklif: "Təklif",
  kredit_satis: "Kredit satışı",
  transfer: "Transfer",
  stok_duzelis: "Stok düzəlişi",
  defekt: "Defekt",
  musteri: "Müştəri",
  techizatci: "Təchizatçı",
  servis: "Servis",
  leyd: "Leyd",
  kampaniya: "Kampaniya",
  tapsiriq: "Tapşırıq",
  iscik: "İşçi",
};

export function BlockerList({ blockers }: { blockers: Blocker[] }) {
  if (!blockers || blockers.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
      {blockers.map((b) => (
        <li key={`${b.type}-${b.id}`}>
          <Link
            href={b.href}
            target="_blank"
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-accent transition-colors group"
          >
            <span className="text-muted-foreground">{TYPE_ICON[b.type]}</span>
            <span className="font-medium text-foreground/80">{TYPE_LABEL[b.type]}:</span>
            <span className="flex-1 truncate">{b.label}</span>
            {b.badge ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {b.badge}
              </span>
            ) : null}
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Server action xətasını intelligent toast kimi göstər.
 *
 * İstifadə:
 *   const res = await cancelSale(id, sebeb);
 *   if (!res.ok) {
 *     showActionError(res);
 *     return;
 *   }
 */
export function showActionError(result: {
  ok: false;
  error: string;
  blockers?: Blocker[];
  hint?: string;
}): void {
  const hasBlockers = result.blockers && result.blockers.length > 0;
  toast.error(result.error, {
    duration: hasBlockers ? 12000 : 5000,
    description: hasBlockers ? (
      <div className="mt-1">
        {result.hint ? (
          <p className="text-xs text-muted-foreground mb-1">{result.hint}</p>
        ) : null}
        <BlockerList blockers={result.blockers!} />
      </div>
    ) : (
      result.hint
    ),
  });
}
