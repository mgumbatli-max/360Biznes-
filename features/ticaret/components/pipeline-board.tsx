"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import { changeSaleStatus } from "../satis-actions";
import {
  PIPELINE_ORDER,
  PIPELINE_LABELS,
  type PipelineColumn,
  type PipelineStage,
} from "../pipeline-types";

type DbStatus = "yeni" | "tesdiq" | "gonderildi" | "tamamlandi";

const STAGE_TO_DB: Partial<Record<PipelineStage, DbStatus>> = {
  // teklif -> qaralama yox, qaralama=true; bu kanban-da əl ilə düyməsi
  //   ilə dəyişdirilmir (təklif yaratmaq üçün ayrı submodul mövcuddur).
  sifaris: "yeni",
  sovde: "tesdiq",
  catdir: "gonderildi",
  catib: "tamamlandi",
  faktura: "tamamlandi",
  odendi: "tamamlandi",
};

export function PipelineBoard({ columns }: { columns: PipelineColumn[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function next(idx: number): PipelineStage | null {
    if (idx < 0 || idx >= PIPELINE_ORDER.length - 1) return null;
    return PIPELINE_ORDER[idx + 1];
  }

  function move(id: string, fromIdx: number) {
    const target = next(fromIdx);
    if (!target) return;
    const dbStatus = STAGE_TO_DB[target];
    if (!dbStatus) return;
    start(async () => {
      const res = await changeSaleStatus(id, dbStatus);
      if (!res.ok) {
        toast.error(res.error ?? "Status dəyişdirilmədi");
        return;
      }
      toast.success(`Status: ${PIPELINE_LABELS[target]}`);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {columns.map((col, idx) => (
          <div key={col.stage} className="w-[260px] shrink-0 space-y-2">
            <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider">{col.label}</div>
                <Badge variant="outline" className="text-[10px]">{col.count}</Badge>
              </div>
              <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {formatMoney(col.total)}
              </div>
            </div>
            <div className="space-y-1.5 min-h-[120px]">
              {col.items.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/40 py-4 text-center text-[11px] text-muted-foreground">
                  Bu mərhələdə sənəd yoxdur
                </div>
              ) : (
                col.items.map((it) => (
                  <Card key={it.id} className="glass p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <Link
                        href={`/ticaret/satislar/${it.id}`}
                        className="font-mono text-[11px] font-medium hover:text-primary"
                      >
                        {it.nomre}
                      </Link>
                      <Badge variant="outline" className="text-[9px] py-0">
                        {it.yas_gun}g
                      </Badge>
                    </div>
                    <div className="truncate text-muted-foreground">{it.musteri_ad ?? "—"}</div>
                    <div className="flex items-center justify-between">
                      <span className="tabular-nums font-semibold">{formatMoney(it.son_mebleg)}</span>
                      {next(idx) && STAGE_TO_DB[next(idx)!] && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => move(it.id, idx)}
                          className="inline-flex items-center gap-0.5 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                          title={`Növbəti: ${PIPELINE_LABELS[next(idx)!]}`}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
