"use client";

import { useState, useTransition, useRef } from "react";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { processBankStatement } from "../recon-actions";

type Result = {
  partiyaId: string;
  cemi: number;
  eslesdi: number;
  eslesmedi: number;
  bagliBorc: number;
  totalMebleg: number;
  log: Array<{
    sira: number;
    kod: string;
    mebleg: number;
    status: "eslesdi" | "eslesmedi" | "xeta";
    sifaris_nomre?: string;
    sifaris_id?: string;
    mesaj: string;
  }>;
};

export function BankReconUploader() {
  const [drag, setDrag] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showOnlyMismatched, setShowOnlyMismatched] = useState(false);

  function handleFile(f: File) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("fayl", f);
      const res = await processBankStatement(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setResult(res.data);
        toast.success(`${res.data.eslesdi} satış avtomatik bağlandı`);
      }
    });
  }

  const visibleLog = result?.log.filter(
    (l) => !showOnlyMismatched || l.status !== "eslesdi"
  ) ?? [];

  return (
    <div className="space-y-4">
      <Card className="glass border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Necə işləyir?</p>
              <ol className="ml-4 list-decimal space-y-0.5 text-muted-foreground">
                <li>«Şablon yüklə» düyməsi ilə Excel faylını endir</li>
                <li>Bankdan/Birmarket/Wolt-dan gələn çıxarış məlumatlarını şablona köçür (satış kodu, məbləğ, tarix)</li>
                <li>Faylı geri yüklə — sistem hər kodu satış nömrəsi ilə müqayisə edir</li>
                <li>Match olan borclar avto bağlanır, qalanı manual təsdiqə qalır</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/api/bank/template"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-3.5 w-3.5" /> Şablonu endir (.xlsx)
        </a>
        <span className="text-[11px] text-muted-foreground">
          5 sütun: Satış kodu, Məbləğ, Tarix, Qarşı hesab, Təsvir
        </span>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 text-center transition",
          drag ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:bg-secondary/50",
          pending && "cursor-wait opacity-60"
        )}
      >
        {pending ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}
        <div>
          <div className="text-sm font-semibold">
            {pending ? "Çıxarış işlənir..." : "Excel/CSV faylı bura sürüşdür"}
          </div>
          <div className="text-xs text-muted-foreground">
            və ya kliklə yüklə · maksimum 10 MB
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600">
          <AlertTriangle className="inline h-4 w-4" /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Cəmi sətir" value={result.cemi} />
            <Stat label="Müvəffəq match" value={result.eslesdi} tone="emerald" />
            <Stat label="Tam bağlanan borc" value={result.bagliBorc} tone="primary" />
            <Stat label="Match olmayan" value={result.eslesmedi} tone="amber" />
            <Stat label="Cəmi məbləğ" value={`${result.totalMebleg.toFixed(2)} ₼`} />
          </div>

          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Nəticə logu</CardTitle>
              <button
                type="button"
                onClick={() => setShowOnlyMismatched(!showOnlyMismatched)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                  showOnlyMismatched
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {showOnlyMismatched ? "Hamısını göstər" : "Yalnız problemli"}
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b border-border/40 text-left">
                      <th className="px-3 py-2 w-12 text-right">Sətir</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Kod</th>
                      <th className="px-3 py-2 text-right">Məbləğ</th>
                      <th className="px-3 py-2">Satış №</th>
                      <th className="px-3 py-2">Mesaj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLog.map((l, i) => {
                      const Icon =
                        l.status === "eslesdi" ? CheckCircle2 : l.status === "eslesmedi" ? AlertTriangle : XCircle;
                      const cls =
                        l.status === "eslesdi"
                          ? "text-emerald-600 border-emerald-500/40"
                          : l.status === "eslesmedi"
                          ? "text-amber-500 border-amber-500/40"
                          : "text-rose-500 border-rose-500/40";
                      return (
                        <tr key={i} className="border-b border-border/20 hover:bg-secondary/30">
                          <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                            #{l.sira}
                          </td>
                          <td className="px-3 py-1.5">
                            <Badge variant="outline" className={cn("gap-1 text-[10px]", cls)}>
                              <Icon className="h-3 w-3" />
                              {l.status === "eslesdi" ? "Bağlandı" : l.status === "eslesmedi" ? "Tapılmadı" : "Xəta"}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs">{l.kod}</td>
                          <td className="px-3 py-1.5 text-right text-xs tabular-nums">{l.mebleg.toFixed(2)} ₼</td>
                          <td className="px-3 py-1.5 text-xs">
                            {l.sifaris_id ? (
                              <a
                                href={`/ticaret/satis-yeni?edit=${l.sifaris_id}`}
                                className="font-mono text-primary hover:underline"
                              >
                                {l.sifaris_nomre}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{l.mesaj}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "primary" | "emerald" | "amber" | "rose";
}) {
  const cls =
    tone === "primary"
      ? "text-primary"
      : tone === "emerald"
      ? "text-emerald-500"
      : tone === "amber"
      ? "text-amber-500"
      : tone === "rose"
      ? "text-rose-500"
      : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
