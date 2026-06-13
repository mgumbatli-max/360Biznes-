"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Check, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { payBordro } from "../maas-actions";
import { getPayrollAccountsAction, type PayrollAccount } from "../payroll-account-action";
import { getPayrollContext, type PayrollContext } from "../payroll-context-action";
import { formatMoney, formatDate } from "@/lib/utils";
import type { BordroRow } from "../types";

type Props = {
  row: BordroRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
};

const NOV_LABEL: Record<string, string> = {
  nagd: "Nağd kassa",
  bank: "Bank hesabı",
  kart: "Kart / POS",
  e_pul: "E-pul",
  diger: "Digər",
};

export function BordroPayDialog({ row, open, onOpenChange, onDone }: Props) {
  const [accounts, setAccounts] = useState<PayrollAccount[]>([]);
  const [hesabId, setHesabId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<PayrollContext | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      getPayrollAccountsAction(),
      row?.istifadeci_id ? getPayrollContext(row.istifadeci_id) : Promise.resolve(null),
    ])
      .then(([rows, ctx]) => {
        setAccounts(rows);
        setContext(ctx);
        const def = rows.find((r) => r.nov === "negd") ?? rows[0]; // QA-orta: kanonik nov "negd" — "nagd" heç vaxt tapılmırdı
        setHesabId(def?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, [open, row?.istifadeci_id]);

  function confirmPay() {
    if (!row?.id) {
      toast.error("Bordro hesablanmayıb");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(row.id));
      if (hesabId) fd.set("hesab_id", hesabId);
      const res = await payBordro(fd);
      if (res.ok) {
        toast.success(`${row.ad_soyad} — ${formatMoney(row.net_meblegh)} ödənildi`);
        // BUG #21: hesab bağlanmasa belə ödəniş qeydə alınır — istifadəçi açıq xəbərdarlıq görür.
        if (res.warning) toast.warning(res.warning);
        onOpenChange(false);
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!row) return null;
  const selectedAcc = accounts.find((a) => a.id === hesabId);
  const insufficient = selectedAcc != null && selectedAcc.qaliq < row.net_meblegh;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Maaş ödənişi
          </DialogTitle>
        </DialogHeader>

        {/* Bordro xülasə */}
        <div className="space-y-2">
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="text-xs text-muted-foreground">İşçi</div>
            <div className="font-semibold">{row.ad_soyad}</div>
            <div className="text-[11px] text-muted-foreground">{row.vezife ?? "—"}</div>
          </div>

          {/* Context paneli — əməkdaşın əvvəlki durumunu göstərir */}
          {context && (
            <div className="rounded-lg border border-sky-300 bg-sky-50/50 p-2.5 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-sky-700">
                Əməkdaş kontekstı
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="flex justify-between gap-2 rounded-md border border-border bg-background/60 px-2 py-1">
                  <span className="text-muted-foreground">Aylıq maaş</span>
                  <span className="font-semibold tabular-nums">{formatMoney(context.aylik_maas)}</span>
                </div>
                <div className="flex justify-between gap-2 rounded-md border border-border bg-background/60 px-2 py-1">
                  <span className="text-muted-foreground">Cəmi qalıq</span>
                  <span className={`font-semibold tabular-nums ${context.qaliq_odenilmeli > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formatMoney(context.qaliq_odenilmeli)}
                  </span>
                </div>
                {context.cari_ay && (
                  <>
                    <div className="flex justify-between gap-2 rounded-md border border-border bg-background/60 px-2 py-1">
                      <span className="text-muted-foreground">Bu ay hesablanmış</span>
                      <span className="font-semibold tabular-nums">{formatMoney(context.cari_ay.hesablanmis)}</span>
                    </div>
                    <div className="flex justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1">
                      <span className="text-emerald-700">Bu ay ödənilib</span>
                      <span className="font-semibold tabular-nums text-emerald-700">{formatMoney(context.cari_ay.odenilib)}</span>
                    </div>
                  </>
                )}
              </div>
              {context.son_odenis ? (
                <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50/50 px-2 py-1 text-[11px]">
                  <span className="text-emerald-700">
                    Son ödəniş: {formatDate(context.son_odenis.tarix)}
                    {context.son_odenis.il > 0 && ` · ${context.son_odenis.il}-${String(context.son_odenis.ay).padStart(2, "0")} ayı`}
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700">{formatMoney(context.son_odenis.mebleg)}</span>
                </div>
              ) : (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                  İlk dəfə ödəniş edilir
                </div>
              )}
              {context.cari_ay && (context.cari_ay.bonus > 0 || context.cari_ay.cerime > 0 || context.cari_ay.avans > 0) && (
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {context.cari_ay.bonus > 0 && (
                    <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                      Bonus: +{formatMoney(context.cari_ay.bonus)}
                    </span>
                  )}
                  {context.cari_ay.cerime > 0 && (
                    <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-rose-700">
                      Cərimə: -{formatMoney(context.cari_ay.cerime)}
                    </span>
                  )}
                  {context.cari_ay.avans > 0 && (
                    <span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-700">
                      Avans: -{formatMoney(context.cari_ay.avans)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 text-sm">
            <Row label="Əsas maaş" value={formatMoney(row.esas_maas)} />
            <Row label="Prorata" value={formatMoney(row.prorata_maas)} sub={`${row.ish_gun_faktiki}/${row.ish_gun_norma} gün`} />
            {row.kpi_bonus > 0 && <Row label="KPI bonus" value={`+${formatMoney(row.kpi_bonus)}`} tone="success" />}
            {row.manual_bonus > 0 && <Row label="Manual bonus" value={`+${formatMoney(row.manual_bonus)}`} tone="success" />}
            {row.satis_komisyon > 0 && <Row label="Komisyon" value={`+${formatMoney(row.satis_komisyon)}`} tone="success" />}
            {row.cerime > 0 && <Row label="Cərimə" value={`-${formatMoney(row.cerime)}`} tone="danger" />}
            {row.avans > 0 && <Row label="Avans" value={`-${formatMoney(row.avans)}`} tone="danger" />}
            <Row label="Vergi" value={`-${formatMoney(row.vergi)}`} tone="danger" />
            <Row label="Sosial" value={`-${formatMoney(row.sosial_sigorta)}`} tone="danger" />
          </div>

          <div className="flex items-center justify-between rounded-lg border-2 border-primary/40 bg-primary/5 p-3">
            <span className="text-sm font-semibold">Net ödəniləcək</span>
            <span className="text-xl font-bold tabular-nums brand-text">{formatMoney(row.net_meblegh)}</span>
          </div>

          {/* Hesab seçimi */}
          <div className="space-y-1">
            <Label className="text-xs">Hesabdan ödə</Label>
            {loading ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠️ Aktiv kassa/bank hesabı yoxdur. Hesab əlavə etmədən ödəniş edilə bilər, lakin balansa yansımayacaq.
              </div>
            ) : (
              <select
                value={hesabId}
                onChange={(e) => setHesabId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ad} · {NOV_LABEL[a.nov] ?? a.nov} · {formatMoney(a.qaliq)} {a.valyuta}
                  </option>
                ))}
              </select>
            )}
            {insufficient && (
              <div className="rounded-md border border-rose-500/40 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                ⚠️ Seçilmiş hesabın qalıqı net ödənişdən azdır ({formatMoney(selectedAcc!.qaliq)} ₼).
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            İmtina
          </Button>
          <Button onClick={confirmPay} disabled={pending || !row.id}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Ödə və qeyd et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "danger";
}) {
  const cls = tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-rose-600" : "";
  return (
    <div>
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
