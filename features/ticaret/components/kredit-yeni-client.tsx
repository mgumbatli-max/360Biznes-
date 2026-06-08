"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  Banknote,
  CircleDollarSign,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { formatMoney } from "@/lib/utils";
import { isEmbedded, closePageModal } from "@/lib/embed-mode";
import { searchCustomersAction, searchProductsAction } from "@/features/pos/search-actions";
import { createKreditSatis } from "../kredit-yeni-actions";
import type { CustomerRow, ProductRow } from "@/features/pos/sale-queries";

// Bank/kredit təşkilatları (Azərbaycanda kredit verən populyar bank və finansial qurumlar)
const BANKS = [
  { kod: "Birbank", komissiya_faiz: 5 },
  { kod: "Kapitalbank", komissiya_faiz: 6 },
  { kod: "Bank Respublika", komissiya_faiz: 7 },
  { kod: "Embafinance", komissiya_faiz: 9 },
  { kod: "Azərkredit", komissiya_faiz: 10 },
  { kod: "AccessBank", komissiya_faiz: 6 },
  { kod: "Digər", komissiya_faiz: 8 },
];

const MUDDET_OPTIONS = [3, 6, 12, 18, 24];

type Line = {
  uid: string;
  mehsul_id: string;
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  endirim_faiz: number;
};

export function KreditYeniClient({
  anbarlar,
  defaultAnbarId,
}: {
  anbarlar: { id: number; ad: string }[];
  defaultAnbarId: number;
}) {
  const router = useRouter();

  // Customer
  const [musteri, setMusteri] = useState<CustomerRow | null>(null);
  const [musteriQ, setMusteriQ] = useState("");
  const [musteriResults, setMusteriResults] = useState<CustomerRow[]>([]);
  const [showCustResults, setShowCustResults] = useState(false);

  // Header
  const [anbarId, setAnbarId] = useState<number>(defaultAnbarId);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [tarix, setTarix] = useState(todayStr);

  // Lines
  const [lines, setLines] = useState<Line[]>([]);
  const [productQ, setProductQ] = useState("");
  const [productResults, setProductResults] = useState<ProductRow[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [productFocused, setProductFocused] = useState(false);

  // Credit "qeyd" details
  const [bank, setBank] = useState(BANKS[0].kod);
  const [muqavile, setMuqavile] = useState("");
  const [muddetAy, setMuddetAy] = useState(12);
  const [aylikFaiz, setAylikFaiz] = useState(2.5);
  const [bankKomissiyaFaiz, setBankKomissiyaFaiz] = useState(BANKS[0].komissiya_faiz);
  const [catmaTarix, setCatmaTarix] = useState("");
  const [qeyd, setQeyd] = useState("");

  const [saving, startSave] = useTransition();

  /* ---------------- Customer search ---------------- */
  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await searchCustomersAction(musteriQ);
      setMusteriResults(r);
    }, musteriQ.trim().length === 0 ? 0 : 200);
    return () => clearTimeout(id);
  }, [musteriQ]);

  /* ---------------- Product search ---------------- */
  useEffect(() => {
    setProductSearching(true);
    const id = setTimeout(async () => {
      const r = await searchProductsAction(productQ, anbarId);
      setProductResults(r);
      setProductSearching(false);
    }, productQ.trim().length === 0 ? 0 : 200);
    return () => clearTimeout(id);
  }, [productQ, anbarId]);

  function addLine(p: ProductRow) {
    setLines((prev) => [
      ...prev,
      {
        uid: Math.random().toString(36).slice(2, 10),
        mehsul_id: p.id,
        ad: p.ad,
        kod: p.kod,
        miqdar: 1,
        qiymet: p.satis_qiymeti,
        endirim_faiz: 0,
      },
    ]);
    setProductQ("");
    setProductResults([]);
  }

  /* ---------------- Hesablamalar ---------------- */
  const umumi = useMemo(
    () => lines.reduce((s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100), 0),
    [lines],
  );
  // Bank komissiyası məbləği (mağazadan tutulur)
  const bankKomissiyaMeb = umumi * (bankKomissiyaFaiz / 100);
  // Mağazaya xalis çatacaq məbləğ
  const magazaNet = umumi - bankKomissiyaMeb;
  // Müştəri tərəfi: aylıq faizlə cəm
  const musteriCemi = umumi * (1 + (aylikFaiz / 100) * muddetAy);
  const aylikOdenis = muddetAy > 0 ? musteriCemi / muddetAy : 0;

  function submit() {
    if (!musteri) {
      toast.error("Müştəri seçin");
      return;
    }
    if (lines.length === 0) {
      toast.error("Ən az 1 məhsul olmalıdır");
      return;
    }
    if (!bank) {
      toast.error("Bank seçin");
      return;
    }
    startSave(async () => {
      const res = await createKreditSatis({
        musteri_id: musteri.id,
        anbar_id: anbarId,
        tarix,
        bank,
        muqavile_nomresi: muqavile || null,
        muddet_ay: muddetAy,
        aylik_faiz: aylikFaiz,
        bank_komissiya_faiz: bankKomissiyaFaiz,
        catma_tarix: catmaTarix || null,
        qeyd: qeyd || null,
        lines: lines.map((l) => ({
          mehsul_id: l.mehsul_id,
          miqdar: l.miqdar,
          qiymet: l.qiymet,
          endirim_faiz: l.endirim_faiz,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.nomre} — net: ${formatMoney(res.magaza_net)}`);
      if (isEmbedded()) closePageModal();
      else router.push(`/ticaret/kredit`);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
      {/* LEFT — əsas forma */}
      <div className="space-y-4">
        <Card className="glass">
          <CardContent className="grid grid-cols-1 gap-3 py-4 md:grid-cols-2">
            <div className="space-y-1 relative">
              <Label>Müştəri *</Label>
              {musteri ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{musteri.ad}</div>
                    {musteri.telefon && <div className="text-xs text-muted-foreground">{musteri.telefon}</div>}
                  </div>
                  <Badge variant="outline" className="text-[10px]">kredit alıcısı</Badge>
                  <button type="button" onClick={() => setMusteri(null)} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
                </div>
              ) : (
                <>
                  <Input
                    value={musteriQ}
                    onChange={(e) => setMusteriQ(e.target.value)}
                    onFocus={() => setShowCustResults(true)}
                    onBlur={() => setTimeout(() => setShowCustResults(false), 150)}
                    placeholder="Müştəri axtar və ya seçin..."
                    className="h-9"
                  />
                  {showCustResults && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                      {musteriResults.map((c) => (
                        <button key={c.id} type="button" onClick={() => { setMusteri(c); setMusteriQ(""); setShowCustResults(false); }} className="block w-full border-b border-border/40 p-2 text-left text-sm hover:bg-secondary">
                          {c.ad} <span className="text-xs text-muted-foreground">{c.telefon ?? ""}</span>
                        </button>
                      ))}
                      {musteriResults.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Tapılmadı</div>}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1">
              <Label>Anbar</Label>
              <Combobox
                options={anbarlar.map<ComboOption>((a) => ({ value: String(a.id), label: a.ad }))}
                value={String(anbarId)}
                onChange={(v) => setAnbarId(Number(v))}
                placeholder="Anbar seçin"
                searchPlaceholder="Anbar axtar..."
                emptyText="Tapılmadı"
              />
            </div>

            <div className="space-y-1">
              <Label>Tarix</Label>
              <Input
                type="date"
                value={tarix}
                max={todayStr}
                onChange={(e) => setTarix(e.target.value)}
                className={`h-9 ${tarix !== todayStr ? "border-amber-500/60 ring-1 ring-amber-500/20" : ""}`}
              />
              {tarix !== todayStr && (
                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  ⚠ Köhnə tarix — «tarix.geri» icazəsi tələb olunur
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Müqavilə №</Label>
              <Input value={muqavile} onChange={(e) => setMuqavile(e.target.value)} placeholder="məs. KB-2026-0042" className="h-9" />
            </div>
          </CardContent>
        </Card>

        {/* Bank */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary-light" />
              Bank / kredit təşkilatı
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Bank</Label>
                <select
                  value={bank}
                  onChange={(e) => {
                    setBank(e.target.value);
                    const b = BANKS.find((x) => x.kod === e.target.value);
                    if (b) setBankKomissiyaFaiz(b.komissiya_faiz);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {BANKS.map((b) => <option key={b.kod} value={b.kod}>{b.kod}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Bank komissiyası (%)</Label>
                <Input type="number" step="0.1" min={0} max={100} value={bankKomissiyaFaiz} onChange={(e) => setBankKomissiyaFaiz(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="h-9" />
                <div className="text-[10px] text-muted-foreground">Bank tutur — mağazaya gəlmir</div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Mağazaya çatma tarixi (təxmini)</Label>
              <Input type="date" value={catmaTarix} onChange={(e) => setCatmaTarix(e.target.value)} className="h-9" />
            </div>
          </CardContent>
        </Card>

        {/* Məhsullar */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-primary-light" />
              Məhsullar
            </h3>

            <div className="relative">
              <Input
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                onFocus={() => setProductFocused(true)}
                onBlur={() => setTimeout(() => setProductFocused(false), 150)}
                placeholder="Məhsul axtar və ya seçin..."
                className="h-9"
              />
              {productSearching && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              {productFocused && productResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[260px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                  {productResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => addLine(p)} className="flex w-full items-center justify-between gap-3 border-b border-border/40 p-2 text-left text-sm hover:bg-secondary">
                      <span className="min-w-0 flex-1 truncate">{p.ad}</span>
                      <span className="text-xs text-muted-foreground">stok: {p.stok_miqdari}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(p.satis_qiymeti)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">Sətir yoxdur</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-2 py-1">Məhsul</th>
                    <th className="px-2 py-1 text-right">Miqdar</th>
                    <th className="px-2 py-1 text-right">Qiymət</th>
                    <th className="px-2 py-1 text-right">Cəm</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const total = l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100);
                    return (
                      <tr key={l.uid} className="border-t border-border/40">
                        <td className="px-2 py-1">
                          <div className="truncate" title={l.ad}>{l.ad}</div>
                          {l.kod && <div className="text-[10px] text-muted-foreground">{l.kod}</div>}
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" step="0.001" value={l.miqdar} onChange={(e) => setLines((p) => p.map((x) => x.uid === l.uid ? { ...x, miqdar: Math.max(0.001, Number(e.target.value) || 0) } : x))} className="h-7 w-20 text-right" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" step="0.01" value={l.qiymet} onChange={(e) => setLines((p) => p.map((x) => x.uid === l.uid ? { ...x, qiymet: Math.max(0, Number(e.target.value) || 0) } : x))} className="h-7 w-24 text-right" />
                        </td>
                        <td className="px-2 py-1 text-right font-semibold tabular-nums">{formatMoney(total)}</td>
                        <td className="px-2 py-1">
                          <button type="button" onClick={() => setLines((p) => p.filter((x) => x.uid !== l.uid))} className="text-muted-foreground hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Müştəriyə kredit şərtləri */}
        <Card className="glass">
          <CardContent className="space-y-3 py-3">
            <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-primary-light" />
              Müştəriyə kredit şərtləri
            </h3>

            <div className="space-y-1">
              <Label>Müddət (ay)</Label>
              <div className="flex flex-wrap gap-1">
                {MUDDET_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMuddetAy(m)}
                    className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                      muddetAy === m
                        ? "border-primary/50 bg-primary/15 text-primary-light"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m} ay
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Aylıq ödəniş faizi (%)</Label>
                <Input type="number" step="0.1" min={0} max={100} value={aylikFaiz} onChange={(e) => setAylikFaiz(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label>Qeyd</Label>
                <Input value={qeyd} onChange={(e) => setQeyd(e.target.value)} placeholder="Əlavə qeyd..." className="h-9" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT — sidebar (xülasə) */}
      <div className="space-y-4">
        {/* Live totals */}
        <Card className="glass border-primary/20">
          <CardContent className="space-y-2 py-4">
            <Row label="Ümumi satış" value={formatMoney(umumi)} />
            <Row label={`Bank komissiyası (${bankKomissiyaFaiz}%)`} value={`- ${formatMoney(bankKomissiyaMeb)}`} />
            <div className="h-px bg-border/60" />
            <div className="rounded-md bg-success/10 px-2 py-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                  <CircleDollarSign className="h-4 w-4" /> Mağazaya çatacaq net
                </span>
                <span className="text-xl font-bold tabular-nums text-success">{formatMoney(magazaNet)}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                = ümumi − bank komissiyası
              </div>
            </div>
            <div className="h-px bg-border/60 my-2" />
            <Row label="Müştəri ümumi ödəyəcək" value={formatMoney(musteriCemi)} />
            <Row label={`Müddət`} value={`${muddetAy} ay`} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Aylıq ödəniş</span>
              <span className="text-lg font-bold brand-text tabular-nums">{formatMoney(aylikOdenis)}</span>
            </div>
            {catmaTarix && (
              <Row label="Çatma tarixi" value={catmaTarix} />
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="glass">
          <CardContent className="space-y-2 py-3">
            <Button
              size="lg"
              onClick={submit}
              disabled={saving || lines.length === 0 || !musteri || !bank}
              className="w-full font-bold text-white"
              style={{ background: "var(--brand-gradient)" }}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kredit qeydi yarat"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Bu yalnız bir qeyddir. Bank pulu gəlinənə qədər heç bir satış/maliyyə əməliyyatı yaranmır.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
