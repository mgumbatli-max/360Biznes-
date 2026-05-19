"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { analyzeImport, executeImport, cancelImport } from "../import-actions";

type PreviewRow = {
  sira: number;
  emeliyyat: "yarat" | "yenile" | "xeta";
  ad: string;
  kod?: string;
  say?: number;
  satis_qiymeti?: number;
  error?: string;
};

type AnalysisResult = {
  partiya_id: string;
  cemi: number;
  yeni: number;
  yenilenecek: number;
  duplicate: number;
  xeta: number;
  preview: PreviewRow[];
};

type ExecuteResult = {
  partiya_id: string;
  yaradildi: number;
  yenilendi: number;
  xeta: number;
};

export function ImportWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [analyzing, startAnalyzing] = useTransition();
  const [executing, startExecuting] = useTransition();

  function pickFile(f: File | null) {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast.error("Yalnız .xlsx faylı qəbul edilir");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Fayl 10 MB-dan kiçik olmalıdır");
      return;
    }
    setFile(f);
    setAnalysis(null);
    setResult(null);
  }

  function reset() {
    setFile(null);
    setAnalysis(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function analyze() {
    if (!file) return;
    startAnalyzing(async () => {
      const fd = new FormData();
      fd.append("fayl", file);
      const res = await analyzeImport(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAnalysis(res.data);
      toast.success(`${res.data.cemi} sətir analiz olundu`);
    });
  }

  function execute() {
    if (!analysis) return;
    startExecuting(async () => {
      const res = await executeImport(analysis.partiya_id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      toast.success("Yükləmə tamamlandı");
      router.refresh();
    });
  }

  async function cancel() {
    if (!analysis) return;
    startExecuting(async () => {
      await cancelImport(analysis.partiya_id);
      reset();
      toast.success("Partiya silindi");
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Step 1: Template */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            1
          </span>
          <h3 className="text-base font-semibold">Şablonu endir</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Standart Excel şablonunu yükləyib məhsullarınızı doldurun. Mövcud
          məhsullar (kod və ya barkod uyğunluğu ilə) yenilənəcək, yenilər
          əlavə olunacaq.
        </p>
        <a href="/api/anbar/mehsul-import/sablon" download>
          <Button variant="outline" className="w-full">
            <Download className="h-4 w-4" /> Excel şablonunu endir (.xlsx)
          </Button>
        </a>

        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-2">Sütun</th>
              <th className="pb-2">Tələb</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Məhsulun adı", true],
              ["Say (stok)", true],
              ["Satış qiyməti", true],
              ["Kod / Barkod", false],
              ["Kateqoriya / Marka", false],
              ["Alış qiyməti", false],
              ["Min satış / Topdan qiymət", false],
              ["Kritik stok", false],
              ["Məhsul haqqında", false],
            ].map(([label, req]) => (
              <tr key={label as string} className="border-b border-border/20">
                <td className="py-1.5 pr-2">{label}</td>
                <td className="py-1.5">
                  {req ? (
                    <Badge variant="destructive" className="text-[9px]">
                      MƏCBURİ
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px]">
                      könüllü
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Step 2: Upload */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            2
          </span>
          <h3 className="text-base font-semibold">Doldurulmuş faylı yüklə</h3>
        </div>

        <label
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-secondary/30 p-8 text-center transition ${
            dragging ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
          <div className="text-sm font-medium">
            {file ? file.name : "Excel faylını bura sürüşdürün"}
          </div>
          <div className="text-xs text-muted-foreground">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB`
              : "və ya kliklə seçin (.xlsx, max 10 MB)"}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {file && !analysis && (
          <Button
            onClick={analyze}
            disabled={analyzing}
            className="mt-3 w-full font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            {analyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4" /> Analiz et
          </Button>
        )}

        {file && (analysis || result) && (
          <Button onClick={reset} variant="ghost" className="mt-3 w-full">
            <RotateCcw className="h-4 w-4" /> Yenidən başla
          </Button>
        )}
      </div>

      {/* Analysis preview */}
      {analysis && !result && (
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                3
              </span>
              <h3 className="text-base font-semibold">Preview və təsdiq</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={cancel} variant="ghost" size="sm" disabled={executing}>
                Ləğv et
              </Button>
              <Button
                onClick={execute}
                disabled={executing || analysis.cemi === 0}
                className="font-semibold text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                {executing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-4 w-4" /> Stoka yüklə (
                {analysis.yeni + analysis.yenilenecek} sətir)
              </Button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatBox label="Cəmi" value={analysis.cemi} />
            <StatBox label="Yeni" value={analysis.yeni} tone="success" />
            <StatBox label="Yeniləmə" value={analysis.yenilenecek} tone="info" />
            <StatBox label="Duplicate" value={analysis.duplicate} tone="warning" />
            <StatBox label="Xəta" value={analysis.xeta} tone="danger" />
          </div>

          {analysis.xeta > 0 && (
            <Alert className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {analysis.xeta} sətirdə xəta var, onlar atlanacaq.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border border-border/60">
            <div className="border-b border-border/40 px-3 py-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              İlk {analysis.preview.length} sətir
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/30 bg-secondary/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Sıra</th>
                    <th className="px-3 py-2">Əməliyyat</th>
                    <th className="px-3 py-2">Məhsul</th>
                    <th className="px-3 py-2">Kod</th>
                    <th className="px-3 py-2 text-right">Say</th>
                    <th className="px-3 py-2 text-right">Qiymət</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.preview.map((p) => (
                    <tr key={p.sira} className="border-b border-border/20">
                      <td className="px-3 py-1.5 font-mono text-xs">{p.sira}</td>
                      <td className="px-3 py-1.5">
                        {p.emeliyyat === "yarat" && (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[9px]">
                            YENİ
                          </Badge>
                        )}
                        {p.emeliyyat === "yenile" && (
                          <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-[9px]">
                            YENİLƏ
                          </Badge>
                        )}
                        {p.emeliyyat === "xeta" && (
                          <Badge variant="destructive" className="text-[9px]">
                            XƏTA
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {p.ad || <span className="italic text-muted-foreground">(adsız)</span>}
                        {p.error && (
                          <div className="text-[10px] text-danger">{p.error}</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                        {p.kod ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.say ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {p.satis_qiymeti != null ? p.satis_qiymeti.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Execute result */}
      {result && (
        <div className="lg:col-span-2 space-y-3">
          <Alert className="border-success/40 bg-success/5">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="space-y-2">
              <div className="font-semibold text-success">Yükləmə tamamlandı</div>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Yaradıldı" value={result.yaradildi} tone="success" />
                <StatBox label="Yeniləndi" value={result.yenilendi} tone="info" />
                <StatBox label="Xəta" value={result.xeta} tone="danger" />
              </div>
            </AlertDescription>
          </Alert>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            <strong className="font-semibold">Səhv yükləmə oldu?</strong> Yaradılan və ya yenilənən məhsulları{" "}
            <a href="/anbar/mehsullar?sirala=yeni" className="underline">Məhsullar səhifəsində</a> ən yeni sıralama ilə açın və
            ya hər sətiri manual redaktə edin. Excel import audit-i Hərəkətlər deyil, Audit log-da saxlanılır.
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "info" | "warning" | "danger";
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "info"
      ? "text-info"
      : tone === "warning"
      ? "text-warning"
      : tone === "danger"
      ? "text-danger"
      : "";
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-2 text-center">
      <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
