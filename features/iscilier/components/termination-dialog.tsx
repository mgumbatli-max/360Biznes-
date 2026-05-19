"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { terminateEmployee } from "../hr-actions";

export function TerminationDialog({
  istifadeciId,
  adSoyad,
}: {
  istifadeciId: string;
  adSoyad: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("istifadeci_id", istifadeciId);
    startTransition(async () => {
      const res = await terminateEmployee(fd);
      if (res.ok) {
        toast.success("İşçi çıxarıldı");
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-danger/30 text-danger hover:bg-danger/10">
          <UserMinus className="h-3.5 w-3.5" /> İşdən çıxar
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>İşdən çıxarma: {adSoyad}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Səbəb *</Label>
              <Input name="sebeb" required minLength={2} maxLength={1000} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Son iş günü</Label>
              <Input
                type="date"
                name="son_is_gunu"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-8"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Exit interview
            </div>
            <Q n="exit_q1" label="1. Niyə ayrılırsınız?" />
            <Q n="exit_q2" label="2. Ən yaxşı tərəfi nə idi?" />
            <Q n="exit_q3" label="3. Hansı təkliflər/tövsiyələriniz var?" />
            <Q n="exit_q4" label="4. Komanda və rəhbərlik haqqında?" />
            <Q n="exit_q5" label="5. Gələcəkdə geri qayıdarsınız?" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="avadanliq_qaytarildi"
              value="true"
              className="h-4 w-4 accent-primary"
            />
            Avadanlıq qaytarıldı (laptop, telefon, ID kart)
          </label>

          <p className="text-xs text-muted-foreground">
            Qeyd: Maaş hesablanması bu işçinin son ayı üçün avtomatik prorata əsasında aparılacaq.
            Qalıq məzuniyyət günləri çıxış hesablanmasına daxil edilir.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Çıxar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Q({ n, label }: { n: string; label: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <textarea
        name={n}
        maxLength={1000}
        className="min-h-[42px] w-full rounded-md border border-border bg-card p-2 text-sm"
      />
    </div>
  );
}
