"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { autoMergeSuggested } from "../actions";

type Suggestion = {
  primaryId: string;
  primaryAd: string;
  mergeIds: string[];
  kind: string;
  value: string;
};

const KIND_LABEL: Record<string, string> = {
  voen: "VÖEN",
  fin: "FİN",
  telefon: "Telefon",
};

export function AutoMergeButton({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExcluded(next);
  }

  function runMerge() {
    const toRun = suggestions
      .filter((s) => !excluded.has(s.primaryId))
      .map((s) => ({ primaryId: s.primaryId, mergeIds: s.mergeIds }));
    if (toRun.length === 0) {
      toast.error("Birləşdirmək üçün qrup yoxdur");
      return;
    }
    if (!confirm(`${toRun.length} qrup birləşdiriləcək. Davam edək?`)) return;
    startTransition(async () => {
      const res = await autoMergeSuggested(toRun);
      if (res.ok) {
        toast.success(`${res.merged} qrup birləşdirildi`);
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Wand2 className="h-3.5 w-3.5" />
          Smart birləşdir ({suggestions.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Avtomatik birləşdirmə təklifi</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Sistem yüksək etibarlılığa malik dublikatları seçib (VÖEN/FİN/telefon eyni, hər qrupda 2 qeyd).
            Birləşdirməyəcəyiniz qrupları söndürün, sonra Davam edin düyməsinə basın.
          </p>

          <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-md border border-border/40 p-2">
            {suggestions.map((s) => {
              const skip = excluded.has(s.primaryId);
              return (
                <label
                  key={s.primaryId}
                  className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs transition ${
                    skip ? "border-border/30 opacity-50" : "border-border/60 bg-card/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 accent-primary"
                    checked={!skip}
                    onChange={() => toggle(s.primaryId)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.primaryAd}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {KIND_LABEL[s.kind] ?? s.kind}: {s.value.slice(0, 30)}
                      </Badge>
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      Primary kimi seçilib, {s.mergeIds.length} digər qeyd silinəcək
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Bağla
          </Button>
          <Button onClick={runMerge} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Birləşdir ({suggestions.length - excluded.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
