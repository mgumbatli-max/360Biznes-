import type { Metadata } from "next";
import { StickyNote, Pin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerNotes } from "@/features/sahibkar/owner-queries";
import { NoteDialog, DeleteNoteButton } from "@/features/sahibkar/components/note-dialog";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Sahibkar qeydləri" };

export default async function SahibkarNotPage() {
  await requireSahibkarSession();
  const notes = await getOwnerNotes(50);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Şəxsi qeydlər</h1>
          <p className="mt-1 text-sm text-muted-foreground">Yalnız sahibkar görür. Pin edilənlər ən yuxarıda.</p>
        </div>
        <NoteDialog />
      </header>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <StickyNote className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Hələ qeyd yoxdur</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <Card key={n.id} className="glass">
              <CardContent className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {n.pinned ? <Pin className="h-3.5 w-3.5 text-warning" /> : null}
                    <h3 className="font-semibold">{n.basliq ?? "Başlıqsız"}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <NoteDialog note={{ id: n.id, basliq: n.basliq, metn: n.metn, reng: n.reng, pinned: n.pinned }} />
                    <DeleteNoteButton id={n.id} />
                  </div>
                </div>
                {n.metn ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.metn}</p> : null}
                <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{n.reng ?? "sari"}</Badge>
                  <span>{formatDate(n.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
