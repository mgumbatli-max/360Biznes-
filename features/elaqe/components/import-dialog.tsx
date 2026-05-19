"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { importContacts, type ImportRow } from "../actions";

type Mapping = Record<keyof ImportRow, string>;

const FIELDS: { key: keyof ImportRow; label: string; required?: boolean }[] = [
  { key: "ad", label: "Ad / Şirkət", required: true },
  { key: "telefon", label: "Telefon" },
  { key: "email", label: "Email" },
  { key: "voen", label: "VÖEN" },
  { key: "fin_kod", label: "FİN kod" },
  { key: "sirket_adi", label: "Şirkət adı" },
  { key: "unvan", label: "Ünvan" },
  { key: "sheher", label: "Şəhər" },
  { key: "nov", label: "Növ (musteri/techizatci)" },
];

// Auto-detect by Azerbaijani header keywords
const AUTO: Record<keyof ImportRow, RegExp[]> = {
  ad: [/^ad$/i, /ad.*soyad/i, /şirkət/i, /sirket/i, /müştəri/i, /name/i, /fullname/i],
  telefon: [/telefon/i, /phone/i, /mobil/i, /^tel$/i],
  email: [/email/i, /e-?mail/i, /e?poç?t/i],
  voen: [/voen/i, /vergi/i, /tin/i],
  fin_kod: [/fin/i, /fin.?kod/i],
  sirket_adi: [/şirkət.?ad/i, /company/i, /sirket.?ad/i],
  unvan: [/ünvan/i, /address/i, /unvan/i],
  sheher: [/şəhər/i, /city/i, /seher/i, /sheher/i],
  nov: [/növ/i, /nov/i, /tip/i, /type/i],
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  // Robust CSV: handle quoted fields
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "," || c === ";" || c === "\t") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((x) => x.trim())) rows.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field || cur.length) {
    cur.push(field);
    if (cur.some((x) => x.trim())) rows.push(cur);
  }
  return rows;
}

function autoMap(headers: string[]): Mapping {
  const m: Mapping = { ad: "", telefon: "", email: "", voen: "", fin_kod: "", sirket_adi: "", unvan: "", sheher: "", nov: "" };
  for (const f of FIELDS) {
    for (let i = 0; i < headers.length; i++) {
      const h = (headers[i] ?? "").trim();
      if (!h) continue;
      if (AUTO[f.key].some((re) => re.test(h))) {
        m[f.key] = String(i);
        break;
      }
    }
  }
  return m;
}

export function ImportContactsDialog({ defaultNov = "musteri" }: { defaultNov?: "musteri" | "techizatci" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({} as Mapping);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [fileName, setFileName] = useState<string>("");

  function reset() {
    setHeaders([]);
    setData([]);
    setMapping({} as Mapping);
    setResult(null);
    setFileName("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast.error("Fayl boşdur və ya sətr azdır");
      return;
    }
    const head = rows[0].map((h) => h.trim());
    const body = rows.slice(1);
    setHeaders(head);
    setData(body);
    setMapping(autoMap(head));
  }

  function buildRows(): ImportRow[] {
    return data.map((row) => {
      const r: ImportRow = {};
      for (const f of FIELDS) {
        const idx = Number(mapping[f.key] ?? "");
        if (!Number.isFinite(idx) || idx < 0) continue;
        const val = (row[idx] ?? "").trim();
        if (val) r[f.key] = val;
      }
      return r;
    }).filter((r) => r.ad && r.ad.length >= 2);
  }

  function onImport() {
    const rows = buildRows();
    if (rows.length === 0) {
      toast.error("Sətir yoxdur (ad boşdur?)");
      return;
    }
    startTransition(async () => {
      const res = await importContacts(rows, defaultNov);
      if (res.ok) {
        setResult({ created: res.created, skipped: res.skipped });
        toast.success(`${res.created} idxal, ${res.skipped} ötürüldü`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const previewRows = data.slice(0, 5);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-3.5 w-3.5" /> İdxal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>CSV idxal — Əlaqələr</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-dashed border-border p-3">
            <Label className="flex flex-col items-start gap-1.5 text-sm cursor-pointer">
              <span className="inline-flex items-center gap-2 font-medium">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName || "CSV faylı seçin"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv,.txt"
                onChange={onFile}
                className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
              />
              <span className="text-[10.5px] text-muted-foreground">
                Birinci sətir başlıq olmalıdır. UTF-8, vergül (,) və ya nöqtəli vergül (;) ayırıcı.
              </span>
            </Label>
          </div>

          {headers.length > 0 && (
            <>
              <div className="text-xs font-semibold text-muted-foreground">Sütun uyğunlaşdırma</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    <span className="min-w-[110px] text-muted-foreground">
                      {f.label}{f.required && <span className="text-danger"> *</span>}
                    </span>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      {headers.map((h, i) => (
                        <option key={i} value={String(i)}>{h || `Sütun ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-border bg-secondary/20 p-2">
                <div className="mb-1 text-xs font-semibold">Önizləmə (ilk 5 sətir, cəmi {data.length})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-muted-foreground">
                      <tr>
                        {FIELDS.map((f) => (
                          <th key={f.key} className="px-1.5 py-1 text-left font-normal">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="border-t border-border/40">
                          {FIELDS.map((f) => {
                            const i = Number(mapping[f.key] ?? "");
                            const v = Number.isFinite(i) && i >= 0 ? row[i] : "";
                            return (
                              <td key={f.key} className="px-1.5 py-1 align-top">
                                <span className="line-clamp-1">{v ?? ""}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {result && (
            <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>
                <Badge variant="outline" className="text-success">{result.created} yaradıldı</Badge>
                <Badge variant="outline" className="ml-1">{result.skipped} ötürüldü</Badge>
                — dublikat (telefon/email/VÖEN) və ya boş sətirlər ötürülür.
              </span>
            </div>
          )}

          {data.length > 0 && !mapping.ad && (
            <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span>Ad sütunu seçilməyib — sütunlardan ən azı birini Ad olaraq təyin edin.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Bağla
          </Button>
          <Button onClick={onImport} disabled={pending || data.length === 0 || !mapping.ad}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {data.length > 0 ? `${data.length} sətir idxal et` : "İdxal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
