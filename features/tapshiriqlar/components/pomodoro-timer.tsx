"use client";

import { useEffect, useState, useRef } from "react";
import { Timer, Play, Pause, RotateCcw, Coffee, Brain, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Phase = "focus" | "short_break" | "long_break";

const DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
};

const PHASE_LABEL: Record<Phase, string> = {
  focus: "Diqqət",
  short_break: "Qısa fasilə",
  long_break: "Uzun fasilə",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // Phase finished
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          // Auto-progress
          if (phase === "focus") {
            const newCycle = cycle + 1;
            setCycle(newCycle);
            const next: Phase = newCycle % 4 === 0 ? "long_break" : "short_break";
            setPhase(next);
            setRemaining(DURATIONS[next]);
            try {
              new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {});
              if (Notification.permission === "granted") {
                new Notification("Pomodoro tamamlandı 🎯", { body: `${next === "long_break" ? "Uzun" : "Qısa"} fasilə vaxtıdır` });
              }
            } catch {}
          } else {
            setPhase("focus");
            setRemaining(DURATIONS.focus);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, phase, cycle]);

  function start() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setRemaining(DURATIONS[phase]);
  }

  function switchPhase(p: Phase) {
    setPhase(p);
    setRemaining(DURATIONS[p]);
    setRunning(false);
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = 1 - remaining / DURATIONS[phase];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Pomodoro timer"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold transition hover:bg-secondary/70",
          running && "border-rose-500/40 bg-rose-500/10 text-rose-600"
        )}
      >
        <Timer className="h-3.5 w-3.5" />
        {running ? `${pad(mins)}:${pad(secs)}` : "Pomodoro"}
        {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-40 w-72 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur animate-fade-up">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <Timer className="h-4 w-4 text-primary" />
          Pomodoro
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Bağla"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Phase switcher */}
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-border/40 bg-secondary/40 p-0.5">
        {(["focus", "short_break", "long_break"] as Phase[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => switchPhase(p)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold transition",
              phase === p ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {p === "focus" ? <Brain className="h-2.5 w-2.5" /> : <Coffee className="h-2.5 w-2.5" />}
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Timer display with circular progress */}
      <div className="relative mx-auto mt-4 flex h-32 w-32 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={phase === "focus" ? "hsl(var(--primary))" : "hsl(160 84% 39%)"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 46}`}
            strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="relative text-center">
          <div className="font-mono text-3xl font-bold tabular-nums">
            {pad(mins)}:{pad(secs)}
          </div>
          <div className="text-[10px] text-muted-foreground">{PHASE_LABEL[phase]}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={running ? () => setRunning(false) : start}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition",
            running ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {running ? "Pauza" : "Başla"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="grid h-9 w-9 place-items-center rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground"
          title="Sıfırla"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>Bu seans: <Badge variant="outline" className="ml-1 text-[9px]">{cycle} cikl</Badge></span>
        <span>{cycle > 0 ? `${Math.round(cycle * 25)} dəq` : "—"}</span>
      </div>
    </div>
  );
}
