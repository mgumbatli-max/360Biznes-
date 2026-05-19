"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { createPurchase } from "../alis-actions";
import { formatMoney } from "@/lib/utils";
import { isEmbedded, closePageModal } from "@/lib/embed-mode";

type Supplier = { id: string; ad: string; telefon: string | null };
type ProductOpt = { id: string; ad: string; kod: string | null; alish_qiymeti: number };
type AnbarOpt = { id: number; ad: string };

type CartLine = { mehsul_id: string; ad: string; miqdar: number; qiymet: number };

type Props = {
  suppliers: Supplier[];
  products: ProductOpt[];
  anbarlar: AnbarOpt[];
};

export function PurchaseDialog({ suppliers, products, anbarlar }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [techizatciId, setTechizatciId] = useState(suppliers[0]?.id ?? "");
  const [anbarIdStr, setAnbarIdStr] = useState<string>(anbarlar[0]?.id ? String(anbarlar[0].id) : "");
  const anbarId = Number(anbarIdStr) || 0;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [qaimeNomre, setQaimeNomre] = useState("");
  const [qeyd, setQeyd] = useState("");
  const [receiveNow, setReceiveNow] = useState(true);

  // Auto-open when launched inside PageModal or via ?new=1 query.
  useEffect(() => {
    if (isEmbedded()) {
      setOpen(true);
      return;
    }
    if (typeof window !== "undefined") {
      try {
        const p = new URLSearchParams(window.location.search);
        if (p.get("new") === "1") setOpen(true);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const umumi = useMemo(() => lines.reduce((s, l) => s + l.miqdar * l.qiymet, 0), [lines]);

  function addLine(p: ProductOpt) {
    setLines((prev) => {
      const existing = prev.find((l) => l.mehsul_id === p.id);
      if (existing) return prev.map((l) => (l.mehsul_id === p.id ? { ...l, miqdar: l.miqdar + 1 } : l));
      return [...prev, { mehsul_id: p.id, ad: p.ad, miqdar: 1, qiymet: p.alish_qiymeti }];
    });
  }

  function updateLine(idx: number, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function onSubmit() {
    setError(null);
    if (!techizatciId) {
      setError("Təchizatçı seçin");
      return;
    }
    if (lines.length === 0) {
      setError("Ən az 1 məhsul lazımdır");
      return;
    }
    startTransition(async () => {
      const res = await createPurchase({
        techizatci_id: techizatciId,
        anbar_id: anbarId,
        qaime_nomre: qaimeNomre || undefined,
        qeyd: qeyd || undefined,
        receive_now: receiveNow,
        lines: lines.map((l) => ({ mehsul_id: l.mehsul_id, miqdar: l.miqdar, qiymet: l.qiymet })),
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Alış yaradıldı: ${res.nomre}`);
        setOpen(false);
        setLines([]);
        setQaimeNomre("");
        setQeyd("");
        if (isEmbedded()) closePageModal();
        else router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" />
          Yeni alış
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni alış sifarişi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="techizatci">Təchizatçı *</Label>
              <Combobox
                options={suppliers.map<ComboOption>((s) => ({
                  value: s.id,
                  label: s.ad,
                  hint: s.telefon ?? undefined,
                }))}
                value={techizatciId}
                onChange={setTechizatciId}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Təchizatçı axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
              {suppliers.length === 0 && (
                <p className="text-xs text-warning">Əvvəl təchizatçı yaradın (Əlaqələr)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="anbar">Anbar *</Label>
              <Combobox
                options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
                value={anbarIdStr}
                onChange={setAnbarIdStr}
                placeholder="— Seçin —"
                searchPlaceholder="🔍 Anbar axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qaime">Qaimə nömrəsi</Label>
              <Input id="qaime" value={qaimeNomre} onChange={(e) => setQaimeNomre(e.target.value)} maxLength={50} disabled={pending} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={receiveNow}
                  onChange={(e) => setReceiveNow(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                  disabled={pending}
                />
                Anbara dərhal qəbul et (stok artır)
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Məhsullar *</Label>
            <Combobox
              options={products.map<ComboOption>((p) => ({
                value: p.id,
                label: p.ad,
                hint: p.kod ?? undefined,
              }))}
              value=""
              onChange={(val) => {
                const p = products.find((x) => x.id === val);
                if (p) addLine(p);
              }}
              placeholder="+ Məhsul əlavə et..."
              searchPlaceholder="🔍 Məhsul axtar..."
              emptyText="Tapılmadı"
              disabled={pending}
              clearable={false}
            />
          </div>

          {lines.length > 0 && (
            <div className="rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-card/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2 text-right w-24">Miqdar</th>
                    <th className="px-3 py-2 text-right w-32">Qiymət</th>
                    <th className="px-3 py-2 text-right w-32">Cəmi</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={`${l.mehsul_id}-${idx}`} className="border-b border-border/30">
                      <td className="px-3 py-2 truncate">{l.ad}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0.001}
                          step="0.01"
                          value={l.miqdar}
                          onChange={(e) => updateLine(idx, { miqdar: Number(e.target.value) || 0 })}
                          className="h-7 w-20 rounded border border-border bg-background px-2 text-right tabular-nums"
                          disabled={pending}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.qiymet}
                          onChange={(e) => updateLine(idx, { qiymet: Number(e.target.value) || 0 })}
                          className="h-7 w-24 rounded border border-border bg-background px-2 text-right tabular-nums"
                          disabled={pending}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatMoney(l.miqdar * l.qiymet)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-card/40">
                    <td colSpan={3} className="px-3 py-2 text-right font-semibold">Yekun:</td>
                    <td className="px-3 py-2 text-right text-lg font-bold brand-text tabular-nums">{formatMoney(umumi)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <textarea
              id="qeyd"
              value={qeyd}
              onChange={(e) => setQeyd(e.target.value)}
              rows={2}
              maxLength={2000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
