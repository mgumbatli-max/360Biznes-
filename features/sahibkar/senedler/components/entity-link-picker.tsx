"use client";

import { useState, useTransition } from "react";
import { Link2, Unlink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setSenedLink } from "@/features/sahibkar/senedler/actions";
import type { SenedLink } from "@/features/sahibkar/senedler/types";

const NOV_LABELS: Record<SenedLink["nov"], string> = {
  satinalma: "Alış (satınalma)",
  satis: "Satış sənədi",
  mehsul: "Məhsul",
  musteri: "Müştəri",
  techizatci: "Təchizatçı",
  partiya: "Partiya (idxal)",
  tapshiriq: "Tapşırıq",
  qaime: "Qaimə",
  diger: "Digər",
};

const NOV_TONE: Record<SenedLink["nov"], string> = {
  satinalma: "bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400",
  satis: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40 dark:text-emerald-400",
  mehsul: "bg-sky-500/15 text-sky-600 border-sky-500/40 dark:text-sky-400",
  musteri: "bg-violet-500/15 text-violet-600 border-violet-500/40 dark:text-violet-400",
  techizatci: "bg-orange-500/15 text-orange-600 border-orange-500/40 dark:text-orange-400",
  partiya: "bg-indigo-500/15 text-indigo-600 border-indigo-500/40 dark:text-indigo-400",
  tapshiriq: "bg-rose-500/15 text-rose-600 border-rose-500/40 dark:text-rose-400",
  qaime: "bg-teal-500/15 text-teal-600 border-teal-500/40 dark:text-teal-400",
  diger: "bg-slate-500/15 text-slate-600 border-slate-500/40 dark:text-slate-400",
};

export function LinkBadge({ link }: { link: SenedLink }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${NOV_TONE[link.nov]}`}>
      <Link2 className="h-2.5 w-2.5" /> {NOV_LABELS[link.nov]}: {link.label || link.id}
    </Badge>
  );
}

export function EntityLinkPicker({
  target,
  itemId,
  currentLink,
  onDone,
}: {
  target: "folder" | "file";
  itemId: string;
  currentLink?: SenedLink | null;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nov, setNov] = useState<SenedLink["nov"]>(currentLink?.nov ?? "satinalma");
  const [id, setId] = useState(currentLink?.id ?? "");
  const [label, setLabel] = useState(currentLink?.label ?? "");

  function reset() {
    setNov(currentLink?.nov ?? "satinalma");
    setId(currentLink?.id ?? "");
    setLabel(currentLink?.label ?? "");
  }

  function save() {
    if (!id.trim()) {
      toast.error("Bağlanılacaq elementin id-si və ya kodunu yazın");
      return;
    }
    startTransition(async () => {
      const res = await setSenedLink({
        target,
        id: itemId,
        link: { nov, id: id.trim(), label: label.trim() },
      });
      if (res.ok) {
        toast.success("Bağlantı saxlandı");
        setOpen(false);
        onDone?.();
      } else toast.error(res.error);
    });
  }

  function remove() {
    if (!confirm("Bağlantını silmək istəyirsən?")) return;
    startTransition(async () => {
      const res = await setSenedLink({ target, id: itemId, link: null });
      if (res.ok) {
        toast.success("Bağlantı silindi");
        setOpen(false);
        reset();
        onDone?.();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
          title={currentLink ? "Bağlantını düzəlt" : "Bölmə ilə bağla"}
        >
          <Link2 className={`h-3 w-3 ${currentLink ? "text-primary" : ""}`} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{currentLink ? "Bağlantını düzəlt" : "Başqa bölmə ilə bağla"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Növ</label>
            <select
              value={nov}
              onChange={(e) => setNov(e.target.value as SenedLink["nov"])}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {(Object.keys(NOV_LABELS) as Array<SenedLink["nov"]>).map((k) => (
                <option key={k} value={k}>{NOV_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold">Bağlanılan elementin id-si / kodu</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Misal: alış #1234, məhsul UUID, müştəri nömrəsi"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">İstinad olunan bölmənin daxili id-sini və ya açıq kodunu yazın.</p>
          </div>
          <div>
            <label className="text-xs font-semibold">Etiket (UI üçün)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='Misal: "Alış #1234 — Çin partiyası"'
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between gap-2">
          {currentLink && (
            <Button variant="outline" onClick={remove} disabled={pending} className="text-rose-500">
              <Unlink className="h-3.5 w-3.5" /> Bağlantını sil
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button onClick={save} disabled={pending || !id.trim()}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Saxla
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
