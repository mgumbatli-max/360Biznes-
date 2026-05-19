"use client";

import { useMemo, useState } from "react";
import { Pin, Search, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NoteDialog, DeleteNoteButton } from "./note-dialog";
import { formatDate } from "@/lib/utils";
import type { ViewMode } from "@/components/ui/view-toggle";

type Note = {
  id: number;
  basliq: string | null;
  metn: string | null;
  reng: string | null;
  pinned: boolean;
  yaradildi: Date | string | null;
  yenilendi: Date | string | null;
};

const COLOR_CLASS: Record<string, string> = {
  sari: "bg-[hsl(54_95%_92%)] border-[hsl(54_80%_82%)] text-[hsl(30_60%_22%)]",
  yasil: "bg-[hsl(141_70%_92%)] border-[hsl(141_60%_80%)] text-[hsl(150_55%_22%)]",
  mavi: "bg-[hsl(213_85%_93%)] border-[hsl(213_75%_82%)] text-[hsl(220_60%_26%)]",
  cehrayi: "bg-[hsl(327_80%_94%)] border-[hsl(327_70%_84%)] text-[hsl(335_55%_30%)]",
  qirmizi: "bg-[hsl(0_75%_94%)] border-[hsl(0_65%_84%)] text-[hsl(0_60%_30%)]",
  "bənövşəyi": "bg-[hsl(265_75%_94%)] border-[hsl(265_65%_84%)] text-[hsl(265_55%_30%)]",
  boz: "bg-[hsl(210_25%_94%)] border-[hsl(210_15%_84%)] text-[hsl(215_25%_30%)]",
};

const COLOR_DOT: Record<string, string> = {
  sari: "bg-yellow-400",
  yasil: "bg-emerald-500",
  mavi: "bg-sky-500",
  cehrayi: "bg-pink-500",
  qirmizi: "bg-rose-500",
  "bənövşəyi": "bg-violet-500",
  boz: "bg-slate-400",
};

export function StickyNotesGrid({ notes, view = "card" }: { notes: Note[]; view?: ViewMode }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return notes;
    return notes.filter(
      (n) =>
        (n.basliq ?? "").toLowerCase().includes(term) ||
        (n.metn ?? "").toLowerCase().includes(term)
    );
  }, [notes, q]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Qeydlərdə axtar..."
          className="h-9 pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <StickyNote className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">
            {q ? "Heç bir qeyd tapılmadı" : "Hələ qeyd yoxdur"}
          </h3>
        </div>
      ) : view === "list" ? (
        <NotesListView notes={filtered} />
      ) : (
        <NotesCardView notes={filtered} />
      )}
    </div>
  );
}

function NotesCardView({ notes }: { notes: Note[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n) => {
        const cls = COLOR_CLASS[(n.reng ?? "sari").toLowerCase()] ?? COLOR_CLASS.sari;
        return (
          <div
            key={n.id}
            className={`group relative rounded-xl border px-4 py-3 transition hover:shadow-md ${cls}`}
          >
            {n.pinned && (
              <span className="absolute -top-2 right-3 inline-flex items-center gap-0.5 rounded-md bg-danger px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                <Pin className="h-2.5 w-2.5" /> PIN
              </span>
            )}
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 pr-12 text-sm font-semibold">
                {n.basliq ?? "(başlıqsız)"}
              </h3>
              <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
                <NoteDialog
                  note={{
                    id: n.id,
                    basliq: n.basliq,
                    metn: n.metn,
                    reng: n.reng,
                    pinned: n.pinned,
                  }}
                />
                <DeleteNoteButton id={n.id} />
              </div>
            </div>
            {n.metn ? (
              <p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs leading-relaxed opacity-90">
                {n.metn}
              </p>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-current/10 pt-2 text-[10.5px] font-medium opacity-70">
              <Badge variant="outline" className="bg-white/40 text-[10px]">
                {n.reng ?? "sari"}
              </Badge>
              <span>
                {formatDate(n.yenilendi ?? n.yaradildi, {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotesListView({ notes }: { notes: Note[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/40">
      <table className="w-full text-sm">
        <thead className="border-b border-border/40 bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="w-6 px-2 py-2"></th>
            <th className="px-3 py-2 text-left">Başlıq</th>
            <th className="hidden px-3 py-2 text-left md:table-cell">Mətn</th>
            <th className="w-24 px-3 py-2 text-left">Rəng</th>
            <th className="w-32 px-3 py-2 text-left">Tarix</th>
            <th className="w-20 px-3 py-2 text-right">Əməl</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n) => {
            const dot = COLOR_DOT[(n.reng ?? "sari").toLowerCase()] ?? COLOR_DOT.sari;
            return (
              <tr key={n.id} className="group border-b border-border/30 transition hover:bg-secondary/30">
                <td className="px-2 py-2 text-center">
                  {n.pinned ? <Pin className="inline h-3 w-3 text-rose-500" /> : <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />}
                </td>
                <td className="px-3 py-2 font-medium">
                  {n.basliq ?? <span className="italic text-muted-foreground">(başlıqsız)</span>}
                </td>
                <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                  {n.metn ? <span className="line-clamp-1">{n.metn}</span> : "—"}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px]">{n.reng ?? "sari"}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatDate(n.yenilendi ?? n.yaradildi, {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <NoteDialog
                      note={{
                        id: n.id,
                        basliq: n.basliq,
                        metn: n.metn,
                        reng: n.reng,
                        pinned: n.pinned,
                      }}
                    />
                    <DeleteNoteButton id={n.id} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
