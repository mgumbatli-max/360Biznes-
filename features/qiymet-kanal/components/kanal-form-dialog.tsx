"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { saveKanalKomissiya } from "../actions";
import type { KanalKomissiya } from "../queries";
import type { KanalExtra } from "../kanal-extra";

export function KanalFormDialog({
  initial,
  initialExtra,
  trigger,
}: {
  initial?: KanalKomissiya;
  initialExtra?: KanalExtra;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [kanal, setKanal] = useState(initial?.kanal ?? "");
  const [komissiya, setKomissiya] = useState(String(initial?.komissiya_faiz ?? 0));
  const [sabit, setSabit] = useState(String(initial?.sabit_komissiya ?? 0));
  const [catdirilma, setCatdirilma] = useState(String(initial?.catdirilma ?? 0));
  const [bankXerc, setBankXerc] = useState(String(initial?.bank_xerc ?? 0));
  const [reklam, setReklam] = useState(String(initial?.reklam_faiz ?? 0));
  const [qaytarma, setQaytarma] = useState(String(initial?.qaytarma_risk ?? 0));
  const [stokBuffer, setStokBuffer] = useState(String(initialExtra?.stok_buffer ?? 0));
  const [rateLimit, setRateLimit] = useState(String(initialExtra?.rate_limit_per_min ?? 0));
  const [outboundUrl, setOutboundUrl] = useState(initialExtra?.outbound_url ?? "");
  const [outboundSecret, setOutboundSecret] = useState(initialExtra?.outbound_secret ?? "");
  const [autoPush, setAutoPush] = useState(initialExtra?.auto_push_on_sale ?? false);

  const isEdit = !!initial?.id;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveKanalKomissiya({
        id: initial?.id,
        kanal: kanal.trim(),
        komissiya_faiz: komissiya,
        sabit_komissiya: sabit,
        catdirilma: catdirilma,
        bank_xerc: bankXerc,
        reklam_faiz: reklam,
        qaytarma_risk: qaytarma,
        stok_buffer: stokBuffer,
        rate_limit_per_min: rateLimit,
        outbound_url: outboundUrl.trim(),
        outbound_secret: outboundSecret.trim(),
        auto_push_on_sale: autoPush,
      });
      if (res.ok) {
        toast.success(isEdit ? "Kanal yeniləndi" : "Kanal əlavə olundu");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> Yeni kanal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Kanal: ${initial?.kanal}` : "Yeni satış kanalı"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="kanal" className="text-xs">Kanal adı (kod) *</Label>
            <Input
              id="kanal"
              value={kanal}
              onChange={(e) => setKanal(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="wolt"
              maxLength={40}
              required
              disabled={isEdit}
              autoFocus={!isEdit}
            />
            <p className="text-[10.5px] text-muted-foreground">
              Kod (kiçik hərflərlə, boşluqsuz). Misal: <code>wolt</code>, <code>birmarket</code>, <code>tap_az</code>, <code>magaza</code>.
              Yaradıldıqdan sonra dəyişmir.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="komissiya" className="text-xs">Komissiya (%)</Label>
              <Input
                id="komissiya"
                type="number"
                inputMode="decimal"
                value={komissiya}
                onChange={(e) => setKomissiya(e.target.value)}
                min={0}
                max={99.9}
                step={0.1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sabit" className="text-xs">Sabit komissiya (₼)</Label>
              <Input
                id="sabit"
                type="number"
                inputMode="decimal"
                value={sabit}
                onChange={(e) => setSabit(e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat" className="text-xs">Çatdırılma (₼)</Label>
              <Input
                id="cat"
                type="number"
                inputMode="decimal"
                value={catdirilma}
                onChange={(e) => setCatdirilma(e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank" className="text-xs">Bank xərci (₼)</Label>
              <Input
                id="bank"
                type="number"
                inputMode="decimal"
                value={bankXerc}
                onChange={(e) => setBankXerc(e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reklam" className="text-xs">Reklam (%)</Label>
              <Input
                id="reklam"
                type="number"
                inputMode="decimal"
                value={reklam}
                onChange={(e) => setReklam(e.target.value)}
                min={0}
                max={50}
                step={0.1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qaytarma" className="text-xs">Qaytarma riski (%)</Label>
              <Input
                id="qaytarma"
                type="number"
                inputMode="decimal"
                value={qaytarma}
                onChange={(e) => setQaytarma(e.target.value)}
                min={0}
                max={50}
                step={0.1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="stok_buffer" className="text-xs">
                Stok bufferi (ədəd)
              </Label>
              <Input
                id="stok_buffer"
                type="number"
                inputMode="numeric"
                value={stokBuffer}
                onChange={(e) => setStokBuffer(e.target.value)}
                min={0}
                step={1}
              />
              <p className="text-[10px] text-muted-foreground">
                API bu qədər ehtiyatı çıxır — kassa satışı ilə kanal sifarişi
                eyni anda gəlsə oversold olmasın. Misal: 5 → real 25 stok, kanal görür 20.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rate_limit" className="text-xs">
                Rate limit (dəqiqədə)
              </Label>
              <Input
                id="rate_limit"
                type="number"
                inputMode="numeric"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
                min={0}
                step={1}
                placeholder="0 = limit yox"
              />
              <p className="text-[10px] text-muted-foreground">
                Eyni key-dən dəqiqədə icazə verilən maks çağırış sayı.
                Aşılarsa HTTP 429 qaytarılır. 0 → limit yoxdur.
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/40 pt-3">
            <Label className="text-xs font-semibold">Outbound (bizdən platformaya push) — opsiyonel</Label>
            <Input
              type="url"
              value={outboundUrl}
              onChange={(e) => setOutboundUrl(e.target.value)}
              placeholder="https://platforma.com/api/stock-sync"
            />
            <Input
              type="text"
              value={outboundSecret}
              onChange={(e) => setOutboundSecret(e.target.value)}
              placeholder="Shared secret (HMAC üçün) — opsiyonel"
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              URL qurulubsa, kanal cədvəlində "Stok push" düyməsi görünür. Sıxılanda
              bütün məhsulların kanal-spesifik qiyməti + stoku bu URL-ə POST göndərilir
              (HMAC-SHA256, X-Signature header). Platforma adapter-i öz menü/kataloq-una
              mapping edir.
            </p>

            <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-border bg-card/30 p-2.5 transition hover:bg-secondary/30">
              <input
                type="checkbox"
                checked={autoPush}
                onChange={(e) => setAutoPush(e.target.checked)}
                disabled={!outboundUrl.trim()}
                className="mt-0.5 h-4 w-4"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold">
                  Auto-push satışdan sonra
                  {!outboundUrl.trim() && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      (URL qurulduqda aktivləşir)
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  POS-da satış tamamlandıqda yalnız stoku dəyişən məhsullar avtomatik
                  bu kanala push olunur (arxa fonda, satış cavabını gözləmir). Uğursuz
                  olarsa retry queue-ya gedir.
                </p>
              </div>
            </label>
          </div>

          <p className="text-[10.5px] text-muted-foreground border-t border-border/40 pt-2">
            Komissiya/xərc <strong>"Net qoru"</strong> rejimində üst-üstə qoyulur ki, net
            qazanc mağaza qiyməti qədər qalsın.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              İmtina
            </Button>
            <Button type="submit" size="sm" disabled={pending || kanal.trim().length < 2}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isEdit ? "Yenilə" : "Əlavə et"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
