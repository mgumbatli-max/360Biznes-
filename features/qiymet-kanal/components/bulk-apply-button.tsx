"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/lib/toast";
import { bulkApplyMethodToAllProducts } from "../actions";
import { FORMULA_META, type KanalQiymetFormula } from "../types";

const ALLOWED: Extract<KanalQiymetFormula, "baza" | "auto_komissiya" | "auto_net" | "gizli">[] = [
  "baza",
  "auto_komissiya",
  "auto_net",
  "gizli",
];

export function BulkApplyToAllProductsButton({ kanal }: { kanal: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formula, setFormula] = useState<(typeof ALLOWED)[number]>("auto_net");
  const [mode, setMode] = useState<"skip_manual" | "force">("skip_manual");

  function run() {
    if (
      !confirm(
        `"${kanal}" kanalı üçün bütün məhsullara "${FORMULA_META[formula].label}" tətbiq olunsun?\n\nMod: ${mode === "skip_manual" ? "Mövcud manual qiymətlər saxlanılır" : "Hər şey override olunur"}`,
      )
    )
      return;
    startTransition(async () => {
      const res = await bulkApplyMethodToAllProducts({ kanal, formula, mode });
      if (res.ok) {
        toast.success(
          `${res.data?.updated ?? 0} məhsul yeniləndi · ${res.data?.skipped ?? 0} skipped (cəm ${res.data?.total ?? 0})`,
        );
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Bütün məhsullara bu kanal üçün metod tətbiq et"
      >
        <Wand2 className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Bütün məhsullara tətbiq — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Metod</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {ALLOWED.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormula(f)}
                    className={`rounded-md border px-3 py-2 text-left transition ${
                      formula === f
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <div className="text-xs font-bold">{FORMULA_META[f].label}</div>
                    <div className="text-[10px] text-muted-foreground">{FORMULA_META[f].desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Manual qiymətlər</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode("skip_manual")}
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    mode === "skip_manual"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-secondary/40"
                  }`}
                >
                  <div className="text-xs font-bold">Saxla</div>
                  <div className="text-[10px] text-muted-foreground">Manual qoyulmuş qiymətlər toxunulmur</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("force")}
                  className={`rounded-md border px-3 py-2 text-left transition ${
                    mode === "force"
                      ? "border-rose-500 bg-rose-500/10"
                      : "border-border hover:bg-secondary/40"
                  }`}
                >
                  <div className="text-xs font-bold text-rose-600">Force override</div>
                  <div className="text-[10px] text-muted-foreground">Manual qiymətlər də əvəz olunur</div>
                </button>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Bu əməliyyat aktiv məhsulların hamısına tətbiq olunur. Geri qaytarmaq üçün
                hər bir məhsulu ayrıca redaktə etmək lazımdır.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button size="sm" onClick={run} disabled={pending}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              Tətbiq et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
