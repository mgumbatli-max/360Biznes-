"use client";

import { useState, useTransition } from "react";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  X,
  RotateCcw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ParsedRow = {
  sira: number;
  values: Record<string, string | number | null>;
  errors: string[];
};

type ParseResponse = {
  rows: ParsedRow[];
  detectedColumns: string[];
  unrecognizedColumns: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  importerAvailable: boolean;
  fileName: string;
};

type ImportResponse = {
  ok: true;
  partiyaId: string;
  cemi: number;
  yarat: number;
  yenile: number;
  xeta: number;
  log: Array<{ sira: number; emeliyyat: "yarat" | "yenile" | "xeta"; mesaj: string }>;
};

type Step = "upload" | "preview" | "importing" | "done";

export function ImportUploader({
  templateKey,
  templateTitle,
  columns,
}: {
  templateKey: string;
  templateTitle: string;
  columns: Array<{ key: string; header: string; required?: boolean }>;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [drag, setDrag] = useState(false);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setParseResult(null);
    setImportResult(null);
    setError(null);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("fayl", f);
      try {
        const res = await fetch(`/api/inteqrasiya/parse/${templateKey}`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Faylın işlənməsi alınmadı");
          return;
        }
        setParseResult(json);
        setStep("preview");
      } catch (e) {
        setError(String(e));
      }
    });
  };

  const handleImport = async () => {
    if (!file) return;
    setError(null);
    setStep("importing");

    const fd = new FormData();
    fd.append("fayl", file);
    try {
      const res = await fetch(`/api/inteqrasiya/import/${templateKey}`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "İdxal alınmadı");
        setStep("preview");
        return;
      }
      setImportResult(json);
      setStep("done");
    } catch (e) {
      setError(String(e));
      setStep("preview");
    }
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Faylı yüklə və idxal et</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Steps current={step} />

        {step === "upload" && (
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
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 text-center transition",
              drag ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:bg-secondary/50",
              pending && "cursor-wait opacity-60"
            )}
          >
            {pending ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {pending ? "Fayl oxunur..." : "Faylı bura sürüşdür"}
              </div>
              <div className="text-xs text-muted-foreground">və ya kliklə yüklə · .xlsx, .xls, .csv</div>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              disabled={pending}
            />
          </label>
        )}

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600">
            <AlertTriangle className="inline h-4 w-4" /> {error}
          </div>
        )}

        {step === "preview" && parseResult && (
          <PreviewView
            fileName={file?.name ?? "—"}
            parse={parseResult}
            columns={columns}
            onReset={reset}
            onImport={handleImport}
          />
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <div className="font-semibold">İdxal edilir...</div>
              <div className="text-xs text-muted-foreground">DB-yə yazılır, gözləyin</div>
            </div>
          </div>
        )}

        {step === "done" && importResult && (
          <DoneView result={importResult} onReset={reset} templateTitle={templateTitle} />
        )}
      </CardContent>
    </Card>
  );
}

function Steps({ current }: { current: Step }) {
  const steps = [
    { key: "upload", label: "Yüklə" },
    { key: "preview", label: "Yoxla" },
    { key: "done", label: "Bitdi" },
  ];
  const idx = steps.findIndex((s) => s.key === current) === -1 ? 1 : steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
                done
                  ? "bg-emerald-500 text-white"
                  : active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {done ? "✓" : i + 1}
            </div>
            <span className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="mx-1 h-px w-6 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function PreviewView({
  fileName,
  parse,
  columns,
  onReset,
  onImport,
}: {
  fileName: string;
  parse: ParseResponse;
  columns: Array<{ key: string; header: string; required?: boolean }>;
  onReset: () => void;
  onImport: () => void;
}) {
  const [showErrors, setShowErrors] = useState(parse.errorRows > 0);
  const visibleRows = showErrors
    ? parse.rows.filter((r) => r.errors.length > 0).slice(0, 50)
    : parse.rows.slice(0, 50);

  const detectedCols = columns.filter((c) => parse.detectedColumns.includes(c.key));
  const missingReq = columns
    .filter((c) => c.required && !parse.detectedColumns.includes(c.key))
    .map((c) => c.header);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{fileName}</span>
          <Badge variant="outline" className="text-[10px]">{parse.totalRows} sətir</Badge>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-secondary/70"
        >
          <X className="h-3 w-3" /> Faylı dəyiş
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Cəmi sətir" value={parse.totalRows} />
        <StatBox label="Düzgün" value={parse.validRows} tone="success" />
        <StatBox label="Xəta" value={parse.errorRows} tone={parse.errorRows > 0 ? "danger" : "default"} />
        <StatBox label="Tapılan sütun" value={parse.detectedColumns.length} />
      </div>

      {missingReq.length > 0 && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm">
          <AlertTriangle className="inline h-4 w-4 text-rose-500" /> <strong>Çatışmayan məcburi sütun:</strong>{" "}
          {missingReq.join(", ")}
        </div>
      )}

      {parse.unrecognizedColumns.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Tanınmayan sütunlar (idxalda istifadə olunmur): {parse.unrecognizedColumns.join(", ")}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {showErrors ? `Xətalı sətirlər (${parse.errorRows})` : "Önbaxış (ilk 50 sətir)"}
          </h4>
          {parse.errorRows > 0 && (
            <button
              type="button"
              onClick={() => setShowErrors(!showErrors)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {showErrors ? "Hamısını göstər" : "Yalnız xətaları göstər"}
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-right">#</th>
                <th className="px-2 py-2 text-left">Status</th>
                {detectedCols.slice(0, 6).map((c) => (
                  <th key={c.key} className="px-2 py-2 text-left">
                    {c.header}
                  </th>
                ))}
                <th className="px-2 py-2 text-left">Xəbərdarlıq</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const hasError = r.errors.length > 0;
                return (
                  <tr key={r.sira} className={cn("border-t border-border/30", hasError && "bg-rose-500/5")}>
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{r.sira}</td>
                    <td className="px-2 py-1.5">
                      {hasError ? (
                        <Badge variant="outline" className="text-[10px] text-rose-500 border-rose-500/40">
                          Xəta
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40">
                          OK
                        </Badge>
                      )}
                    </td>
                    {detectedCols.slice(0, 6).map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-xs">
                        {r.values[c.key] != null ? String(r.values[c.key]) : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-xs text-rose-600">{r.errors.join(", ") || "—"}</td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={detectedCols.slice(0, 6).length + 3} className="px-2 py-8 text-center text-xs text-muted-foreground">
                    Bu filtirə uyğun sətir tapılmadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {parse.rows.length > 50 && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            * Cəmi {parse.rows.length} sətirdən ilk 50-si göstərilir
          </div>
        )}
      </div>

      {!parse.importerAvailable && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="inline h-3.5 w-3.5" /> Bu şablon üçün avtomatik DB-yə yazma hələ aktiv deyil.
          Şablon və validation işləyir, idxal tezliklə əlavə olunacaq.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
        <div className="text-xs text-muted-foreground">
          {parse.errorRows > 0
            ? `${parse.validRows} sətir idxal ediləcək, ${parse.errorRows} xəta atılacaq`
            : `Bütün ${parse.totalRows} sətir idxal ediləcək`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
          >
            Ləğv et
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={parse.validRows === 0 || !parse.importerAvailable || missingReq.length > 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> İdxal et ({parse.validRows} sətir)
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneView({
  result,
  onReset,
  templateTitle,
}: {
  result: ImportResponse;
  onReset: () => void;
  templateTitle: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-emerald-500" />
        <h3 className="mt-2 text-lg font-bold text-emerald-600">İdxal tamamlandı!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          «{templateTitle}» şablonu üzrə {result.cemi} sətir işləndi
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Cəmi" value={result.cemi} />
        <StatBox label="Yaradıldı" value={result.yarat} tone="success" />
        <StatBox label="Yeniləndi" value={result.yenile} tone="primary" />
        <StatBox label="Xəta" value={result.xeta} tone={result.xeta > 0 ? "warn" : "default"} />
      </div>

      {result.log.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Log
          </h4>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border/40">
            <table className="w-full text-sm">
              <tbody>
                {result.log.slice(0, 100).map((l, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">#{l.sira}</td>
                    <td className="px-2 py-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          l.emeliyyat === "yarat" && "border-emerald-500/40 text-emerald-600",
                          l.emeliyyat === "yenile" && "border-primary/40 text-primary",
                          l.emeliyyat === "xeta" && "border-rose-500/40 text-rose-500"
                        )}
                      >
                        {l.emeliyyat}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-xs">{l.mesaj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.log.length > 100 && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              * Cəmi {result.log.length} log girişi - ilk 100 göstərilir
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
        <a
          href="/ayarlar/idxal-tarixce"
          className="text-xs font-semibold text-primary hover:underline"
        >
          → İdxal tarixçəsində bax
        </a>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Başqa fayl yüklə
        </button>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger" | "warn" | "primary";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-500"
      : tone === "danger"
      ? "text-rose-500"
      : tone === "warn"
      ? "text-amber-500"
      : tone === "primary"
      ? "text-primary"
      : "text-foreground";
  return (
    <div className="rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
