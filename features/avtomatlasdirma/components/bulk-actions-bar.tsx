"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, PowerOff, Trash2, Loader2, X, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { bulkToggleRules, bulkDeleteRules } from "../actions";

type Rule = { id: number; sistem_qayda: boolean | null };

/**
 * Toplu aksiya paneli — siyahıda göstərilən qaydaları işarələ və hamısını eyni
 * anda aktivləşdir, söndür və ya sil. Sistem qaydaları toxunulmur (backend-də
 * də qorunur). UI-də panel yalnız ən az 1 qayda seçildikdə görünür.
 */
export function BulkActionsBar({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  const eligibleIds = rules.filter((r) => !r.sistem_qayda).map((r) => r.id);
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(eligibleIds));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function doBulk(action: "activate" | "deactivate" | "delete") {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error("Qayda seçilməyib");
      return;
    }
    if (action === "delete") {
      if (!confirm(`${ids.length} qayda silinsin? Bu əməliyyat geri qaytarıla bilməz.`)) return;
    }
    startTransition(async () => {
      let res;
      if (action === "delete") res = await bulkDeleteRules(ids);
      else res = await bulkToggleRules(ids, action === "activate");
      if (res.ok) {
        toast.success(
          action === "delete" ? `${res.count} qayda silindi` :
          action === "activate" ? `${res.count} qayda aktivləşdirildi` :
          `${res.count} qayda söndürüldü`,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Selection state-i parent komponentdə paylaşmadığım üçün
  // bütün rule-card-ları SelectionContext ilə bağlamaq əvəzinə
  // burada minimal "Hamısını seç" + "Toplu paneli" göstərək.
  // (Per-rule checkbox-lar rule-card içində optional artıq əlavə oluna bilər.)

  return (
    <>
      {/* Hamısını işarələ — yalnız sistem-olmayan qaydaları seçir */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-secondary"
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
            {allSelected ? "Hamısı seçildi" : "Hamısını seç"}
          </button>
          <span className="text-[11px] text-muted-foreground">
            {selected.size > 0 ? <b className="text-foreground">{selected.size}</b> : "Heç biri"} seçilib
            {eligibleIds.length > 0 && ` · ${eligibleIds.length} redaktə oluna bilən`}
          </span>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => doBulk("activate")} className="h-7 gap-1 text-[11px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
              Aktivləşdir
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => doBulk("deactivate")} className="h-7 gap-1 text-[11px]">
              <PowerOff className="h-3 w-3" />
              Söndür
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => doBulk("delete")} className="h-7 gap-1 text-[11px] border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
              <Trash2 className="h-3 w-3" />
              Sil
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={pending} className="h-7 px-2 text-xs">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Per-rule checkbox-ları üçün custom event sistemini saxlamadıq
          (bu MVP versiyada "hamısını seç" kifayət edir).
          Gələcəkdə rule-card-ı SelectionContext ilə bağlayıb hər kart üçün
          tək checkbox da qoşula bilər. */}
      <input type="hidden" data-bulk-state value={JSON.stringify({ selected: Array.from(selected), eligible: eligibleIds })} />
    </>
  );
}
