"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleChecklist } from "../actions";
import { toast } from "sonner";

type Props = {
  id: string;
  metn: string;
  tamamlandi: boolean;
};

export function ChecklistItem({ id, metn, tamamlandi: initial }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !done;
    setDone(next); // Optimistic
    startTransition(async () => {
      const res = await toggleChecklist(id, next);
      if (!res.ok) {
        setDone(!next);
        toast.error(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <label className={`flex items-start gap-2 cursor-pointer ${pending && "opacity-50"}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        disabled={pending}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{metn}</span>
    </label>
  );
}
