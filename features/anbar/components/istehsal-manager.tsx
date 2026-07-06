"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Factory, Plus, Trash2, Search, Loader2, Check, X } from "lucide-react";
import { setRecipe, produceProduct } from "@/features/anbar/istehsal-actions";
import { searchProductsForPurchaseAction } from "@/features/pos/search-actions";
import { formatMoney } from "@/lib/utils";
import type { Recept } from "@/features/anbar/istehsal";

type Anbar = { id: number; ad: string };
type PickRow = { id: string; ad: string; alish_qiymeti: number };
type CompRow = { mehsul_id: string; ad: string; miqdar: number; maya: number };

function ProductSearch({ onPick, placeholder }: { onPick: (p: PickRow) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PickRow[]>([]);
  const [pending, start] = useTransition();
  function run(v: string) {
    setQ(v);
    if (v.trim().length < 2) { setRows([]); return; }
    start(async () => {
      const res = await searchProductsForPurchaseAction(v.trim());
      setRows(res.map((r) => ({ id: r.id, ad: r.ad, alish_qiymeti: Number(r.alish_qiymeti ?? 0) })));
    });
  }
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => run(e.target.value)} placeholder={placeholder} className="h-9 pl-8" />
        {pending && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {rows.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => { onPick(r); setQ(""); setRows([]); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent">
              <span>{r.ad}</span>
              <span className="text-xs text-muted-foreground">maya {formatMoney(r.alish_qiymeti)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeEditor({ onDone }: { onDone: () => void }) {
  const [hazir, setHazir] = useState<PickRow | null>(null);
  const [comps, setComps] = useState<CompRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const vahidMaya = comps.reduce((s, c) => s + c.miqdar * c.maya, 0);

  function save() {
    if (!hazir) { setErr("Hazır məhsul seçin"); return; }
    if (comps.length === 0) { setErr("Ən azı bir komponent əlavə edin"); return; }
    setErr(null);
    start(async () => {
      const r = await setRecipe(hazir.id, comps.map((c) => ({ mehsul_id: c.mehsul_id, miqdar: c.miqdar })));
      if (r.ok) { setHazir(null); setComps([]); onDone(); } else setErr(r.error);
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> Yeni resept</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Hazır məhsul</label>
          {hazir ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{hazir.ad}</span>
              <Button variant="ghost" size="sm" onClick={() => setHazir(null)}><X className="h-4 w-4" /></Button>
            </div>
          ) : <ProductSearch onPick={setHazir} placeholder="Hazır məhsulu axtar…" />}
        </div>

        {hazir && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">Komponentlər</label>
            {comps.map((c, i) => (
              <div key={c.mehsul_id} className="flex items-center gap-2 rounded-md border p-2">
                <span className="flex-1 text-sm">{c.ad}</span>
                <Input type="number" min={0} step="any" value={c.miqdar}
                  onChange={(e) => setComps((prev) => prev.map((x, xi) => xi === i ? { ...x, miqdar: Number(e.target.value) } : x))}
                  className="h-8 w-24 text-right tabular-nums" />
                <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">{formatMoney(c.miqdar * c.maya)}</span>
                <Button variant="ghost" size="sm" onClick={() => setComps((prev) => prev.filter((_, xi) => xi !== i))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
              </div>
            ))}
            <ProductSearch placeholder="Komponent əlavə et…" onPick={(p) => {
              if (p.id === hazir.id || comps.some((c) => c.mehsul_id === p.id)) return;
              setComps((prev) => [...prev, { mehsul_id: p.id, ad: p.ad, miqdar: 1, maya: p.alish_qiymeti }]);
            }} />
            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="font-medium">Vahid istehsal-maya: <span className="tabular-nums">{formatMoney(vahidMaya)}</span></span>
              <Button onClick={save} disabled={pending} size="sm">
                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Resepti yadda saxla
              </Button>
            </div>
          </div>
        )}
        {err && <p className="text-sm text-rose-500">{err}</p>}
      </CardContent>
    </Card>
  );
}

function ProduceForm({ recipe, anbarlar, onDone }: { recipe: Recept; anbarlar: Anbar[]; onDone: () => void }) {
  const [qty, setQty] = useState("1");
  const [anbarId, setAnbarId] = useState(anbarlar[0]?.id ?? 0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  function produce() {
    const n = Number(qty);
    if (!(n > 0)) { setMsg({ ok: false, text: "Miqdar 0-dan böyük olmalı" }); return; }
    setMsg(null);
    start(async () => {
      const r = await produceProduct(recipe.hazir_mehsul_id, n, anbarId);
      if (r.ok) { setMsg({ ok: true, text: `${n} ədəd istehsal edildi (maya ${formatMoney(r.data?.istehsal_maya ?? 0)})` }); onDone(); }
      else setMsg({ ok: false, text: r.error });
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="h-8 w-20 text-right tabular-nums" aria-label="Miqdar" />
      <select value={anbarId} onChange={(e) => setAnbarId(Number(e.target.value))} className="h-8 rounded-md border bg-background px-2 text-sm">
        {anbarlar.map((a) => <option key={a.id} value={a.id}>{a.ad}</option>)}
      </select>
      <Button size="sm" onClick={produce} disabled={pending}>
        {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Factory className="mr-1 h-4 w-4" />} İstehsal et
      </Button>
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-500"}`}>{msg.text}</span>}
    </div>
  );
}

export function IstehsalManager({ recipes, anbarlar }: { recipes: Recept[]; anbarlar: Anbar[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      <RecipeEditor onDone={refresh} />

      {recipes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Hələ resept yoxdur. Yuxarıdan yeni resept əlavə edin.</CardContent></Card>
      ) : recipes.map((r) => (
        <Card key={r.hazir_mehsul_id}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{r.hazir_ad}</CardTitle>
              <Badge variant="outline">vahid maya {formatMoney(r.vahid_maya)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr><th className="p-2 text-left font-medium">Komponent</th><th className="p-2 text-right font-medium">1 vahid üçün</th><th className="p-2 text-right font-medium">Sətir maya</th><th className="p-2 text-right font-medium" title="Bütün anbarlar üzrə ümumi qalıq — istehsal seçilmiş anbardan çıxır">Cari stok (ümumi)</th></tr>
                </thead>
                <tbody>
                  {r.komponentler.map((k) => (
                    <tr key={k.mehsul_id} className="border-b last:border-0">
                      <td className="p-2">{k.ad}</td>
                      <td className="p-2 text-right tabular-nums">{k.miqdar}</td>
                      <td className="p-2 text-right tabular-nums">{formatMoney(k.setir_maya)}</td>
                      <td className={`p-2 text-right tabular-nums ${k.cari_stok <= 0 ? "text-rose-500" : ""}`}>{k.cari_stok}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ProduceForm recipe={r} anbarlar={anbarlar} onDone={refresh} />
              <Button variant="ghost" size="sm" className="text-rose-500"
                onClick={async () => { await setRecipe(r.hazir_mehsul_id, []); refresh(); }}>
                <Trash2 className="mr-1 h-4 w-4" /> Resepti sil
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
