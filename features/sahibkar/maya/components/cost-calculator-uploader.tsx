"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload, AlertCircle, CheckCircle2, FileSpreadsheet, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseMayaUploadAction } from "../actions";
import type { MayaHesablamasi, MayaParseResult } from "../types";
import { formatMoney, formatNumber } from "@/lib/utils";

export function CostCalculatorUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MayaHesablamasi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Array<{ sira?: number; field?: string; message: string }>>([]);
  const [fileName, setFileName] = useState<string>("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setError(null);
    setDetails([]);
    const fd = new FormData();
    fd.append("file", f);
    startTransition(async () => {
      const res: MayaParseResult = await parseMayaUploadAction(fd);
      if (res.ok) {
        setResult(res.data);
      } else {
        setError(res.error);
        setDetails(res.details ?? []);
        setResult(null);
      }
    });
  }

  function reset() {
    setResult(null);
    setError(null);
    setDetails([]);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card className="glass">
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Excel ilə maya hesabla
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Şablonu endir, parametrləri və malları doldur, geri yüklə — sistem hər məhsulun
              yekun maya qiymətini AZN-də verir (kurs, daşınma, gömrük, toplama, ehtiyat % nəzərə alınır).
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/api/sahibkar/maya/template" download>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5" /> Şablon endir
              </Button>
            </a>
            <Button
              variant="default"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
            >
              <Upload className="h-3.5 w-3.5" /> {pending ? "Oxunur…" : "Doldurulmuş faylı yüklə"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onFile}
            />
          </div>
        </div>

        {fileName && (
          <div className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/30 px-3 py-1.5 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="h-3 w-3" /> {fileName}
            </span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={reset}>
              <RotateCcw className="h-3 w-3" /> Sıfırla
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <div className="space-y-1">
                <div className="font-medium text-rose-600 dark:text-rose-400">{error}</div>
                {details.length > 0 && (
                  <ul className="ml-1 list-disc space-y-0.5 pl-3 text-xs text-rose-700/80 dark:text-rose-300/80">
                    {details.map((d, i) => <li key={i}>{d.message}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {result && <PreviewTable data={result} />}
      </CardContent>
    </Card>
  );
}

function PreviewTable({ data }: { data: MayaHesablamasi }) {
  const { parametrler, setirler, cem } = data;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        <span>
          {setirler.length} sətir uğurla hesablandı. Kurs: <b>{parametrler.valyuta_kursu}</b>
          {parametrler.valyuta_kod ? ` (${parametrler.valyuta_kod})` : ""} • Ehtiyat: <b>{parametrler.ehtiyat_faizi}%</b>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ParamPill label="Ümumi daşınma" value={formatMoney(parametrler.umumi_dasinma)} />
        <ParamPill label="Ümumi gömrük" value={formatMoney(parametrler.umumi_gomruk)} />
        <ParamPill label="Ümumi toplama" value={formatMoney(parametrler.umumi_toplama)} />
        <ParamPill label="Ümumi yekun maya" value={formatMoney(cem.yekun)} tone="emerald" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Məhsul</th>
              <th className="px-2 py-2 text-left">Kod</th>
              <th className="px-2 py-2 text-right">Say</th>
              <th className="px-2 py-2 text-right">Alış AZN</th>
              <th className="px-2 py-2 text-right">Pay %</th>
              <th className="px-2 py-2 text-right">Daşınma</th>
              <th className="px-2 py-2 text-right">Gömrük</th>
              <th className="px-2 py-2 text-right">Toplama</th>
              <th className="px-2 py-2 text-right">Ehtiyat</th>
              <th className="px-2 py-2 text-right">Yekun AZN</th>
              <th className="px-2 py-2 text-right font-semibold">Vahid maya</th>
            </tr>
          </thead>
          <tbody>
            {setirler.map((s) => (
              <tr key={s.sira} className="border-b border-border/30">
                <td className="px-2 py-1.5 text-muted-foreground">{s.sira}</td>
                <td className="px-2 py-1.5 font-medium">{s.ad}</td>
                <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">{s.kod ?? "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(s.say, 0)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(s.alish_azn)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{(s.pay_faizi * 100).toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(s.dasinma_payi)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(s.gomruk_payi)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(s.toplama_payi)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(s.ehtiyat_dey)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(s.yekun_azn)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(s.vahid_maya)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border/60 bg-secondary/20 text-xs font-medium">
            <tr>
              <td className="px-2 py-2" colSpan={4}>CƏM</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(cem.alish_azn)}</td>
              <td className="px-2 py-2 text-right text-muted-foreground">100%</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(cem.dasinma)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(cem.gomruk)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(cem.toplama)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(cem.ehtiyat)}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatMoney(cem.yekun)}</td>
              <td className="px-2 py-2 text-right text-muted-foreground">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ParamPill({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/40 bg-secondary/30"}`}>
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{value}</div>
    </div>
  );
}
