"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TaskListItem } from "../queries";

const WEEKDAYS = ["Bz", "B.e", "Ç.a", "Çr", "C.a", "Cü", "Şn"]; // Sun-Sat
const AZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

function ymdKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function priorityColor(p: string): string {
  switch (p) {
    case "tecili": return "bg-rose-500";
    case "yuksek": return "bg-amber-500";
    case "asagi": return "bg-slate-400";
    default: return "bg-sky-500";
  }
}

export function CalendarView({ items }: { items: TaskListItem[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = first.getDay(); // 0..6 (Sun..Sat)
    const startDate = new Date(first);
    startDate.setDate(first.getDate() - startWeekday);

    const days: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskListItem[]>();
    for (const t of items) {
      if (!t.deadline) continue;
      const key = ymdKey(t.deadline);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const monthLabel = `${AZ_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const todayKey = ymdKey(today);

  function shift(months: number) {
    const next = new Date(cursor);
    next.setMonth(cursor.getMonth() + months);
    setCursor(next);
    setActiveDay(null);
  }

  const activeTasks = activeDay ? tasksByDay.get(activeDay) ?? [] : [];

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Əvvəlki ay">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Bu gün
          </Button>
          <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Növbəti ay">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 border-b border-border/60 bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center font-semibold">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const key = ymdKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === todayKey;
          const isActive = key === activeDay;
          const list = tasksByDay.get(key) ?? [];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveDay(isActive ? null : key)}
              className={cn(
                "flex min-h-[88px] flex-col items-start gap-1 border-b border-r border-border/60 p-1.5 text-left transition hover:bg-secondary/40",
                !inMonth && "bg-muted/20 text-muted-foreground/60",
                isToday && "bg-primary/5",
                isActive && "ring-1 ring-primary"
              )}
            >
              <span className={cn("text-[11px] font-semibold", isToday && "text-primary")}>
                {d.getDate()}
              </span>
              <div className="flex w-full flex-col gap-0.5">
                {list.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1 truncate rounded bg-card px-1 py-0.5 text-[10px] shadow-sm"
                    title={t.basliq}
                  >
                    <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", priorityColor(t.prioritet))} />
                    <span className="truncate">{t.basliq}</span>
                  </span>
                ))}
                {list.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{list.length - 3} daha</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {activeDay && activeTasks.length > 0 && (
        <div className="border-t border-border/60 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {activeDay} — tapşırıqlar ({activeTasks.length})
          </div>
          <ul className="space-y-1.5">
            {activeTasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tapshiriqlar/${t.id}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm hover:border-primary/40"
                >
                  <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", priorityColor(t.prioritet))} />
                  <span className="flex-1 truncate font-medium">{t.basliq}</span>
                  <span className="text-[10px] text-muted-foreground">{t.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeDay && activeTasks.length === 0 && (
        <div className="border-t border-border/60 p-3 text-center text-xs text-muted-foreground">
          {activeDay} — tapşırıq yoxdur
        </div>
      )}
    </div>
  );
}
