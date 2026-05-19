import { ListTodo } from "lucide-react";
import { TaskRow } from "./task-row";
import type { TaskListItem } from "../queries";

export function TasksList({ items, total }: { items: TaskListItem[]; total: number }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <ListTodo className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Tapşırıq yoxdur</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Hələ heç bir tapşırıq yaradılmayıb. Yuxarıda "Yeni tapşırıq" düyməsi ilə başlayın.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Tapşırıqlar
          <span className="ml-2 text-xs font-normal text-muted-foreground">{total} nəticə</span>
        </h3>
      </div>
      <div>
        {items.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}
