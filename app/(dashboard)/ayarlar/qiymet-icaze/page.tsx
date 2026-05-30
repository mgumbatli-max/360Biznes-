import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { getAllRoleAllowedTiers } from "@/features/ayarlar/qiymet-icaze";
import { QiymetIcazeClient } from "@/features/ayarlar/components/qiymet-icaze-client";

export const metadata: Metadata = { title: "Qiymət icazələri" };

export default async function QiymetIcazePage() {
  const rows = await getAllRoleAllowedTiers();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-muted-foreground">
          <Eye className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Qiymət icazələri (kim hansı qiyməti görür)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            POS-da məhsul sətrində 👁 ikonu ilə açılan popover-də göstərilən qiymət
            tiplərinə rolun icazəsi. Satıcı/kassir adətən yalnız Pərakəndə + Endirimli
            görür; müdir/sahibkar isə bütün tipləri görə bilər.
          </p>
        </div>
      </header>

      <QiymetIcazeClient initial={rows} />
    </div>
  );
}
