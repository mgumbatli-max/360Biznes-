"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { setSnapshotCron } from "@/features/sahibkar/owner-actions";

export function SnapshotCronToggle({ initial }: { initial: boolean }) {
  const [aktiv, setAktiv] = useState(initial);
  const [pending, start] = useTransition();

  function onToggle() {
    const next = !aktiv;
    setAktiv(next);
    start(async () => {
      const r = await setSnapshotCron(next);
      if (r.ok) toast.success(next ? "Avtomatik snapshot aktiv" : "Avtomatik snapshot söndürüldü");
      else {
        setAktiv(!next);
        toast.error("error" in r ? r.error : "Dəyişdirilmədi");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition ${aktiv ? "border-success/30 bg-success/10 text-success" : "border-border bg-card/50 text-muted-foreground hover:bg-card"}`}
      title="Hər gün 03:00 cron snapshot alır"
    >
      <Clock className="h-3.5 w-3.5" />
      Avtomatik gündəlik snapshot
      <span className={`ml-1 inline-flex h-4 w-7 items-center rounded-full p-0.5 ${aktiv ? "bg-success" : "bg-secondary"}`}>
        <span className={`h-3 w-3 transform rounded-full bg-white transition ${aktiv ? "translate-x-3" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
