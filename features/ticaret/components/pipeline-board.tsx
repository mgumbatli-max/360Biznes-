"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, GripVertical } from "lucide-react";
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

const DRAG_MIME = "application/x-pipeline-card";

type DragPayload = {
  id: string;
  fromIdx: number;
};

export function PipelineBoard({ columns }: { columns: PipelineColumn[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function next(idx: number): PipelineStage | null {
    if (idx < 0 || idx >= PIPELINE_ORDER.length - 1) return null;
    return PIPELINE_ORDER[idx + 1];
  }

  function moveByClick(id: string, fromIdx: number) {
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

  function moveToColumn(id: string, fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    if (toIdx < 0 || toIdx >= PIPELINE_ORDER.length) return;
    const target = PIPELINE_ORDER[toIdx];
    const dbStatus = STAGE_TO_DB[target];
    if (!dbStatus) {
      toast.error(`«${PIPELINE_LABELS[target]}» mərhələsinə kanban üzərindən keçid mümkün deyil`);
      return;
    }
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

  function onDragStart(e: React.DragEvent<HTMLDivElement>, id: string, fromIdx: number) {
    const payload: DragPayload = { id, fromIdx };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }
  function onDragEnd() {
    setDraggingId(null);
    setDragOverIdx(null);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>, idx: number) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    setDraggingId(null);
    setDragOverIdx(null);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      moveToColumn(payload.id, payload.fromIdx, idx);
    } catch {
      /* invalid payload */
    }
  }

  // Cəm summary — bütün sütunlar üzrə ümumi say + məbləğ
  const totalCount = columns.reduce((s, c) => s + c.count, 0);
  const totalSum = columns.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline xülasə
        </span>
        <span>
          <strong className="tabular-nums">{totalCount}</strong> aktiv sənəd
        </span>
        <span>
          Cəm:{" "}
          <strong className="tabular-nums">{formatMoney(totalSum)}</strong>
        </span>
        <span className="ml-auto text-[10.5px] text-muted-foreground">
          💡 Kartı tutub başqa sütuna sürüşdür və ya{" "}
          <ChevronRight className="inline h-3 w-3" /> ilə növbəti mərhələyə keç
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {columns.map((col, idx) => {
            const isDropTarget = dragOverIdx === idx;
            const isAllowedDrop = STAGE_TO_DB[col.stage] != null;
            return (
              <div
                key={col.stage}
                className="w-[260px] shrink-0 space-y-2"
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={(e) => onDrop(e, idx)}
                onDragLeave={() => setDragOverIdx(null)}
              >
                <div
                  className={`rounded-lg border px-3 py-2 transition ${
                    isDropTarget && isAllowedDrop
                      ? "border-primary/60 bg-primary/10"
                      : isDropTarget
                      ? "border-rose-500/40 bg-rose-500/10"
                      : "border-border/60 bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider">{col.label}</div>
                    <Badge variant="outline" className="text-[10px]">{col.count}</Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {formatMoney(col.total)}
                  </div>
                </div>
                <div
                  className={`min-h-[120px] space-y-1.5 rounded-md p-1 transition ${
                    isDropTarget && isAllowedDrop ? "bg-primary/5 ring-1 ring-primary/30" : ""
                  }`}
                >
                  {col.items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/40 py-4 text-center text-[11px] text-muted-foreground">
                      {isDropTarget && isAllowedDrop ? "Buraya bırak" : "Bu mərhələdə sənəd yoxdur"}
                    </div>
                  ) : (
                    col.items.map((it) => (
                      <Card
                        key={it.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, it.id, idx)}
                        onDragEnd={onDragEnd}
                        className={`glass cursor-grab space-y-1 p-2.5 text-xs transition active:cursor-grabbing ${
                          draggingId === it.id ? "opacity-40" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            <Link
                              href={`/ticaret/satislar/${it.id}`}
                              className="truncate font-mono text-[11px] font-medium hover:text-primary"
                              draggable={false}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {it.nomre}
                            </Link>
                          </div>
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
                              onClick={() => moveByClick(it.id, idx)}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
