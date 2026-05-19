"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Package, Sparkles, Upload, Image as ImageIcon, X, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addProposalLine, uploadProposalImage } from "../proposal-actions";

type Product = {
  id: string;
  ad: string;
  kod: string | null;
  barkod: string | null;
  marka: string | null;
  alish_qiymeti: { toNumber?: () => number } | number | null;
  satis_qiymeti: { toNumber?: () => number } | number | null;
  son_alish_de: Date | null;
  stok: Array<{ miqdar: { toNumber?: () => number } | number | null }>;
};

type Supplier = { id: string; ad: string };

function toNum(v: { toNumber?: () => number } | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber ? v.toNumber() : Number(v);
}

export function AddLineDialog({
  teklifId,
  products,
  suppliers,
}: {
  teklifId: number;
  products: Product[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"catalog" | "new">("catalog");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // form state
  const [mesul_adi, setName] = useState("");
  const [mesul_kod, setCode] = useState("");
  const [marka, setMarka] = useState("");
  const [kateqoriya, setKateqoriya] = useState("");
  const [miqdar, setMiqdar] = useState("1");
  const [teyinat, setTeyinat] = useState("");
  const [bazar, setBazar] = useState("");
  const [sonAlish, setSonAlish] = useState("");
  const [teklifQ, setTeklifQ] = useState("");
  const [satisQ, setSatisQ] = useState("");
  const [techizatciId, setTechizatciId] = useState("");
  const [techizatciAd, setTechizatciAd] = useState("");
  const [qeyd, setQeyd] = useState("");
  const [servisMehsulu, setServisMehsulu] = useState(false);

  function reset() {
    setError(null);
    setSelectedProduct(null);
    setName("");
    setCode("");
    setMarka("");
    setKateqoriya("");
    setMiqdar("1");
    setTeyinat("");
    setBazar("");
    setSonAlish("");
    setTeklifQ("");
    setSatisQ("");
    setTechizatciId("");
    setTechizatciAd("");
    setQeyd("");
    setImageUrl("");
    setServisMehsulu(false);
    setSearch("");
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setName(p.ad);
    setCode(p.kod ?? "");
    setMarka(p.marka ?? "");
    setSonAlish(String(toNum(p.alish_qiymeti) || ""));
    setTeklifQ(String(toNum(p.alish_qiymeti) || ""));
    setSatisQ(String(toNum(p.satis_qiymeti) || ""));
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadProposalImage(fd);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
    } else {
      setImageUrl(res.url);
      toast.success("Şəkil yükləndi");
    }
  }

  function submit() {
    setError(null);
    if (!mesul_adi.trim()) return setError("Məhsul adı tələb olunur");
    if (!miqdar || Number(miqdar) <= 0) return setError("Miqdar > 0 olmalıdır");

    const fd = new FormData();
    fd.set("teklif_id", String(teklifId));
    if (selectedProduct) fd.set("mehsul_id", selectedProduct.id);
    fd.set("mehsul_adi", mesul_adi);
    if (mesul_kod) fd.set("mehsul_kod", mesul_kod);
    if (marka) fd.set("marka", marka);
    if (kateqoriya) fd.set("kateqoriya", kateqoriya);
    fd.set("miqdar", miqdar);
    fd.set("vahid", "ed");
    if (teyinat) fd.set("teyinat", teyinat);
    if (bazar) fd.set("bazar_qiymeti", bazar);
    if (sonAlish) fd.set("son_alish_qiymeti", sonAlish);
    if (teklifQ) fd.set("teklif_qiymeti", teklifQ);
    if (satisQ) fd.set("satis_qiymeti", satisQ);
    if (techizatciId) fd.set("techizatci_id", techizatciId);
    if (!techizatciId && techizatciAd) fd.set("techizatci_ad", techizatciAd);
    if (qeyd) fd.set("qeyd", qeyd);
    if (imageUrl) fd.set("shekil_url", imageUrl);
    if (tab === "new") fd.set("yeni_mehsul", "true");
    if (servisMehsulu) fd.set("servis_mehsulu", "true");

    startTransition(async () => {
      const res = await addProposalLine(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Sətir əlavə olundu");
        setOpen(false);
        reset();
        router.refresh();
      }
    });
  }

  const filteredProducts = search.trim()
    ? products.filter(
        (p) =>
          p.ad.toLowerCase().includes(search.toLowerCase()) ||
          p.kod?.toLowerCase().includes(search.toLowerCase()) ||
          p.barkod?.includes(search)
      )
    : products;

  const tEqiymetNum = Number(teklifQ);
  const satisQNum = Number(satisQ);
  const miqdarNum = Number(miqdar);
  const cəmiMeblegh = miqdarNum * tEqiymetNum;
  const mənfeet = (satisQNum - tEqiymetNum) * miqdarNum;
  const marja = tEqiymetNum > 0 ? ((satisQNum - tEqiymetNum) / tEqiymetNum) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Sətir əlavə et
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Yeni sətir
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border border-border/40 bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setTab("catalog")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              tab === "catalog" ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            <Package className="mr-1 inline h-3.5 w-3.5" /> Kataloqdan seç
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("new");
              setSelectedProduct(null);
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              tab === "new" ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Yeni məhsul
          </button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {tab === "catalog" && !selectedProduct && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, kod və ya barkod..." className="pl-8" autoFocus />
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border/40">
              {filteredProducts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Tapılmadı</div>
              ) : (
                filteredProducts.map((p) => {
                  const stok = p.stok.reduce((s, r) => s + toNum(r.miqdar), 0);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-secondary/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.ad}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.kod ?? "—"} · stok: <span className={stok === 0 ? "text-rose-500" : ""}>{stok}</span>
                          {p.alish_qiymeti && <> · maya: {toNum(p.alish_qiymeti).toFixed(2)}₼</>}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {(tab === "new" || selectedProduct) && (
          <div className="space-y-3">
            {selectedProduct && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="flex-1">
                  <div className="font-semibold">{selectedProduct.ad}</div>
                  <div className="text-muted-foreground">
                    Stok: {selectedProduct.stok.reduce((s, r) => s + toNum(r.miqdar), 0)} · Son alış maya: {toNum(selectedProduct.alish_qiymeti).toFixed(2)}₼
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr]">
              <div className="space-y-1">
                <Label className="text-[10.5px]">Məhsul adı *</Label>
                <Input value={mesul_adi} onChange={(e) => setName(e.target.value)} placeholder="iPhone 15 Pro Max 256GB" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px]">Kod / SKU</Label>
                <Input value={mesul_kod} onChange={(e) => setCode(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10.5px]">Marka</Label>
                <Input value={marka} onChange={(e) => setMarka(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px]">Kateqoriya</Label>
                <Input value={kateqoriya} onChange={(e) => setKateqoriya(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-[10.5px]">Miqdar *</Label>
                <Input type="number" step="0.001" min="0" value={miqdar} onChange={(e) => setMiqdar(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px]">Bazar qiyməti (₼)</Label>
                <Input type="number" step="0.01" min="0" value={bazar} onChange={(e) => setBazar(e.target.value)} placeholder="AI ilə doldur" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px]">Son alış maya</Label>
                <Input type="number" step="0.01" min="0" value={sonAlish} onChange={(e) => setSonAlish(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px]">Təklif qiyməti</Label>
                <Input type="number" step="0.01" min="0" value={teklifQ} onChange={(e) => setTeklifQ(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10.5px]">Satış qiyməti (gözlənilən)</Label>
              <Input type="number" step="0.01" min="0" value={satisQ} onChange={(e) => setSatisQ(e.target.value)} />
            </div>

            {tEqiymetNum > 0 && satisQNum > 0 && (
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/40 bg-secondary/30 p-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cəmi (təklif)</div>
                  <div className="font-bold tabular-nums">{cəmiMeblegh.toFixed(2)} ₼</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mənfəət</div>
                  <div className={cn("font-bold tabular-nums", mənfeet < 0 ? "text-rose-500" : "text-emerald-600")}>
                    {mənfeet.toFixed(2)} ₼
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Marja</div>
                  <div className={cn("font-bold tabular-nums", marja < 0 ? "text-rose-500" : "")}>
                    {marja.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr]">
              <div className="space-y-1">
                <Label className="text-[10.5px]">Təchizatçı (kataloqdan)</Label>
                <select
                  value={techizatciId}
                  onChange={(e) => setTechizatciId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Seçin —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.ad}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10.5px]">və ya yeni təchizatçı adı</Label>
                <Input value={techizatciAd} onChange={(e) => setTechizatciAd(e.target.value)} disabled={!!techizatciId} placeholder="Sərbəst yaz" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10.5px]">Təyinat / niyə lazımdır</Label>
              <textarea
                value={teyinat}
                onChange={(e) => setTeyinat(e.target.value)}
                rows={2}
                placeholder="Bu məhsulu niyə alaq? Hansı müştəri istəyir?"
                className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10.5px]">Şəkil</Label>
              <div className="flex items-center gap-2">
                {imageUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="absolute -right-1 -top-1 rounded-full bg-rose-500 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border bg-secondary/30 hover:bg-secondary/50">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <p className="text-[10.5px] text-muted-foreground">
                  Şəkil yüklə (PNG/JPG/WebP/GIF, max 5MB) — yeni məhsul üçün xüsusilə yardımcı olur
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10.5px]">Əlavə qeyd</Label>
              <Input value={qeyd} onChange={(e) => setQeyd(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={servisMehsulu}
                onChange={(e) => setServisMehsulu(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>Servis üçün (təmir/əvəzedici hissə)</span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            İmtina
          </Button>
          {(tab === "new" || selectedProduct) && (
            <Button type="button" onClick={submit} disabled={pending || !mesul_adi.trim()}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Əlavə et
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
