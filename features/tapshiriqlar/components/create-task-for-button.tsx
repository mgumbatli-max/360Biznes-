"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTaskFor, type LinkableModul } from "../cross-module";

/**
 * Drop-in button for any module page that wants to spawn a task linked
 * back to its current entity. Renders a compact button + modal form.
 *
 * Example usage on a product page:
 *   <CreateTaskForButton
 *     obyekt_nov="mehsul"
 *     obyekt_id={product.id}
 *     obyekt_basliq={product.ad}
 *     defaultTitle={`${product.ad} üçün yoxla`}
 *   />
 */
export function CreateTaskForButton({
  obyekt_nov,
  obyekt_id,
  obyekt_basliq,
  defaultTitle = "",
  variant = "outline",
  size = "sm",
  label = "Tapşırıq yarat",
}: {
  obyekt_nov: LinkableModul;
  obyekt_id: string;
  obyekt_basliq?: string;
  defaultTitle?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [basliq, setBasliq] = useState(defaultTitle);
  const [tesvir, setTesvir] = useState("");
  const [prioritet, setPrioritet] = useState<"asagi" | "normal" | "yuksek" | "tecili">("normal");
  const [deadline, setDeadline] = useState("");

  function submit() {
    if (!basliq.trim()) {
      toast.error("Başlıq tələb olunur");
      return;
    }
    startTransition(async () => {
      const res = await createTaskFor({
        basliq: basliq.trim(),
        tesvir: tesvir.trim() || undefined,
        prioritet,
        deadline: deadline || undefined,
        obyekt_nov,
        obyekt_id,
        obyekt_basliq,
      });
      if (res.ok) {
        toast.success("Tapşırıq yaradıldı");
        setOpen(false);
        setBasliq(defaultTitle);
        setTesvir("");
        setDeadline("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size === "sm" ? "sm" : undefined}
        onClick={() => setOpen(true)}
      >
        <ListTodo className="h-3.5 w-3.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni tapşırıq</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {obyekt_basliq && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <strong>Bağlı obyekt:</strong> {obyekt_basliq}
                <div className="text-[10.5px] text-muted-foreground">Bu tapşırıq həmin obyektə bağlanacaq</div>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="basliq">Başlıq *</Label>
              <Input
                id="basliq"
                value={basliq}
                onChange={(e) => setBasliq(e.target.value)}
                placeholder="Nə edilməlidir?"
                autoFocus
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tesvir">Təsvir</Label>
              <textarea
                id="tesvir"
                value={tesvir}
                onChange={(e) => setTesvir(e.target.value)}
                rows={3}
                placeholder="Detallar..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={pending}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioritet</Label>
                <select
                  value={prioritet}
                  onChange={(e) => setPrioritet(e.target.value as typeof prioritet)}
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="asagi">Aşağı</option>
                  <option value="normal">Normal</option>
                  <option value="yuksek">Yüksək</option>
                  <option value="tecili">Təcili</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="deadline">Deadline</Label>
                <input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button onClick={submit} disabled={pending || !basliq.trim()}>
              {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Yarat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
