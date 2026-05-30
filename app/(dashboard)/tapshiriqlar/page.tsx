import type { Metadata } from "next";
import { auth } from "@/auth";
import { NewTaskDialog } from "@/features/tapshiriqlar/components/new-task-dialog";
import { TasksTabs } from "@/features/tapshiriqlar/components/tasks-tabs";
import { TasksList } from "@/features/tapshiriqlar/components/tasks-list";
import { KanbanBoard } from "@/features/tapshiriqlar/components/kanban-board";
import { CalendarView } from "@/features/tapshiriqlar/components/calendar-view";
import { ViewToggle } from "@/features/tapshiriqlar/components/view-toggle";
import { TaskFilters } from "@/features/tapshiriqlar/components/filters";
import { TaskKpiStrip } from "@/features/tapshiriqlar/components/kpi-strip";
import { PomodoroTimer } from "@/features/tapshiriqlar/components/pomodoro-timer";
import { TaskSectionTabs } from "@/features/tapshiriqlar/components/section-tabs";
import { QuickAddBar } from "@/features/tapshiriqlar/components/quick-add-bar";
import {
  getTasks,
  getTaskStats,
  getUsersForAssignment,
  getMyUserId,
  type TaskFilter,
  type TaskSort,
} from "@/features/tapshiriqlar/queries";

export const metadata: Metadata = { title: "Tapşırıqlar" };

type SearchParams = {
  scope?: string;
  status?: string | string[];
  prioritet?: string | string[];
  tip?: string | string[];
  mesul_id?: string;
  q?: string;
  view?: string;
  sort?: string;
  overdue?: string;
};

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function TapshiriqlarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) return null;

  const sort = (["deadline", "yaradildi", "prioritet", "xatirlatma"].includes(sp.sort ?? "")
    ? (sp.sort as TaskSort)
    : "deadline") as TaskSort;

  const isOverdue = sp.overdue === "1";

  const myId = await getMyUserId();
  // "me" alias dəstəkləyirik — sidebar/menyu üçün
  const mesulId = sp.mesul_id === "me" ? myId : sp.mesul_id;

  const filter: TaskFilter = {
    scope: (sp.scope as TaskFilter["scope"]) ?? "menim",
    status: asArray(sp.status) as TaskFilter["status"],
    prioritet: asArray(sp.prioritet) as TaskFilter["prioritet"],
    tip: asArray(sp.tip),
    mesul_id: mesulId,
    search: sp.q,
    sort,
    overdue: isOverdue,
  };

  const view: "kanban" | "list" | "calendar" =
    sp.view === "kanban" ? "kanban" : sp.view === "calendar" ? "calendar" : "list";
  const pageSize = view === "kanban" || view === "calendar" ? 300 : 50;

  const [stats, users, tasks] = await Promise.all([
    getTaskStats(),
    getUsersForAssignment(),
    getTasks(filter, 1, pageSize),
  ]);

  // Overdue filter artıq server-side (queries.ts) tətbiq olunur — paginasiya doğru
  const visibleItems = tasks.items;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tapşırıqlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Şəxsi və komanda tapşırıqları — bütün modullarla bağlı.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PomodoroTimer />
          <ViewToggle />
          <NewTaskDialog users={users} currentUserId={myId} />
        </div>
      </header>

      <TaskSectionTabs current="list" />

      <TaskKpiStrip stats={stats} />

      <QuickAddBar users={users} currentUserId={myId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TasksTabs />
      </div>

      <TaskFilters users={users} />

      {view === "kanban" ? (
        <KanbanBoard items={visibleItems} users={users} />
      ) : view === "calendar" ? (
        <CalendarView items={visibleItems} />
      ) : (
        <TasksList items={visibleItems} total={visibleItems.length} />
      )}
    </div>
  );
}
