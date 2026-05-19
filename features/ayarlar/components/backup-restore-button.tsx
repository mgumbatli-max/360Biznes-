"use client";

import { useState, useTransition } from "react";
import { Undo2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { restoreBackup } from "@/features/ayarlar/backup-actions";

export function BackupRestoreButton({ id, fayl_ad, yaradildi }: { id: string; fayl_ad: string; yaradildi: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();

  function onConfirm() {
    if (confirmText !== "RESTORE") {
      toast.error("Təsdiq mətnini düzgün yazın");
      return;
    }
    start(async () => {
      const r = await restoreBackup(id);
      if (r.ok) {
        toast.success("Bərpa tələbi qeydə alındı");
        setOpen(false);
        setStep(1);
        setConfirmText("");
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Undo2 className="h-3.5 w-3.5" /> Geri qaytar
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setStep(1); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-5 w-5" /> Backup-dan bərpa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-danger/30 bg-danger/10 p-3">
              <p className="font-semibold text-danger">Diqqət: bu əməliyyat hazırkı məlumatları əvəz edəcək!</p>
              <p className="mt-1 text-xs text-muted-foreground">Bütün cari satış, anbar və müştəri məlumatları geri qaytarılan vəziyyətə qayıdacaq.</p>
            </div>
            <div className="rounded-md border border-border bg-card/40 p-3 text-xs">
              <div><span className="text-muted-foreground">Fayl:</span> <span className="font-mono">{fayl_ad}</span></div>
              <div><span className="text-muted-foreground">Tarix:</span> {yaradildi}</div>
            </div>
            {step === 1 ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Ləğv et</Button>
                <Button variant="destructive" className="flex-1" onClick={() => setStep(2)}>
                  Davam et
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-medium">Təsdiq üçün &quot;RESTORE&quot; yazın</label>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTORE" autoFocus />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep(1)}>Geri</Button>
                  <Button variant="destructive" disabled={pending || confirmText !== "RESTORE"} onClick={onConfirm}>
                    {pending ? "Göndərilir…" : "Bərpa tələbini göndər"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
