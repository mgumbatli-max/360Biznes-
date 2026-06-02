import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { AnbarSubNav } from "@/components/anbar-subnav";
import { InventarEditor } from "@/features/anbar/inventar/components/inventar-editor";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "İnventar detalı" };

async function getInventar(id: string) {
  return withTenant(() =>
    prisma.inventarizasiyalar.findUnique({
      where: { id },
      include: {
        anbarlar: { select: { ad: true } },
        istifadeciler_inventarizasiyalar_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_inventarizasiyalar_tamamlanan_idToistifadeciler: { select: { ad_soyad: true } },
        inventar_satirlari: {
          orderBy: { id: "asc" },
          include: { mehsullar: { select: { ad: true, kod: true, barkod: true } } },
        },
      },
    })
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  aktiv:       { label: "Davam edir",  cls: "border-warning/30 bg-warning/10 text-warning" },
  tamamlandi:  { label: "Tamamlandı",  cls: "border-success/30 bg-success/10 text-success" },
  legv:        { label: "Ləğv",        cls: "border-border bg-muted text-muted-foreground" },
};

export default async function InventarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInventar(id);
  if (!inv) notFound();

  const status = inv.status ?? "aktiv";
  const s = STATUS[status] ?? STATUS.aktiv;
  const rows = inv.inventar_satirlari.map((r) => ({
    id: r.id,
    mehsul_id: r.mehsul_id,
    mehsul_ad: r.mehsullar?.ad ?? "—",
    kod: r.mehsullar?.kod ?? null,
    barkod: r.mehsullar?.barkod ?? null,
    sistemde_olan: Number(r.sistemde_olan),
    fakti_miqdar: r.fakti_miqdar != null ? Number(r.fakti_miqdar) : null,
    qeyd: r.qeyd,
    qiymet: r.qiymet != null ? Number(r.qiymet) : 0,
  }));
  const ferqliCount = rows.filter((r) => r.fakti_miqdar != null && r.fakti_miqdar !== r.sistemde_olan).length;

  return (
    <div className="mx-auto max-w-6xl">
      <AnbarSubNav active="/anbar/inventar" />
      <div className="space-y-4">
        <BackButton fallback="/anbar/inventar" label="İnventar siyahısına qayıt" />

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              {inv.nomre}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{inv.anbarlar?.ad}</span>
              <span>·</span>
              <span>{formatDate(inv.tarix)}</span>
              <span>·</span>
              <span>{inv.istifadeciler_inventarizasiyalar_yaradan_idToistifadeciler?.ad_soyad ?? "—"} yaratdı</span>
              {inv.istifadeciler_inventarizasiyalar_tamamlanan_idToistifadeciler && (
                <>
                  <span>·</span>
                  <span>{inv.istifadeciler_inventarizasiyalar_tamamlanan_idToistifadeciler.ad_soyad} tamamladı</span>
                </>
              )}
            </div>
          </div>
          <Badge variant="outline" className={s.cls}>{s.label}</Badge>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Cəmi sətir" value={rows.length} />
          <Stat label="Faktiki daxil edilmiş" value={rows.filter((r) => r.fakti_miqdar != null).length} />
          <Stat label="Fərqi olan" value={ferqliCount} />
        </div>

        <InventarEditor inventarId={inv.id} rows={rows} status={status} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
