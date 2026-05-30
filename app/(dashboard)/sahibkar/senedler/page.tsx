import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FolderArchive, Info } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { getSahibkarState } from "@/lib/sahibkar/guard";
import { getSenedTree, getBreadcrumb } from "@/features/sahibkar/senedler/queries";
import { SenedlerExplorer } from "@/features/sahibkar/senedler/components/senedler-explorer";

export const metadata: Metadata = { title: "Sahibkar Sənədlər" };

export default async function SahibkarSenedlerPage({
  searchParams,
}: {
  searchParams?: Promise<{ folder?: string }>;
}) {
  const state = await getSahibkarState();
  if (state === "needs-setup") redirect("/sahibkar/setup");
  if (state === "needs-verify") redirect("/sahibkar/verify");
  if (state !== "ready") redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const currentFolderId = sp.folder ?? null;
  const tree = await getSenedTree();
  const breadcrumb = getBreadcrumb(tree, currentFolderId);

  const totalFolders = tree.folders.length;
  const totalFiles = tree.files.length;
  const totalBytes = tree.files.reduce((s, f) => s + (f.olcu_byte ?? 0), 0);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(1);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton fallback="/sahibkar" className="mt-1" />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <FolderArchive className="h-5 w-5 text-amber-500" />
              Sahibkar sənədlər
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bütün vacib sənədlərini bir yerdə saxla — sahibkar PIN-i ilə qorunan, gizli zona
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
          <span><strong className="text-foreground">{totalFolders}</strong> qovluq</span>
          <span>·</span>
          <span><strong className="text-foreground">{totalFiles}</strong> sənəd</span>
          <span>·</span>
          <span><strong className="text-foreground">{totalMB} MB</strong></span>
        </div>
      </header>

      {/* İzahedici banner */}
      <Card className="glass border-sky-500/30 bg-sky-500/5">
        <CardContent className="flex items-start gap-2 py-2.5 text-[11px]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <div className="space-y-0.5 text-muted-foreground">
            <p>
              <strong className="text-foreground">Necə işləyir?</strong>{" "}
              Qovluqlar yarat, içlərinə fayllar (PDF, şəkil, Excel, ZIP — max 20 MB) yüklə və ya
              xarici linklər (Google Drive, Dropbox) əlavə et. Hər fayla qeyd və etiketlər təyin et,
              sonradan axtarış zolağı ilə tap.
            </p>
            <p>
              <strong className="text-foreground">Təhlükəsizlik:</strong>{" "}
              Bu səhifə sahibkar PIN-i ilə qorunur. Yalnız sənin sahibkar girişin olan şəxs görür.
              Hər fayl unikal UUID adı ilə saxlanır — heç kim URL təxmin edə bilməz.
            </p>
          </div>
        </CardContent>
      </Card>

      <SenedlerExplorer
        tree={tree}
        currentFolderId={currentFolderId}
        breadcrumb={breadcrumb}
      />
    </div>
  );
}
