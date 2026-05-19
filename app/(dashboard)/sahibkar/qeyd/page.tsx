import type { Metadata } from "next";
import { StickyNote } from "lucide-react";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerNotes } from "@/features/sahibkar/owner-queries";
import { NoteDialog } from "@/features/sahibkar/components/note-dialog";
import { StickyNotesGrid } from "@/features/sahibkar/components/sticky-notes-grid";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";

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

      <SectionExplainer
        icon={StickyNote}
        description="Yalnız sahibkarın görüb idarə etdiyi şəxsi qeydlər — rəng kodlu sticker formada və ya kompakt list görünüşündə. Pin ilə vacibləri yuxarıya sabitləyə, axtarış xanasından tez tapa bilərsiniz."
        bullets={[
          { label: "Görünüş", text: "yuxarı sağdan kart/list seç" },
          { label: "Pin", text: "vacib qeydləri sabitlə" },
          { label: "Rəng", text: "7 rəng — kateqoriya/prioritet üçün" },
        ]}
        tone="amber"
      />

      <StickyNotesGrid notes={notes} view={view} />
    </div>
  );
}
