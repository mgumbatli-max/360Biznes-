import Link from "next/link";
import { ListTodo, CalendarClock, Check, Circle, Loader, X as XIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewTaskDialog } from "./new-task-dialog";
import { colorHexFor } from "./color-picker";
import { getTasksForObject, getUsersForAssignment, getMyUserId } from "../queries";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; cls: string; icon: typeof Check }> = {
  yeni: { label: "Gözləyir", cls: "border-amber-300/60 text-amber-700", icon: Circle },
  icrada: { label: "İcradadır", cls: "border-sky-300/60 text-sky-700", icon: Loader },
  gozlemede: { label: "Yoxlanılır", cls: "border-violet-300/60 text-violet-700", icon: Circle },
  tamamlandi: { label: "Tamamlandı", cls: "border-emerald-300/60 text-emerald-700", icon: Check },
  legv: { label: "Ləğv", cls: "border-rose-300/60 text-rose-700", icon: XIcon },
};

type Props = {
  obyektNov: string;
  obyektId: string;
  obyektBasliq?: string;
};

export async function ObjectTasksTab({ obyektNov, obyektId, obyektBasliq }: Props) {
  const [tasks, users, myId] = await Promise.all([
    getTasksForObject(obyektNov, obyektId),
    getUsersForAssignment(),
    getMyUserId(),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <NewTaskDialog
          users={users}
          currentUserId={myId}
          defaultObyektNov={obyektNov}
          defaultObyektId={obyektId}
          defaultObyektBasliq={obyektBasliq}
          triggerLabel="Bu obyektə tapşırıq"
        />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <ListTodo className="mb-2 h-7 w-7 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Bu obyektlə bağlı tapşırıq yoxdur</p>
        </div>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {tasks.map((t) => {
                const st = STATUS_MAP[t.status] ?? STATUS_MAP.yeni;
                const StIcon = st.icon;
                const overdue = t.deadline && t.deadline < new Date() && t.status !== "tamamlandi" && t.status !== "legv";
                const reng = colorHexFor(t.reng);
                return (
                  <Link
                    key={t.id}
                    href={`/tapshiriqlar/${t.id}`}
                    className="relative flex items-center gap-3 px-4 py-2.5 transition hover:bg-secondary/40"
                  >
                    {reng && (
                      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: reng }} aria-hidden />
                    )}
                    <StIcon className={`h-3.5 w-3.5 ${st.cls.split(" ")[1]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{t.basliq}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className={`${st.cls} text-[10px]`}>{st.label}</Badge>
                        {t.deadline && (
                          <span className={`inline-flex items-center gap-1 ${overdue ? "text-rose-600" : ""}`}>
                            <CalendarClock className="h-3 w-3" />
                            {formatDistanceToNow(t.deadline, { addSuffix: true, locale: az })}
                          </span>
                        )}
                        {t.mesul_ad && <span>Məsul: <span className="text-foreground">{t.mesul_ad}</span></span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
