import type { Metadata } from "next";
import { ClipboardList, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getOwnerTasks, getStaffOptions } from "@/features/sahibkar/owner-queries";
import { TaskDialog, TaskStatusSelect } from "@/features/sahibkar/components/task-dialog";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Sahibkar tapşırıqları" };
export const dynamic = "force-dynamic";

const COLUMNS: Array<{ key: string; label: string; tone: string }> = [
  { key: "acig", label: "Açıq", tone: "text-muted-foreground" },
  { key: "isleyir", label: "İşləyir", tone: "text-info" },
  { key: "yoxlama", label: "Yoxlama", tone: "text-warning" },
  { key: "tamam", label: "Tamamlandı", tone: "text-success" },
];

export default async function SahibkarTapshiriqPage() {
  await requireSahibkarSession();
  const [tasks, staff] = await Promise.all([getOwnerTasks(100), getStaffOptions()]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sahibkar tapşırıqları</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kanban: status seçərək dəyişin.</p>
        </div>
        <TaskDialog staff={staff} />
      </header>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Tapşırıq yoxdur</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => (t.status ?? "acig") === col.key);
            return (
              <div key={col.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${col.tone}`}>{col.label}</h3>
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <Card key={t.id} className="glass">
                      <CardContent className="space-y-1.5 py-3">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="text-sm font-medium leading-tight">{t.basliq}</div>
                          <TaskDialog task={{ id: t.id, basliq: t.basliq, tesvir: t.tesvir, tarix: t.tarix, prioritet: t.prioritet, status: t.status }} staff={staff} />
                        </div>
                        <Badge variant="outline" className="border-primary/30 text-[10px] text-primary-light">
                          <Lock className="h-2.5 w-2.5" /> Yalnız sahibkar görür
                        </Badge>
                        {t.tesvir ? <p className="line-clamp-2 text-xs text-muted-foreground">{t.tesvir}</p> : null}
                        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                          <span>{t.mesul_ad ?? "—"}</span>
                          <span>{t.tarix ? formatDate(t.tarix, { day: "2-digit", month: "short" }) : "—"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <Badge variant="outline" className="text-[10px]">{t.prioritet ?? "orta"}</Badge>
                          <TaskStatusSelect id={t.id} status={t.status} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
