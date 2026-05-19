"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  disableRecurringRule,
  enableRecurringRule,
  runRecurringCheck,
} from "../actions";

export function RecurringActions({
  id,
  status,
  tezlik,
}: {
  id: string;
  status: string;
  tezlik: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tezlikState, setTezlikState] = useState(tezlik);

  function toggle() {
    startTransition(async () => {
      const fn = status === "aktiv" ? disableRecurringRule(id) : enableRecurringRule(id, tezlikState);
      const res = await fn;
      if (res.ok) {
        toast.success(status === "aktiv" ? "Söndürüldü" : "Aktivləşdirildi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {status !== "aktiv" && (
        <select
          value={tezlikState}
          onChange={(e) => setTezlikState(e.target.value)}
          disabled={pending}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="weekly">Həftəlik</option>
          <option value="monthly">Aylıq</option>
          <option value="bi_monthly">Hər 2 ay</option>
          <option value="quarterly">Rüblük</option>
          <option value="yearly">İllik</option>
        </select>
      )}
      <Button size="sm" variant="outline" onClick={toggle} disabled={pending}>
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : status === "aktiv" ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {status === "aktiv" ? "Söndür" : "Aktivləşdir"}
      </Button>
    </div>
  );
}

export function RunRecurringButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await runRecurringCheck();
      if (res.ok) {
        toast.success(`Yaradılan əməliyyat: ${res.yaradilan}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button onClick={run} disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
      İndi yoxla
    </Button>
  );
}
