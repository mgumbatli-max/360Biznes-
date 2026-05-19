"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckSquare, Square, Printer, RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bulkChangeSaleStatus } from "../satis-actions";

type Props = {
  selectedIds: string[];
  total: number;
  onClear: () => void;
  onSelectAll: () => void;
  allSelected: boolean;
};

const STATUSES: { value: "yeni" | "tesdiq" | "gonderildi" | "tamamlandi"; label: string }[] = [
  { value: "yeni", label: "Yeni" },
  { value: "tesdiq", label: "Təsdiq" },
  { value: "gonderildi", label: "Göndərildi" },
  { value: "tamamlandi", label: "Tamamlandı" },
];

/**
 * Sticky bottom toolbar shown when one or more sales are selected.
 * Provides bulk status change (Yeni / Təsdiq / Göndərildi / Tamamlandı)
 * and a quick "open all for print" action.
 */
export function SalesBulkBar({
  selectedIds,
  total,
  onClear,
  onSelectAll,
  allSelected,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (selectedIds.length === 0) return null;

  function changeStatus(s: (typeof STATUSES)[number]["value"]) {
    if (!confirm(`${selectedIds.length} satışın statusu "${s}" edilsin?`)) return;
    startTransition(async () => {
      const r = await bulkChangeSaleStatus(selectedIds, s);
      if (r.ok) {
        toast.success(`Yeniləndi (${r.data?.count ?? 0})`);
        onClear();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function openAllPrint() {
    // Window-blocker friendly: ask user first
    if (!confirm(`${selectedIds.length} satış üçün çap pəncərələri açılsın?`)) return;
    for (const id of selectedIds.slice(0, 20)) {
      window.open(`/ticaret/satislar/${id}/print`, "_blank", "noopener");
    }
    if (selectedIds.length > 20) {
      toast.info("İlk 20 satış açıldı (brauzer limiti)");
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={allSelected ? onClear : onSelectAll}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1 text-xs font-medium"
        >
          {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          <span>
            <strong className="tabular-nums">{selectedIds.length}</strong>
            <span className="text-muted-foreground"> / {total}</span>
          </span>
        </button>

        <span className="h-4 w-px bg-border/60" />

        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status:</span>
        {STATUSES.map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant="ghost"
            onClick={() => changeStatus(s.value)}
            disabled={pending}
          >
            <RefreshCcw className="h-3 w-3" /> {s.label}
          </Button>
        ))}

        <span className="h-4 w-px bg-border/60" />

        <Button size="sm" variant="ghost" onClick={openAllPrint} disabled={pending}>
          <Printer className="h-3.5 w-3.5" /> Çap aç
        </Button>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          title="Seçimi ləğv et"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
