"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HandCoins } from "lucide-react";
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
import { receivePartialPayment } from "../actions";
import { formatMoney, formatDate } from "@/lib/utils";

type HesabOpt = { id: string; ad: string; nov?: string };

/** Hesabın tipini Maliyə əməliyyatının `odenis_nov`-una map edir.
 *  Hesab tipi vahid həqiqət mənbəyi olmalıdır — istifadəçi ödəniş növünü
 *  ayrıca seçmir, hesab seçimi onu avtomatik müəyyən edir.
 */
function hesabNovToOdenis(nov: string | undefined): "negd" | "kart" | "kecirme" {
  switch (nov) {
    case "nagd":
      return "negd";
    case "kart":
    case "e_pul":
      return "kart";
    case "bank":
      return "kecirme";
    default:
      return "negd";
  }
}

const NOV_BADGE: Record<string, { label: string; cls: string }> = {
  nagd:  { label: "Nağd",           cls: "border-emerald-500/40 bg-emerald-50 text-emerald-700" },
  kart:  { label: "Kart",           cls: "border-sky-500/40 bg-sky-50 text-sky-700" },
  bank:  { label: "Bank köçürməsi", cls: "border-indigo-500/40 bg-indigo-50 text-indigo-700" },
  e_pul: { label: "E-pul",          cls: "border-violet-500/40 bg-violet-50 text-violet-700" },
  diger: { label: "Digər",          cls: "border-border bg-secondary text-muted-foreground" },
};
type OpenSale = {
  id: string;
  nomre: string;
  tarix: Date | string;
  qalig: number;
};

type Props = {
  musteriId: string;
  ad: string;
  borc: number;
  hesablar: HesabOpt[];
  openSales: OpenSale[];
  /** "button" = full gradient button, "icon" = compact icon */
  variant?: "icon" | "button" | "gradient";
  /** Optional preselected qaime id */
  defaultQaimeId?: string;
};

export function NisyePaymentQuick({
  musteriId,
  ad,
  borc,
  hesablar,
  openSales,
  variant = "button",
  defaultQaimeId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedSales = [...openSales].sort((a, b) => {
    const ta = new Date(a.tarix).getTime();
    const tb = new Date(b.tarix).getTime();
    return ta - tb;
  });
  const defaultId = defaultQaimeId ?? sortedSales[0]?.id ?? "";

  const [qaimeId, setQaimeId] = useState<string>(defaultId);
  const [hesabId, setHesabId] = useState<string>(hesablar[0]?.id ?? "");
  const [mebleg, setMebleg] = useState<string>(() => {
    const start = sortedSales[0]?.qalig ?? borc;
    return start > 0 ? start.toFixed(2) : borc.toFixed(2);
  });
  const [fullPay, setFullPay] = useState<boolean>(false);

  // When user picks a different qaime, prefill the amount with its remaining balance
  useEffect(() => {
    const found = sortedSales.find((s) => s.id === qaimeId);
    if (found) {
      setMebleg(found.qalig.toFixed(2));
      setFullPay(false);
    } else if (qaimeId === "") {
      setMebleg(borc.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaimeId]);

  // Toggle full debt payment
  useEffect(() => {
    if (fullPay) setMebleg(borc.toFixed(2));
  }, [fullPay, borc]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!hesabId) {
      setError("Hesab/kassa seçilməyib");
      return;
    }
    const meblegNum = Number(mebleg);
    if (!Number.isFinite(meblegNum) || meblegNum <= 0) {
      setError("Məbləğ düzgün deyil");
      return;
    }

    // Artıq ödəniş — yalnız BÜTÜN açıq qaimələrdən çoxdursa təsdiq tələb et
    // (məbləğ tək qaimədən böyükdürsə cascade avtomatik növbətiyə keçirir)
    if (meblegNum > borc + 0.01) {
      const overpay = meblegNum - borc;
      const confirmed = window.confirm(
        `Ödəniş cəmi borcdan ${overpay.toFixed(2)} ₼ çoxdur.\n\n` +
        `• OK: ${borc.toFixed(2)} ₼ bütün açıq qaimələrə paylanır, ${overpay.toFixed(2)} ₼ avansa keçir\n` +
        `• İmtina: məbləği özünüz düzəldə bilərsiniz`,
      );
      if (!confirmed) return;
    }

    const fd = new FormData(e.currentTarget);
    fd.set("musteri_id", musteriId);
    if (qaimeId) fd.set("qaime_id", qaimeId);
    fd.set("hesab_id", hesabId);
    // Ödəniş növü avtomatik — hesabın tipindən. Ziddiyyət (bank+nağd) yaranmaz.
    const selectedHesab = hesablar.find((h) => h.id === hesabId);
    fd.set("odenis_nov", hesabNovToOdenis(selectedHesab?.nov));
    // 🛡️ Idempotency key — eyni dialog session-ında double-submit
    // qarşısını alır (refresh və ya çoxlu klik üçün)
    if (!fd.get("idempotency_key")) {
      fd.set("idempotency_key", `pay-${musteriId}-${Date.now()}`);
    }
    startTransition(async () => {
      const res = await receivePartialPayment(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success(res.message ?? "Ödəniş qəbul edildi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  const trigger =
    variant === "gradient" ? (
      <Button
        size="sm"
        className="gap-1.5 font-semibold text-white"
        style={{ background: "var(--brand-gradient)" }}
      >
        <HandCoins className="h-3.5 w-3.5" /> Borcdan al
      </Button>
    ) : variant === "icon" ? (
      <Button
        size="icon-sm"
        variant="ghost"
        title="Ödəniş al"
        className="text-success hover:text-success"
      >
        <HandCoins className="h-3.5 w-3.5" />
      </Button>
    ) : (
      <Button size="sm" variant="outline" className="gap-1.5">
        <HandCoins className="h-3.5 w-3.5" /> Ödəniş al
      </Button>
    );

  const saleOptions: ComboOption[] = sortedSales.map((s) => ({
    value: s.id,
    label: `${s.nomre} · ${formatMoney(s.qalig)}`,
    hint: typeof s.tarix === "string" ? s.tarix.slice(0, 10) : formatDate(s.tarix),
  }));
  const hesabOptions: ComboOption[] = hesablar.map((h) => ({ value: h.id, label: h.ad }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Borcdan ödəniş al — {ad}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md bg-warning/10 px-3 py-2 text-xs">
            Borc balansı:{" "}
            <span className="font-semibold text-warning">{formatMoney(borc)}</span>
            {sortedSales.length > 0 && (
              <span className="ml-2 text-muted-foreground">
                · {sortedSales.length} açıq qaimə
              </span>
            )}
          </div>

          {sortedSales.length > 0 && (
            <div className="space-y-1.5">
              <Label>Hansı qaiməyə bağlanır</Label>
              <Combobox
                options={[{ value: "", label: "— Ümumi borc (qaimə seçmə) —" }, ...saleOptions]}
                value={qaimeId}
                onChange={setQaimeId}
                placeholder="— Ən köhnə qaimə —"
                searchPlaceholder="🔍 Qaimə axtar..."
                emptyText="Tapılmadı"
                disabled={pending}
              />
            </div>
          )}

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
              autoFocus
            />
            <label className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <input
                type="checkbox"
                checked={fullPay}
                onChange={(e) => setFullPay(e.target.checked)}
                disabled={pending}
              />
              Borcu tam yox et ({formatMoney(borc)})
            </label>
          </div>

          {/* Paylama preview — ödənişin hansı qaimələrə necə bölünəcəyini göstərir */}
          {(() => {
            const meblegNum = Number(mebleg) || 0;
            if (meblegNum <= 0 || sortedSales.length === 0) return null;

            // Seçilmiş qaiməni əvvələ qoy
            const order = qaimeId
              ? [
                  ...sortedSales.filter((s) => s.id === qaimeId),
                  ...sortedSales.filter((s) => s.id !== qaimeId),
                ]
              : sortedSales;

            let remain = meblegNum;
            const preview: Array<{ nomre: string; old: number; applied: number; new: number; closed: boolean }> = [];
            for (const inv of order) {
              if (remain <= 0.01) break;
              const apply = Math.min(remain, inv.qalig);
              preview.push({
                nomre: inv.nomre,
                old: inv.qalig,
                applied: +apply.toFixed(2),
                new: +(inv.qalig - apply).toFixed(2),
                closed: apply >= inv.qalig - 0.01,
              });
              remain -= apply;
            }
            const advance = +Math.max(0, remain).toFixed(2);
            if (preview.length === 0 && advance === 0) return null;

            return (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-2 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">
                  Bu ödəniş belə bölünəcək:
                </div>
                {preview.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-medium truncate">#{p.nomre}</span>
                      <span className={`text-[9.5px] px-1.5 py-0 rounded ${
                        p.closed ? "bg-emerald-200 text-emerald-800" : "bg-amber-200 text-amber-800"
                      }`}>
                        {p.closed ? "Tam bağlanır" : "Qismən"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-[10.5px]">
                      <span className="text-muted-foreground tabular-nums">
                        {p.old.toFixed(2)} → {p.new.toFixed(2)}
                      </span>
                      <span className="font-bold tabular-nums text-emerald-700">
                        −{p.applied.toFixed(2)} ₼
                      </span>
                    </div>
                  </div>
                ))}
                {advance > 0 && (
                  <div className="flex items-center justify-between border-t border-emerald-300 pt-1 text-[11px]">
                    <span className="font-semibold text-violet-700">Avans qalığına:</span>
                    <span className="font-bold tabular-nums text-violet-700">+{advance.toFixed(2)} ₼</span>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="space-y-1.5">
            <Label>Ödəniş hesabı / kassa *</Label>
            <Combobox
              options={hesabOptions}
              value={hesabId}
              onChange={setHesabId}
              placeholder="— Seçin —"
              searchPlaceholder="🔍 Axtar..."
              emptyText="Tapılmadı"
              disabled={pending}
            />
            {(() => {
              const sel = hesablar.find((h) => h.id === hesabId);
              const badge = NOV_BADGE[sel?.nov ?? "diger"] ?? NOV_BADGE.diger;
              return (
                <div className="mt-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <span>Ödəniş növü:</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })()}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Qeyd (istəyə bağlı)</Label>
            <Input id="qeyd" name="qeyd" maxLength={500} disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending || !mebleg || Number(mebleg) <= 0}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ödəniş al
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
