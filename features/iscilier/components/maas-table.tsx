"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Check, Loader2, Printer, FileDown, Send } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { calculateBordro, bulkPayBordro } from "../maas-actions";
import { BordroPayDialog } from "./bordro-pay-dialog";
import { formatMoney } from "@/lib/utils";
import type { BordroRow } from "../types";

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

type Props = {
  month: { il: number; ay: number };
  rows: BordroRow[];
  totals: { cemi: number; odenilib: number; odenmeyen: number; vergi: number };
};

export function MaasTable({ month, rows, totals }: Props) {
  const router = useRouter();
  const [bulkPending, startBulkTransition] = useTransition();
  const [calcPending, startCalcTransition] = useTransition();
  const [selectedMonth, setSelectedMonth] = useState(`${month.il}-${String(month.ay).padStart(2, "0")}`);
  const [payDialogRow, setPayDialogRow] = useState<BordroRow | null>(null);

  function gotoMonth(m: string) {
    setSelectedMonth(m);
    const sp = new URLSearchParams();
    sp.set("month", m);
    router.push(`/iscilier/maas?${sp.toString()}`);
  }

  function onCalculate() {
    startCalcTransition(async () => {
      const fd = new FormData();
      fd.set("il", String(month.il));
      fd.set("ay", String(month.ay));
      const res = await calculateBordro(fd);
      if (res.ok) toast.success(`Bordro hesablandı (${res.count ?? 0} qeyd)`);
      else toast.error(res.error);
      router.refresh();
    });
  }

  function openPayDialog(row: BordroRow) {
    if (!row.id) {
      toast.error("Əvvəlcə bordronu hesablayın");
      return;
    }
    setPayDialogRow(row);
  }

  function onBulkPay() {
    if (!confirm("Bütün ödənilməmiş bordrolar ödənilsin?")) return;
    startBulkTransition(async () => {
      const fd = new FormData();
      fd.set("il", String(month.il));
      fd.set("ay", String(month.ay));
      const res = await bulkPayBordro(fd);
      if (res.ok) toast.success(`${res.count ?? 0} bordro ödənildi`);
      else toast.error(res.error);
      router.refresh();
    });
  }

  function onExport() {
    // CSV export
    const lines = [
      ["İşçi", "Vəzifə", "Əsas maaş", "Faktiki gün", "Qaib", "Prorata", "KPI bonus", "Manual bonus", "Satış komisyon", "Cərimə", "Avans", "Vergi", "Sosial", "Net", "Status"].join(","),
      ...rows.map((r) =>
        [
          `"${r.ad_soyad}"`,
          `"${r.vezife ?? ""}"`,
          r.esas_maas,
          r.ish_gun_faktiki,
          r.qaib_gun,
          r.prorata_maas,
          r.kpi_bonus,
          r.manual_bonus,
          r.satis_komisyon,
          r.cerime,
          r.avans,
          r.vergi.toFixed(2),
          r.sosial_sigorta.toFixed(2),
          r.net_meblegh.toFixed(2),
          r.status,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bordro-${month.il}-${String(month.ay).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onPrint() {
    window.print();
  }

  const monthOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value: val, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
  })();

  // Sort: unpaid first (drafts + uncalculated), then paid
  const sortedRows = [...rows].sort((a, b) => {
    const aPaid = a.status === "odenilib" ? 1 : 0;
    const bPaid = b.status === "odenilib" ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;
    return b.net_meblegh - a.net_meblegh;
  });

  return (
    <div className="space-y-3">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedMonth}
          onChange={(e) => gotoMonth(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={onCalculate} disabled={calcPending}>
          {calcPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          Bordro hesabla
        </Button>
        <Button variant="outline" size="sm" onClick={onBulkPay} disabled={bulkPending || totals.odenmeyen <= 0}>
          {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ödəniş et hamı
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <FileDown className="h-4 w-4" /> İxrac (CSV)
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="h-4 w-4" /> Çap
          </Button>
        </div>
      </div>

      {/* KPI strip — 4 cards as per spec */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Cəmi maaş (NET)" value={formatMoney(totals.cemi)} />
        <Mini label="Ödənilib" value={formatMoney(totals.odenilib)} tone="success" />
        <Mini label="Ödənməyib" value={formatMoney(totals.odenmeyen)} tone={totals.odenmeyen > 0 ? "warning" : "neutral"} />
        <Mini label="Vergi cəmi" value={formatMoney(totals.vergi)} tone="info" />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Calculator className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Bordro yoxdur</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            &quot;Bordro hesabla&quot; düyməsi ilə bu ay üçün maaş bordrosu yaradın.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">İşçi / Vəzifə</th>
                  <th className="px-3 py-2.5 text-right">Baz maaş</th>
                  <th className="px-3 py-2.5 text-right" title="Komissiya + KPI + Manual bonus">Bonus<br /><span className="font-normal normal-case text-[9px]">(Kom+KPI)</span></th>
                  <th className="px-3 py-2.5 text-right">Cərimə</th>
                  <th className="px-3 py-2.5 text-right">Vergi</th>
                  <th className="px-3 py-2.5 text-right" title="Net əldə ediləcək">NET</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 w-32">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr key={r.istifadeci_id} className="border-b border-border/30 transition hover:bg-secondary/40">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-secondary text-[10px] font-semibold">
                            {r.ad_soyad.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{r.ad_soyad}</div>
                          <div className="text-xs text-muted-foreground">{r.vezife ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <div>{formatMoney(r.esas_maas)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Prorata: {formatMoney(r.prorata_maas)} ({r.ish_gun_faktiki}/{r.ish_gun_norma} gün)
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.kpi_bonus + r.manual_bonus + r.satis_komisyon > 0 ? (
                        <>
                          <div className="font-semibold text-success">{formatMoney(r.kpi_bonus + r.manual_bonus + r.satis_komisyon)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {r.satis_komisyon > 0 && `kom: ${formatMoney(r.satis_komisyon)}`}
                            {r.kpi_bonus > 0 && ` · KPI: ${formatMoney(r.kpi_bonus)}`}
                            {r.manual_bonus > 0 && ` · əl: ${formatMoney(r.manual_bonus)}`}
                          </div>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-danger">
                      {r.cerime + r.avans > 0 ? formatMoney(r.cerime + r.avans) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatMoney(r.vergi + r.sosial_sigorta)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold brand-text text-base">
                      {formatMoney(r.net_meblegh)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          r.status === "odenilib"
                            ? "border-success/30 text-success"
                            : r.id
                            ? "border-warning/30 text-warning"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {r.status === "odenilib" ? "Ödənilib" : r.id ? "Çernovik" : "Hesablanmayıb"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {r.status !== "odenilib" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!r.id}
                            onClick={() => openPayDialog(r)}
                            className="text-xs"
                          >
                            <Check className="h-3 w-3" /> Ödə
                          </Button>
                        )}
                        <a
                          href={`/iscilier/${r.istifadeci_id}/bordro-print?il=${month.il}&ay=${month.ay}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary/40"
                          title="Bordro PDF"
                        >
                          <Printer className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/30 font-semibold">
                  <td colSpan={5} className="px-3 py-2.5 text-right">Cəmi NET:</td>
                  <td className="px-3 py-2.5 text-right tabular-nums brand-text text-base">{formatMoney(totals.cemi)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <BordroPayDialog
        row={payDialogRow}
        open={payDialogRow !== null}
        onOpenChange={(v) => { if (!v) setPayDialogRow(null); }}
        onDone={() => { setPayDialogRow(null); router.refresh(); }}
      />
    </div>
  );
}

function Mini({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const cls = { neutral: "", success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info" }[tone];
  return (
    <Card className="glass">
      <CardContent className="py-3">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
