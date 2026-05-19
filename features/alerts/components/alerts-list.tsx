import { Bell } from "lucide-react";
import { AlertRow } from "./alert-row";
import type { AlertListItem } from "../queries";

type Props = {
  items: AlertListItem[];
  total: number;
};

export function AlertsList({ items, total }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">Xəbərdarlıq yoxdur</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Sistemdə hələ heç bir xəbərdarlıq yoxdur. Avtomatlaşdırma qaydaları işə düşdükdə yeni xəbərdarlıqlar burada görünəcək.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-sm font-semibold">
          Xəbərdarlıqlar
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {total} nəticə
          </span>
        </h3>
      </div>
      <div>
        {items.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </div>
    </div>
  );
}
