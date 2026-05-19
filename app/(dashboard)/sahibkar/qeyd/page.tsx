import type { Metadata } from "next";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerNotes } from "@/features/sahibkar/owner-queries";
import { NoteDialog } from "@/features/sahibkar/components/note-dialog";
import { StickyNotesGrid } from "@/features/sahibkar/components/sticky-notes-grid";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";

export const metadata: Metadata = { title: "Sahibkar qeydləri" };
export const dynamic = "force-dynamic";

export default async function SahibkarQeydPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireSahibkarSession();
  const sp = await searchParams;
  const view: ViewMode = sp.view === "list" ? "list" : "card";
  const notes = await getOwnerNotes(200);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Məxfi qeydlər</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rəngli sticker qeydlər — sabitləyin, axtarın, sıralayın.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle modes={["card", "list"]} defaultMode="card" size="sm" />
          <NoteDialog />
        </div>
      </header>

      <StickyNotesGrid notes={notes} view={view} />
    </div>
  );
}
