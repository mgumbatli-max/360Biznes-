"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveQiymetQayda,
  deleteQiymetQayda,
  bulkApplyQiymetQaydalari,
} from "@/features/ayarlar/qiymet-qayda-actions";

type Rule = {
  id: string;
  ad: string;
  kateqoriya_id: number | null;
  markup: number;
  round_to: string;
  aktiv: boolean;
};

type Category = { id: number; ad: string };

export function QiymetQaydaDialog({
  rule,
  categories,
  trigger,
}: {
  rule?: Rule;
  categories: Category[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onAction(formData: FormData) {
    setErr(null);
    start(async () => {
      const res = await saveQiymetQayda(formData);
      if (res.ok) {
        toast.success(rule ? "Qayda yeniləndi" : "Qayda yaradıldı");
        setOpen(false);
      } else setErr(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> Yeni qayda
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Qaydanı redaktə et" : "Yeni qiymət qaydası"}</DialogTitle>
        </DialogHeader>
        <form action={onAction} className="space-y-3">
          {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="ad">Qayda adı</Label>
            <Input
              id="ad"
              name="ad"
              defaultValue={rule?.ad ?? ""}
              required
              maxLength={120}
              placeholder="məs: Geyim 25% markup"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kateqoriya_id">Kateqoriya</Label>
            <select
              id="kateqoriya_id"
              name="kateqoriya_id"
              defaultValue={rule?.kateqoriya_id ? String(rule.kateqoriya_id) : ""}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">— Bütün kateqoriyalar —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.ad}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="markup">Markup (%)</Label>
              <Input
                id="markup"
                name="markup"
                type="number"
                step="0.1"
                defaultValue={rule?.markup ?? 25}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="round_to">Yuvarlaq</Label>
              <select
                id="round_to"
                name="round_to"
                defaultValue={rule?.round_to ?? "0.99"}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="0.99">.99 (psixoloji)</option>
                <option value="0.95">.95</option>
                <option value="0.50">.50 (yarım manat)</option>
                <option value="0.00">.00 (tam)</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="aktiv"
              defaultChecked={rule ? rule.aktiv : true}
              className="h-4 w-4"
            />
            Aktiv
          </label>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Ləğv et
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Yadda saxla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QiymetQaydaEditButton({ rule, categories }: { rule: Rule; categories: Category[] }) {
  return (
    <QiymetQaydaDialog
      rule={rule}
      categories={categories}
      trigger={
        <Button variant="ghost" size="sm" className="h-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      }
    />
  );
}

export function QiymetQaydaDeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  function onDelete() {
    if (!confirm("Qaydanı silmək istədiyinizə əminsiniz?")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteQiymetQayda(fd);
      if (res.ok) toast.success("Silindi");
      else toast.error(res.error);
    });
  }

  return (
    <Button variant="ghost" size="sm" className="h-7 text-danger" disabled={pending} onClick={onDelete}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function QiymetBulkApplyButton() {
  const [pending, start] = useTransition();

  function onBulk() {
    start(async () => {
      const res = await bulkApplyQiymetQaydalari();
      if (res.ok) {
        toast.success(`${res.rules} aktiv qayda, ${res.matched} məhsul uyğun gəlir (preview)`);
      } else toast.error(res.error);
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={onBulk}>
      {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
      Bulk apply (preview)
    </Button>
  );
}
