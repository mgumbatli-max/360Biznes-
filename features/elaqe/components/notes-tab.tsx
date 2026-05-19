"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { addContactNote } from "../actions";
import { formatDate } from "@/lib/utils";

type Note = {
  id: number | bigint;
  matn: string;
  yaradildi: Date | null;
  istifadeciler: { ad_soyad: string } | null;
};

export function NotesTab({ kontragentId, initialNotes }: { kontragentId: string; initialNotes: Note[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    const fd = new FormData();
    fd.set("kontragent_id", kontragentId);
    fd.set("matn", text.trim());
    startTransition(async () => {
      const res = await addContactNote(fd);
      if (res.ok) {
        toast.success("Qeyd əlavə edildi");
        setText("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card/40 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Yeni qeyd yaz..."
          rows={3}
          maxLength={2000}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          disabled={pending}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10.5px] text-muted-foreground">{text.length} / 2000</span>
          <Button type="submit" size="sm" disabled={pending || !text.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Əlavə et
          </Button>
        </div>
      </form>

      {initialNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <StickyNote className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Hələ qeyd yoxdur</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initialNotes.map((n) => (
            <li key={String(n.id)} className="rounded-lg border border-border/40 bg-background px-3 py-2">
              <div className="whitespace-pre-line text-sm">{n.matn}</div>
              <div className="mt-1 text-[10.5px] text-muted-foreground">
                {n.istifadeciler?.ad_soyad ?? "Sistem"} · {formatDate(n.yaradildi, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
