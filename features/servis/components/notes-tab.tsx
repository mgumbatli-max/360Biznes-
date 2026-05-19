"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addRepairNote } from "../actions";

export type NoteEntry = {
  id: number;
  qeyd: string | null;
  yaradildi: Date | null;
  yeni_status: string;
  /** İstəyə bağlı: deyişən istifadəçinin adı */
  deyisen_ad?: string | null;
};

/**
 * Qeyd tab — sn2 screenshot dizaynına uyğun.
 * Textarea + Yadda saxla. Hər qeyd ayrıca timestamp + istifadəçi ilə.
 * Saxlama: `addRepairNote` action `servis_status_tarixce.qeyd` sahəsinə yazır
 * (yeni_status = "qeyd"), beləcə tarixçədə görsənir.
 */
export function NotesTab({
  servisId,
  notes,
}: {
  servisId: string;
  notes: NoteEntry[];
}) {
  const router = useRouter();
  const [val, setVal] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const txt = val.trim();
    if (txt.length < 1) return;
    const fd = new FormData();
    fd.append("id", servisId);
    fd.append("qeyd", txt);
    startTransition(async () => {
      const res = await addRepairNote(fd);
      if (res.ok) {
        toast.success("Qeyd əlavə olundu");
        setVal("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Yalnız sadəcə qeyd (status keçidi olmayan) sətirləri göstərir.
  const filtered = notes.filter((n) => n.yeni_status === "qeyd" && n.qeyd && n.qeyd.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border/60 bg-card/40 p-3">
        <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
          Yeni qeyd
        </Label>
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Daxili qeyd, baxış nəticəsi və ya əlavə açıqlama…"
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-end">
          <Button size="sm" onClick={submit} disabled={pending || val.trim().length < 1}>
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Yadda saxla
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
          <StickyNote className="h-4 w-4" />
          <span>Hələ qeyd yoxdur.</span>
        </div>
      ) : (
        <ol className="space-y-2">
          {filtered.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-border/40 bg-card/40 p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                {n.deyisen_ad && <span className="font-medium">{n.deyisen_ad}</span>}
                {n.yaradildi && (
                  <span className="ml-auto">
                    {new Date(n.yaradildi).toLocaleString("az-AZ")}
                  </span>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.qeyd}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
