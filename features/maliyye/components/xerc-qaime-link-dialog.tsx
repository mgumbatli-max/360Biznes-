"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Link as LinkIcon } from "lucide-react";
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
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { saveExpenseWithInvoiceLink } from "../actions";
import { formatMoney } from "@/lib/utils";

type CategoryOpt = { id: number; ad: string };
type PurchaseOpt = {
  id: string;
  nomre: string;
  tarix: Date | string;
  techizatci_ad: string | null;
  umumi_mebleg: number;
};

type HesabOpt = { id: string; ad: string; nov: string };

type Props = {
  categories: CategoryOpt[];
  purchases: PurchaseOpt[];
  /** When provided, pre-locks the invoice to this purchase id (used on purchase detail page) */
  lockedAlisId?: string;
  /** Custom trigger label */
  triggerLabel?: string;
  /** Use as compact action (no full button) */
  variant?: "default" | "compact";
  /** Optional hesab/kassa list — seçilərsə qaliq azalır */
  hesablar?: HesabOpt[];
};

export function XercQaimeLinkDialog({
  categories,
  purchases,
  lockedAlisId,
  triggerLabel,
  variant = "default",
  hesablar = [],
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [kateqoriyaId, setKateqoriyaId] = useState<string>("");
  const [alisId, setAlisId] = useState<string>(lockedAlisId ?? "");
  const [mebleg, setMebleg] = useState<string>("");
  const [hesabId, setHesabId] = useState<string>("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (kateqoriyaId) fd.set("kateqoriya_id", kateqoriyaId);
    else fd.delete("kateqoriya_id");
    if (alisId) fd.set("alis_id", alisId);
    if (hesabId) fd.set("hesab_id", hesabId);
    else fd.delete("hesab_id");
    startTransition(async () => {
      const res = await saveExpenseWithInvoiceLink(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success(
          alisId
            ? "Xərc yadda saxlandı və qaiməyə bağlandı (real maya hesablandı)"
            : "Xərc yadda saxlandı",
        );
        setOpen(false);
        setMebleg("");
        router.refresh();
      }
    });
  }

  // Build invoice preview
  const selectedPurchase = purchases.find((p) => p.id === alisId);
  const preview =
    selectedPurchase && mebleg && Number(mebleg) > 0
      ? `${formatMoney(Number(mebleg))} → ${selectedPurchase.nomre} qaiməsinə bölünür`
      : null;

  const purchaseOptions: ComboOption[] = purchases.map((p) => ({
    value: p.id,
    label: `${p.nomre} · ${p.techizatci_ad ?? "—"}`,
    hint:
      typeof p.tarix === "string" ? p.tarix.slice(0, 10) : p.tarix.toISOString().slice(0, 10),
  }));

  const trigger =
    variant === "compact" ? (
      <Button size="sm" variant="outline" className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> {triggerLabel ?? "Əlavə xərc"}
      </Button>
    ) : (
      <Button
        size="sm"
        className="font-semibold text-white"
        style={{ background: "var(--brand-gradient)" }}
      >
        <Plus className="h-4 w-4" />
        {triggerLabel ?? "Yeni xərc"}
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {lockedAlisId ? "Qaiməyə əlavə xərc" : "Yeni xərc (qaiməyə bağlana bilər)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tesvir">Təsvir *</Label>
            <Input
              id="tesvir"
              name="tesvir"
              required
              minLength={2}
              maxLength={500}
              placeholder="məs. Taksi, gömrük, logistika..."
              autoFocus
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mebleg">Məbləğ (AZN) *</Label>
              <Input
                id="mebleg"
                name="mebleg"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={mebleg}
                onChange={(e) => setMebleg(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kateqoriya</Label>
              <Combobox
                options={categories.map<ComboOption>((c) => ({
                  value: String(c.id),
                  label: c.ad,
                }))}
                value={kateqoriyaId}
                onChange={setKateqoriyaId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Kateqoriya axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
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

          {!lockedAlisId && (
            <div className="space-y-1.5">
              <Label>
                <LinkIcon className="mr-1 inline h-3 w-3" />
                Hansı qaiməyə bağlanır (istəyə bağlı)
              </Label>
              <Combobox
                options={[{ value: "", label: "— Sərbəst xərc (qaiməyə bağlama) —" }, ...purchaseOptions]}
                value={alisId}
                onChange={setAlisId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Qaimə № və ya təchizatçı..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              {preview && (
                <div className="rounded-md bg-info/10 px-2 py-1.5 text-[10.5px] text-info">
                  {preview} — sistem hər sətirin real maya dəyərini avtomatik yeniləyəcək.
                </div>
              )}
            </div>
          )}

          {lockedAlisId && (
            <div className="rounded-md bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Bu xərc həmin alış qaiməsinə bağlanacaq. Sistem hər sətrin{" "}
              <span className="font-semibold">real maya dəyərini</span> proporsional olaraq
              yeniləyəcək.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qebz_nomresi">Qəbz nömrəsi (istəyə bağlı)</Label>
            <Input id="qebz_nomresi" name="qebz_nomresi" maxLength={50} disabled={pending} />
          </div>

          {hesablar.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
              <Label htmlFor="hesab_id" className="text-xs">
                Hansı kassa / hesabdan?
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  (seçilərsə qaliq azalacaq)
                </span>
              </Label>
              <select
                id="hesab_id"
                value={hesabId}
                onChange={(e) => setHesabId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                <option value="">— Yalnız qeyd kimi (balansa təsirsiz) —</option>
                {hesablar.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.ad} ({h.nov})
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
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
