"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { transferStock } from "../stock-actions";
import { searchProductsAction } from "@/features/pos/search-actions";
import type { ProductRow } from "@/features/pos/sale-queries";

type AnbarOpt = { id: number; ad: string };

type Props = {
  anbarlar: AnbarOpt[];
  trigger?: React.ReactNode;
};

export function TransferDialog({ anbarlar, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [kaynakId, setKaynakId] = useState<number>(anbarlar[0]?.id ?? 0);
  const [hedefId, setHedefId] = useState<number>(anbarlar[1]?.id ?? anbarlar[0]?.id ?? 0);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [miqdar, setMiqdar] = useState("");
  const [qeyd, setQeyd] = useState("");

  useEffect(() => {
    if (!open) return;
    if (searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const id = setTimeout(async () => {
      const rows = await searchProductsAction(searchQ, kaynakId);
      setSearchResults(rows);
    }, 200);
    return () => clearTimeout(id);
  }, [searchQ, kaynakId, open]);

  function onSubmit() {
    setError(null);
    if (!selected) {
      setError("Məhsul seçin");
      return;
    }
    if (!miqdar || Number(miqdar) <= 0) {
      setError("Miqdar tələb olunur");
      return;
    }
    if (kaynakId === hedefId) {
      setError("Mənbə və hədəf eyni ola bilməz");
      return;
    }
    startTransition(async () => {
      const res = await transferStock({
        mehsul_id: selected.id,
        kaynak_anbar_id: kaynakId,
        hedef_anbar_id: hedefId,
        miqdar: Number(miqdar),
        qeyd: qeyd || undefined,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Transfer tamamlandı");
        setOpen(false);
        setSelected(null);
        setSearchQ("");
        setMiqdar("");
        setQeyd("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Anbarlar arası transfer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="kaynak">Mənbə anbar *</Label>
              <select
                id="kaynak"
                value={kaynakId}
                onChange={(e) => setKaynakId(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                {anbarlar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ad}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hedef">Hədəf anbar *</Label>
              <select
                id="hedef"
                value={hedefId}
                onChange={(e) => setHedefId(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                {anbarlar.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === kaynakId}>
                    {a.ad}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Məhsul *</Label>
            {selected ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{selected.ad}</div>
                  <div className="text-xs text-muted-foreground">
                    Mənbədə mövcud: <span className="font-mono">{selected.stok_miqdari}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Dəyiş
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="search" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Məhsul axtar..." className="h-9 pl-8" disabled={pending} />
                {searchResults.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                    {searchResults.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelected(p);
                          setSearchResults([]);
                          setSearchQ("");
                        }}
                        className="flex w-full items-center justify-between border-b border-border/40 p-2 text-left text-xs hover:bg-secondary"
                      >
                        <span className="truncate">{p.ad}</span>
                        <span className="font-mono text-muted-foreground">{p.stok_miqdari} əd</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="miqdar">Miqdar *</Label>
            <Input
              id="miqdar"
              type="number"
              min={0.001}
              step="0.001"
              value={miqdar}
              onChange={(e) => setMiqdar(e.target.value)}
              disabled={pending}
              max={selected?.stok_miqdari}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qeyd">Qeyd</Label>
            <Input id="qeyd" maxLength={500} value={qeyd} onChange={(e) => setQeyd(e.target.value)} disabled={pending} placeholder="Niyə transfer?" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="button" onClick={onSubmit} disabled={pending || !selected || !miqdar}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Köçür
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
