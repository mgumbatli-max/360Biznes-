"use client";

import { useState } from "react";
import { FileText, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Sablon = { id: number; ad: string; nov: string; format: string | null; default_sablon: boolean | null };

export function AktPrintButton({
  servisId,
  sablonlar,
}: {
  servisId: string;
  sablonlar: Sablon[];
}) {
  const [open, setOpen] = useState(false);
  const defaultId = sablonlar.find((s) => s.default_sablon)?.id ?? sablonlar[0]?.id ?? 0;
  const [selected, setSelected] = useState<number>(defaultId);

  function openPrint() {
    const url = selected
      ? `/servis/${servisId}/print?format=akt&sablon=${selected}`
      : `/servis/${servisId}/print?format=akt`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileText className="h-3.5 w-3.5" /> Akt çap et
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Servis akt şablonu</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {sablonlar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Heç bir akt şablonu tapılmadı. Standart şablonla çap edilir.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Şablon seç
              </Label>
              <select
                value={selected}
                onChange={(e) => setSelected(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {sablonlar.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad} {s.default_sablon ? "(default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-[10.5px] text-muted-foreground">
            Akt 2 nüsxə kimi A4 formatda açılır: bir mağaza, bir müştəri üçün.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Ləğv
          </Button>
          <Button type="button" size="sm" onClick={openPrint}>
            <Printer className="h-3.5 w-3.5" /> Çap et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
