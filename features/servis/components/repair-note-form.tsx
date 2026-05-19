"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addRepairNote } from "../actions";

export function RepairNoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [val, setVal] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (val.trim().length < 1) return;
    const fd = new FormData();
    fd.append("id", id);
    fd.append("qeyd", val);
    startTransition(async () => {
      const res = await addRepairNote(fd);
      if (res.ok) {
        toast.success("Qeyd əlavə olundu");
        setVal("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={2}
        placeholder="Təmir prosesi qeydi…"
        disabled={pending}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button size="sm" onClick={submit} disabled={pending || val.trim().length < 1}>
        {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
        Qeyd əlavə et
      </Button>
    </div>
  );
}
