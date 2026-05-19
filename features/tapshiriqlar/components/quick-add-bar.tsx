"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Zap, User, AlertCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTaskFor } from "../cross-module";

/**
 * Inline quick-add bar at the top of the task list.
 * Lets the user spawn a task with one Enter press: title + priority + assignee + deadline.
 */
export function QuickAddBar({
  users,
  currentUserId,
}: {
  users: { id: string; ad_soyad: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [basliq, setBasliq] = useState("");
  const [prioritet, setPrioritet] = useState<"asagi" | "normal" | "yuksek" | "tecili">("normal");
  const [mesulId, setMesulId] = useState<string>(currentUserId);
  const [deadline, setDeadline] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!basliq.trim()) return;
    startTransition(async () => {
      const res = await createTaskFor({
        basliq: basliq.trim(),
        prioritet,
        mesul_id: mesulId,
        deadline: deadline || undefined,
      });
      if (res.ok) {
        toast.success("Tapşırıq əlavə olundu");
        setBasliq("");
        setDeadline("");
        setPrioritet("normal");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
      <Zap className="h-4 w-4 shrink-0 text-primary" />
      <Input
        value={basliq}
        onChange={(e) => setBasliq(e.target.value)}
        placeholder="Sürətli tapşırıq əlavə et — Enter ilə yarat..."
        className="h-9 flex-1 min-w-[180px] border-none bg-transparent shadow-none focus-visible:ring-0"
        disabled={pending}
      />
      <div className="flex items-center gap-1.5">
        <AlertCircle className="h-3 w-3 text-muted-foreground" />
        <select
          value={prioritet}
          onChange={(e) => setPrioritet(e.target.value as typeof prioritet)}
          disabled={pending}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="asagi">Aşağı</option>
          <option value="normal">Normal</option>
          <option value="yuksek">Yüksək</option>
          <option value="tecili">Təcili</option>
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <User className="h-3 w-3 text-muted-foreground" />
        <select
          value={mesulId}
          onChange={(e) => setMesulId(e.target.value)}
          disabled={pending}
          className="h-9 max-w-[140px] rounded-md border border-input bg-background px-2 text-xs"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.ad_soyad}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={pending}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        />
      </div>
      <Button type="submit" disabled={pending || !basliq.trim()} size="sm">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        Əlavə et
      </Button>
    </form>
  );
}
