import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerSnapshots, getSnapshotCronAktiv } from "@/features/sahibkar/owner-queries";
import { SnapshotButton } from "@/features/sahibkar/components/snapshot-button";
import { SnapshotCronToggle } from "@/features/sahibkar/components/snapshot-cron-toggle";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Gündəlik snapshot" };
export const dynamic = "force-dynamic";

type SnapshotJson = { revenue?: number; orders?: number; open_tasks?: number };

export default async function SahibkarSnapshotPage() {
  await requireSahibkarSession();
  const [rows, cronAktiv] = await Promise.all([getOwnerSnapshots(60), getSnapshotCronAktiv()]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gündəlik snapshot</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hər günün biznes şəkli: gəlir, sifariş, açıq tapşırıq.</p>
        </div>
        <div className="flex items-center gap-2">
          <SnapshotCronToggle initial={cronAktiv} />
          <SnapshotButton />
        </div>
      </header>

      <SectionExplainer
        icon={Camera}
        title="Snapshot nədir, nəyə yarayır?"
        tone="violet"
        description="Snapshot — hər günün sonunda biznesin əsas göstəricilərinin (gəlir, sifariş sayı, açıq tapşırıq, kassa qalığı) avtomatik şəkillənməsidir. Sonradan günləri yan-yana qoyub trendləri görmək, ay sonu hesabatlar üçün etibarlı arxiv saxlamaq və data dəyişikliklərini izləmək üçündür."
        bullets={[
          { label: "Avto", text: "günlük cron ilə özü işləyir (sağ üstdən söndür/yandır)" },
          { label: "Manual", text: "\"Snapshot al\" düyməsi ilə dərhal götürülür" },
          { label: "Saxlanma", text: "60 gün arxiv altında qalır, fərq analizi üçün istifadə olunur" },
        ]}
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Camera className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Hələ snapshot yoxdur</h3>
          <p className="mt-1 text-xs text-muted-foreground">Yuxarıdan &quot;Snapshot al&quot; ilə yarat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const json = (r.snapshot_json ?? {}) as SnapshotJson;
            return (
              <Card key={r.id} className="glass">
                <CardContent className="space-y-1 py-4">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{r.tarix ? formatDate(r.tarix) : "—"}</div>
                  <div className="text-lg font-bold tabular-nums">{formatMoney(r.mebleg)}</div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground">
                    <div>Sifariş: <span className="font-semibold text-foreground">{json.orders ?? 0}</span></div>
                    <div>Açıq: <span className="font-semibold text-foreground">{json.open_tasks ?? 0}</span></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
