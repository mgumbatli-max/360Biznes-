"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2, ScanBarcode, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { isEmbedded, closePageModal } from "@/lib/embed-mode";
import { createTransfer } from "../actions";
import { getStockForAnbar } from "../stock-lookup-action";

type Anbar = { id: number; ad: string; filial?: string | null };
type Product = { id: string; ad: string; kod: string | null; barkod?: string | null };
type Line = { mehsul_id: string; miqdar: string };

export function TransferDialog({
  anbarlar,
  products,
  autoOpen = false,
}: {
  anbarlar: Anbar[];
  products: Product[];
  /** True olduqda mount zamanı modal avtomatik açılır (məs. `?new=1` ilə gəlmiş istifadəçi üçün). */
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [kaynak, setKaynak] = useState<string>("");
  const [hedef, setHedef] = useState<string>("");
  const [qeyd, setQeyd] = useState("");
  const [lines, setLines] = useState<Line[]>([{ mehsul_id: "", miqdar: "" }]);
  const [scan, setScan] = useState("");

  // Mənbə anbarın məhsul stokları (sətirlərdə görünmə üçün)
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  // Mənbə anbar və ya sətirlər dəyişəndə → stok yenidən oxu
  useEffect(() => {
    const anbarId = Number(kaynak);
    const ids = lines.map((l) => l.mehsul_id).filter(Boolean);
    if (!anbarId || ids.length === 0) {
      setStockMap({});
      return;
    }
    let alive = true;
    getStockForAnbar(anbarId, ids).then((m) => {
      if (alive) setStockMap(m);
    }).catch((e) => {
      if (alive) {
        console.error("Failed to load stock:", e);
        toast.error("Stok yükləmə başarısız oldu");
      }
    });
    return () => { alive = false; };
  }, [kaynak, lines]);

  function addLineFromBarcode(code: string) {
    const found = products.find(
      (p) =>
        (p.barkod ?? "").toLowerCase() === code.toLowerCase() ||
        (p.kod ?? "").toLowerCase() === code.toLowerCase() ||
        p.id === code,
    );
    if (!found) {
      toast.error(`"${code}" tapılmadı`);
      return;
    }
    setLines((p) => {
      // Eyni məhsul artıq varsa — miqdarı +1 et
      const existIdx = p.findIndex((l) => l.mehsul_id === found.id);
      if (existIdx >= 0) {
        return p.map((l, i) =>
          i === existIdx ? { ...l, miqdar: String((Number(l.miqdar) || 0) + 1) } : l,
        );
      }
      // İlk boş sətrə qoy, yoxsa yeni sətr əlavə et
      const emptyIdx = p.findIndex((l) => !l.mehsul_id);
      if (emptyIdx >= 0) {
        return p.map((l, i) =>
          i === emptyIdx ? { mehsul_id: found.id, miqdar: "1" } : l,
        );
      }
      return [...p, { mehsul_id: found.id, miqdar: "1" }];
    });
  }

  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = scan.trim();
    if (!q) return;
    addLineFromBarcode(q);
    setScan("");
  }

  // Auto-open when launched inside PageModal or with ?new=1.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoOpen || isEmbedded()) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setLines((p) => [...p, { mehsul_id: "", miqdar: "" }]);
  }
  function removeLine(i: number) {
    setLines((p) => p.filter((_, idx) => idx !== i));
  }
  function update(i: number, k: keyof Line, v: string) {
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const kAnbar = Number(kaynak);
    const hAnbar = Number(hedef);
    if (!kAnbar || !hAnbar) {
      setError("Mənbə və hədəf anbar tələb olunur");
      return;
    }
    if (kAnbar === hAnbar) {
      setError("Mənbə və hədəf eyni ola bilməz");
      return;
    }
    const valid = lines
      .filter((l) => l.mehsul_id && Number(l.miqdar) > 0)
      .map((l) => ({ mehsul_id: l.mehsul_id, miqdar: Number(l.miqdar) }));
    if (valid.length === 0) {
      setError("Ən az 1 sətir əlavə et");
      return;
    }
    // Mənbə anbarda stok yoxlanışı — client-side ön yoxlama
    const overflowing = valid.filter(
      (v) => (stockMap[v.mehsul_id] ?? 0) < v.miqdar,
    );
    if (overflowing.length > 0) {
      const first = products.find((p) => p.id === overflowing[0].mehsul_id);
      setError(
        `«${first?.ad ?? "məhsul"}» mənbə anbarda kifayət deyil (mövcud: ${stockMap[overflowing[0].mehsul_id] ?? 0}, tələb: ${overflowing[0].miqdar})`,
      );
      return;
    }
    startTransition(async () => {
      const r = await createTransfer({
        kaynak_anbar_id: kAnbar,
        hedef_anbar_id: hAnbar,
        qeyd: qeyd || null,
        satirlar: valid,
      });
      if (!r.ok) setError(r.error);
      else {
        toast.success("Transfer yaradıldı");
        setOpen(false);
        setKaynak("");
        setHedef("");
        setQeyd("");
        setLines([{ mehsul_id: "", miqdar: "" }]);
        if (isEmbedded()) closePageModal();
        else router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yeni transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <Label>Mənbə anbar *</Label>
              <Combobox
                options={anbarlar.map<ComboOption>((a) => ({
                  value: String(a.id),
                  label: a.ad,
                  hint: a.filial ?? undefined,
                }))}
                value={kaynak}
                onChange={setKaynak}
                placeholder="— seç —"
                searchPlaceholder="🔍 Anbar axtar..."
                emptyText="Anbar tapılmadı"
                disabled={pending}
              />
            </div>
            <div className="pb-1.5">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label>Hədəf anbar *</Label>
              <Combobox
                options={anbarlar.map<ComboOption>((a) => ({
                  value: String(a.id),
                  label: a.ad,
                  hint: a.filial ?? undefined,
                }))}
                value={hedef}
                onChange={setHedef}
                placeholder="— seç —"
                searchPlaceholder="🔍 Anbar axtar..."
                emptyText="Anbar tapılmadı"
                disabled={pending}
              />
            </div>
          </div>

          <div>
            <Label>Qeyd</Label>
            <Input value={qeyd} onChange={(e) => setQeyd(e.target.value)} placeholder="Transfer səbəbi və ya əlavə qeyd" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Köçürüləcək məhsullar *</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addLine}>
                + Sətir
              </Button>
            </div>

            {/* Barkod skaner — Enter ilə uyğun məhsul tapılır və +1 əlavə olunur */}
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                <ScanBarcode className="h-3.5 w-3.5" />
              </div>
              <input
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={onScan}
                placeholder="Barkod skanla və ya yaz (Enter)"
                className="h-7 flex-1 rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
              <span className="text-[10.5px] text-muted-foreground">
                {lines.filter((l) => l.mehsul_id).length} sətr ·{" "}
                {lines.reduce((s, l) => s + (Number(l.miqdar) || 0), 0)} ədəd
              </span>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {lines.map((l, i) => {
                const stok = l.mehsul_id ? (stockMap[l.mehsul_id] ?? null) : null;
                const requested = Number(l.miqdar) || 0;
                const overflow = stok != null && requested > stok;
                const stokTone =
                  stok == null
                    ? ""
                    : stok <= 0
                    ? "text-rose-600 bg-rose-500/10 border-rose-500/30"
                    : stok < 5
                    ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                    : "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
                return (
                  <div key={i} className="space-y-1">
                    <div className="grid grid-cols-[1fr_120px_36px] gap-2">
                      <Combobox
                        options={products.map<ComboOption>((p) => ({
                          value: String(p.id),
                          label: p.ad,
                          hint: p.kod ?? undefined,
                        }))}
                        value={l.mehsul_id}
                        onChange={(v) => update(i, "mehsul_id", v)}
                        placeholder="— məhsul —"
                        searchPlaceholder="🔍 Məhsul axtar (ad, kod)..."
                        emptyText="Məhsul tapılmadı"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.miqdar}
                        onChange={(e) => update(i, "miqdar", e.target.value)}
                        placeholder="Miqdar"
                        className={overflow ? "border-rose-500 focus-visible:ring-rose-500" : ""}
                      />
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeLine(i)} disabled={lines.length <= 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {l.mehsul_id && stok != null && (
                      <div className="flex items-center justify-between pl-1 text-[10.5px]">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 tabular-nums ${stokTone}`}
                          title={kaynak ? "Mənbə anbarda mövcud stok" : ""}
                        >
                          Mənbə: {stok} əd. mövcud
                        </span>
                        {overflow && (
                          <span className="text-rose-600 font-semibold">
                            ⚠️ {requested - stok} ədəd çatmır
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
