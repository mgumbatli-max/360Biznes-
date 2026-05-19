"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { saveExpense } from "../actions";

type CategoryOpt = { id: number; ad: string };

export function ExpenseDialog({ categories }: { categories: CategoryOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [kateqoriyaId, setKateqoriyaId] = useState<string>("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveExpense(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Xərc qeydə alındı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" />
          Yeni xərc
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni xərc</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="tesvir">Təsvir *</Label>
            <Input id="tesvir" name="tesvir" required minLength={2} maxLength={500} autoFocus disabled={pending} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mebleg">Məbləğ (AZN) *</Label>
              <Input id="mebleg" name="mebleg" type="number" min={0.01} step="0.01" required disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarix">Tarix *</Label>
              <Input
                id="tarix"
                name="tarix"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                disabled={pending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kateqoriya_id">Kateqoriya</Label>
              <Combobox
                options={categories.map<ComboOption>((c) => ({ value: String(c.id), label: c.ad }))}
                value={kateqoriyaId}
                onChange={setKateqoriyaId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Kateqoriya axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              <input type="hidden" name="kateqoriya_id" value={kateqoriyaId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odenis_nov">Ödəniş növü</Label>
              <select
                id="odenis_nov"
                name="odenis_nov"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                defaultValue="negd"
                disabled={pending}
              >
                <option value="negd">Nağd</option>
                <option value="kart">Kart</option>
                <option value="kecirme">Bank köçürmə</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qebz_nomresi">Qəbz nömrəsi (istəyə bağlı)</Label>
            <Input id="qebz_nomresi" name="qebz_nomresi" maxLength={50} disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Qeyd et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
