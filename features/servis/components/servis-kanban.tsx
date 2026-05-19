"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Phone, AlertTriangle, Tag, Calendar, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SERVIS_STATUS_LABELS, SERVIS_PRIORITY_LABELS, type ServisRow } from "../types";
import { formatMoney } from "@/lib/utils";

const COLUMNS: { key: string; label: string }[] = [
  { key: "qebul_edildi", label: "Qəbul edildi" },
  { key: "diaqnostikada", label: "Diaqnostikada" },
  { key: "ehtiyat_hisse", label: "Hissə gözlə" },
  { key: "temir_olunur", label: "Təmirdə" },
  { key: "temir_edildi", label: "Hazır" },
  { key: "musteriye_tehvil", label: "Təhvil verildi" },
  { key: "redd_edildi", label: "Ləğv" },
];

// Bəzi statuslar bu sütunlara birləşir
const STATUS_MAP: Record<string, string> = {
  qebul_edildi: "qebul_edildi",
  diaqnostikada: "diaqnostikada",
  teklif_gozleyir: "diaqnostikada",
  usta_baxir: "diaqnostikada",
  ehtiyat_hisse: "ehtiyat_hisse",
  temir_olunur: "temir_olunur",
  temir_edildi: "temir_edildi",
  musteriye_tehvil: "musteriye_tehvil",
  qaytarildi: "redd_edildi",
  redd_edildi: "redd_edildi",
};

function fmt(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("az-AZ");
}

export function ServisKanban({ rows }: { rows: ServisRow[] }) {
  const grouped = useMemo(() => {
    const g = new Map<string, ServisRow[]>();
    for (const col of COLUMNS) g.set(col.key, []);
    for (const r of rows) {
      const k = STATUS_MAP[r.status] ?? "qebul_edildi";
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(r);
    }
    return g;
  }, [rows]);

  return (
    <div className="overflow-x-auto pb-3">
      <div className="grid min-w-[1280px] grid-cols-7 gap-3">
        {COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? [];
          const statusMeta = SERVIS_STATUS_LABELS[col.key];
          return (
            <div key={col.key} className="flex flex-col rounded-md border border-border bg-card/30">
              <div className={`flex items-center justify-between border-b border-border/60 px-2.5 py-2 text-xs font-medium ${statusMeta?.cls ?? ""}`}>
                <span>{col.label}</span>
                <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto p-1.5">
                {items.length === 0 ? (
                  <div className="py-6 text-center text-[10.5px] text-muted-foreground">—</div>
                ) : (
                  items.map((r) => <KanbanCard key={r.id} r={r} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ r }: { r: ServisRow }) {
  const overdue =
    r.texmini_tehvil && new Date(r.texmini_tehvil) < new Date() && !r.qapanma_tarixi;
  const prio = SERVIS_PRIORITY_LABELS[r.prioritet] ?? SERVIS_PRIORITY_LABELS.orta;

  return (
    <Link
      href={`/servis/${r.id}`}
      className={`block rounded-md border bg-background p-2 text-xs transition hover:border-primary/30 hover:shadow-sm ${
        r.prioritet === "tecili"
          ? "border-rose-500/40"
          : r.prioritet === "yuksek"
          ? "border-amber-500/40"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-[10.5px] font-semibold">{r.nomre}</div>
        <Badge variant="outline" className={`shrink-0 text-[9px] ${prio.cls}`}>
          {prio.label}
        </Badge>
      </div>
      <div className="mt-1 font-medium">{r.musteri_ad}</div>
      <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
        <Phone className="h-2.5 w-2.5" />
        <span>{r.musteri_telefon}</span>
        {r.yenidenGelen && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-amber-400">
            <Repeat className="h-2.5 w-2.5" /> təkrar
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground">
        <Tag className="h-2.5 w-2.5" />
        <span className="line-clamp-1">{r.mehsul_ad}</span>
      </div>
      {r.texmini_tehvil && (
        <div
          className={`mt-1 flex items-center gap-1 text-[10.5px] ${
            overdue ? "text-rose-400 font-medium" : "text-muted-foreground"
          }`}
        >
          {overdue ? <AlertTriangle className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
          Vəd: {fmt(r.texmini_tehvil)}
        </div>
      )}
      {r.temir_xerci > 0 && (
        <div className="mt-1 text-right text-[10.5px] font-semibold tabular-nums">
          {formatMoney(r.temir_xerci)}
        </div>
      )}
    </Link>
  );
}
