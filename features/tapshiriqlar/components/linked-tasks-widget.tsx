import Link from "next/link";
import { ListTodo, Clock, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTasksForObject } from "../cross-module";
import { CreateTaskForButton } from "./create-task-for-button";
import type { LinkableModul } from "../cross-module";
import { cn, formatDate } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  yeni:        { label: "Yeni",       cls: "border-amber-500/30 bg-amber-500/10 text-amber-500", icon: Clock },
  icrada:      { label: "İcradadır",  cls: "border-sky-500/30 bg-sky-500/10 text-sky-500", icon: Clock },
  gozlemede:   { label: "Yoxlanılır", cls: "border-violet-500/30 bg-violet-500/10 text-violet-500", icon: Clock },
  tamamlandi:  { label: "Tamamlandı", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  legv:        { label: "Ləğv",       cls: "border-border bg-secondary text-muted-foreground", icon: AlertCircle },
};

const PRIORITY_CLS: Record<string, string> = {
  tecili: "bg-rose-500 text-white border-rose-600",
  yuksek: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  normal: "bg-secondary text-muted-foreground border-border",
  asagi:  "bg-secondary text-muted-foreground border-border",
};

/**
 * Server component widget showing tasks attached to a specific entity.
 * Drop this on any module's detail page (məhsul, müştəri, satış, servis…) to
 * surface the linked tasks and let users quickly create new ones.
 *
 * Example:
 *   <LinkedTasksWidget obyekt_nov="mehsul" obyekt_id={product.id} obyekt_basliq={product.ad} />
 */
export async function LinkedTasksWidget({
  obyekt_nov,
  obyekt_id,
  obyekt_basliq,
  title = "Bağlı tapşırıqlar",
  limit = 10,
}: {
  obyekt_nov: LinkableModul;
  obyekt_id: string;
  obyekt_basliq?: string;
  title?: string;
  limit?: number;
}) {
  const tasks = await getTasksForObject(obyekt_nov, obyekt_id, limit);
  const now = new Date();

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-primary" />
          {title}
          {tasks.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
          )}
        </CardTitle>
        <CreateTaskForButton
          obyekt_nov={obyekt_nov}
          obyekt_id={obyekt_id}
          obyekt_basliq={obyekt_basliq}
          defaultTitle={obyekt_basliq ? `${obyekt_basliq}: ` : ""}
        />
      </CardHeader>
      <CardContent className="p-0">
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Bağlı tapşırıq yoxdur — yuxarıdakı düymə ilə əlavə edin
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {tasks.map((t) => {
              const status = STATUS_META[t.status ?? "yeni"] ?? STATUS_META.yeni;
              const StatusIcon = status.icon;
              const overdue = t.deadline && t.deadline < now && t.status !== "tamamlandi" && t.status !== "legv";
              return (
                <li key={t.id}>
                  <Link href={`/tapshiriqlar/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30">
                    <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", status.cls.split(" ").pop())} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{t.basliq}</span>
                        <Badge variant="outline" className={cn("text-[9px]", status.cls)}>{status.label}</Badge>
                        {t.prioritet && t.prioritet !== "normal" && (
                          <Badge variant="outline" className={cn("text-[9px]", PRIORITY_CLS[t.prioritet] ?? "")}>{t.prioritet}</Badge>
                        )}
                        {overdue && <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[9px] text-rose-500">GECİKMİŞ</Badge>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
                        {t.mesul_ad && <span>👤 {t.mesul_ad}</span>}
                        {t.deadline && <span>⏰ {formatDate(t.deadline, { day: "2-digit", month: "short" })}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
