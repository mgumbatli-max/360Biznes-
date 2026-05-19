"use client";

import { useState, useTransition } from "react";
import { Calculator, Loader2, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { calculateTaskBonus, type TaskBonusRow } from "../kpi-actions";

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function formatMoney(n: number): string {
  return new Intl.NumberFormat("az-AZ", { style: "currency", currency: "AZN", maximumFractionDigits: 2 }).format(n);
}

export function BonusCalculator() {
  const now = new Date();
  const [il, setIl] = useState(now.getFullYear());
  const [ay, setAy] = useState(now.getMonth() + 1);
  const [bazBonus, setBazBonus] = useState(50);
  const [rows, setRows] = useState<TaskBonusRow[]>([]);
  const [cemiMebleg, setCemiMebleg] = useState<number>(0);
  const [pending, startTransition] = useTransition();
  const [hasRun, setHasRun] = useState(false);

  function run() {
    startTransition(async () => {
      const res = await calculateTaskBonus(il, ay, bazBonus);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(res.rows);
      setCemiMebleg(res.cemi_mebleg);
      setHasRun(true);
      toast.success(`${res.rows.length} işçi üçün bonus hesablandı`);
    });
  }

  return (
    <Card className="glass border-emerald-300/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-emerald-600" /> KPI Bonus Hesablanma (preview)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Formula: baz_bonus × tamamlanma_% × (gecikmə yoxdursa 1.2 əmsalı)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-xs">İl</Label>
            <Input
              type="number"
              value={il}
              onChange={(e) => setIl(Number(e.target.value))}
              min={2020}
              max={2100}
              disabled={pending}
            />
          </div>
          <div>
            <Label className="text-xs">Ay</Label>
            <select
              value={ay}
              onChange={(e) => setAy(Number(e.target.value))}
              disabled={pending}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {MONTH_LABELS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Baz bonus (AZN)</Label>
            <Input
              type="number"
              value={bazBonus}
              onChange={(e) => setBazBonus(Number(e.target.value))}
              min={0}
              disabled={pending}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={run} disabled={pending} className="w-full">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Hesabla
            </Button>
          </div>
        </div>

        {hasRun && (
          <>
            {rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Bu ay üçün tapşırıq qeydi olan işçi tapılmadı
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">İşçi</th>
                      <th className="px-3 py-2 text-right">Cəmi</th>
                      <th className="px-3 py-2 text-right">Tamamlandı</th>
                      <th className="px-3 py-2 text-right">Gecikmiş</th>
                      <th className="px-3 py-2 text-right">Tamamlanma %</th>
                      <th className="px-3 py-2 text-right">Bonus məbləğ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.istifadeci_id} className="border-b border-border/30">
                        <td className="px-3 py-2 font-medium">{r.ad_soyad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.cemi}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{r.tamamlandi}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600">{r.gecikmis}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.tamamlanma_faiz}%</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{formatMoney(r.bonus_mebleg)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/40 font-semibold">
                      <td className="px-3 py-2" colSpan={5}>Cəm bonus məbləğ</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatMoney(cemiMebleg)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
