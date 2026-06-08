"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  quickCreateProduct,
  getQuickLookups,
  type QuickCreateProductResult,
} from "../quick-create-actions";

type CreatedProduct = Extract<QuickCreateProductResult, { ok: true }>["product"];

export function QuickCreateProductModal({
  open,
  onOpenChange,
  defaultAd,
  defaultBarkod,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Axtarış sahəsində yazılmış mətn — yeni məhsulun adı kimi pre-fill. */
  defaultAd?: string;
  /** Barkod skan edilibsə amma tapılmayıbsa — barkodu pre-fill. */
  defaultBarkod?: string;
  onCreated: (p: CreatedProduct) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [ad, setAd] = useState(defaultAd ?? "");
  const [kod, setKod] = useState("");
  const [barkod, setBarkod] = useState(defaultBarkod ?? "");
  const [markaId, setMarkaId] = useState<string>("");
  const [kategoriyaId, setKategoriyaId] = useState<string>("");
  const [alishQiymeti, setAlishQiymeti] = useState(0);
  const [satisQiymeti, setSatisQiymeti] = useState(0);
  const [minStok, setMinStok] = useState<string>("");

  const [markalar, setMarkalar] = useState<{ id: number; ad: string }[]>([]);
  const [kateqoriyalar, setKateqoriyalar] = useState<{ id: number; ad: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setAd(defaultAd ?? "");
    setBarkod(defaultBarkod ?? "");
    setKod("");
    setMarkaId("");
    setKategoriyaId("");
    setAlishQiymeti(0);
    setSatisQiymeti(0);
    setMinStok("");
    getQuickLookups()
      .then((d) => {
        setMarkalar(d.markalar);
        setKateqoriyalar(d.kateqoriyalar);
      })
      .catch(() => {});
  }, [open, defaultAd, defaultBarkod]);

  function onSave() {
    if (ad.trim().length < 2) {
      toast.error("Məhsul adı ən azı 2 simvol olmalıdır");
      return;
    }
    startTransition(async () => {
      const r = await quickCreateProduct({
        ad: ad.trim(),
        kod: kod.trim() || "",
        barkod: barkod.trim() || "",
        marka_id: markaId ? Number(markaId) : null,
        kateqoriya_id: kategoriyaId ? Number(kategoriyaId) : null,
        alish_qiymeti: alishQiymeti,
        satis_qiymeti: satisQiymeti,
        min_stok: minStok ? Number(minStok) : null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Yeni məhsul yaradıldı: ${r.product.ad}`);
      onCreated(r.product);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            Sürətli məhsul yarat
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2">
            <Lbl required>Məhsul adı</Lbl>
            <Input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Məsələn: Samsung Buds 3 Pro"
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          <div>
            <Lbl>Kod</Lbl>
            <Input
              value={kod}
              onChange={(e) => setKod(e.target.value)}
              placeholder="SKU / Stok kodu"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Lbl>Barkod</Lbl>
            <Input
              value={barkod}
              onChange={(e) => setBarkod(e.target.value)}
              placeholder="EAN / barkod"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <Lbl>Marka</Lbl>
            <select
              value={markaId}
              onChange={(e) => setMarkaId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">— Seçilməyib —</option>
              {markalar.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ad}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Lbl>Kateqoriya</Lbl>
            <select
              value={kategoriyaId}
              onChange={(e) => setKategoriyaId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">— Seçilməyib —</option>
              {kateqoriyalar.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Lbl>Alış qiyməti (₼)</Lbl>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={alishQiymeti}
              onChange={(e) => setAlishQiymeti(Number(e.target.value) || 0)}
              className="h-9 text-right text-sm tabular-nums"
            />
          </div>
          <div>
            <Lbl>Satış qiyməti (₼)</Lbl>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={satisQiymeti}
              onChange={(e) => setSatisQiymeti(Number(e.target.value) || 0)}
              className="h-9 text-right text-sm tabular-nums"
            />
          </div>

          <div className="col-span-2">
            <Lbl>Minimum stok (xəbərdarlıq)</Lbl>
            <Input
              type="number"
              min={0}
              value={minStok}
              onChange={(e) => setMinStok(e.target.value)}
              placeholder="Boş = xəbərdarlıq yox"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Ləğv
          </Button>
          <Button
            onClick={onSave}
            disabled={pending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Yarat və əlavə et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Lbl({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}
