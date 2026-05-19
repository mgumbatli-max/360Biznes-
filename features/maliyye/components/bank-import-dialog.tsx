"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { importBankStatement } from "../actions";

type ParsedRow = { tarix: string; tesvir: string; meblegh: string };

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitter = (s: string) => s.split(/[,;\t]/).map((x) => x.trim());
  const headers = splitter(lines[0]);
  const rows: ParsedRow[] = lines.slice(1, 21).map((line) => {
    const parts = splitter(line);
    return {
      tarix: parts[0] ?? "",
      tesvir: parts.slice(1, -1).join(" ").slice(0, 80) || (parts[1] ?? ""),
      meblegh: parts[parts.length - 1] ?? "",
    };
  });
  return { headers, rows };
}

export function BankImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [totalLines, setTotalLines] = useState(0);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    const parsed = parseCsv(text);
    setPreview(parsed.rows);
    setTotalLines(text.split("\n").filter((l) => l.trim().length > 0).length - 1);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("fayl_adi", fileName || "manual.csv");
    fd.set("satir_sayi", String(Math.max(0, totalLines)));
    startTransition(async () => {
      const res = await importBankStatement(fd);
      if (res.ok) {
        toast.success("Bank çıxarışı idxal edildi");
        setOpen(false);
        setPreview([]);
        setFileName("");
        router.refresh();
      } else {
        toast.error(res.error || "Xəta baş verdi");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
          data-bank-import-trigger="1"
        >
          <Upload className="h-4 w-4" /> CSV import et
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bank çıxarışını idxal et</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_adi">Bank *</Label>
              <Input id="bank_adi" name="bank_adi" required minLength={1} maxLength={100} placeholder="Kapital Bank" disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hesab_nomresi">Hesab nömrəsi</Label>
              <Input id="hesab_nomresi" name="hesab_nomresi" maxLength={50} placeholder="AZ12NABZ..." disabled={pending} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv_file">CSV faylı</Label>
            <Input id="csv_file" type="file" accept=".csv,text/csv" onChange={onFileChange} disabled={pending} />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                <FileSpreadsheet className="inline h-3 w-3" /> {fileName} — {totalLines} sətr
              </p>
            )}
          </div>

          {preview.length > 0 && (
            <div className="rounded-lg border border-border bg-card/40">
              <div className="border-b border-border/40 px-3 py-2 text-xs font-semibold">Önizləmə (ilk 20 sətr)</div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card/80 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5">Tarix</th>
                      <th className="px-2 py-1.5">Təsvir</th>
                      <th className="px-2 py-1.5 text-right">Məbləğ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="px-2 py-1.5">{r.tarix}</td>
                        <td className="px-2 py-1.5 truncate max-w-[300px]">{r.tesvir}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.meblegh}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
            CSV sətirləri qeyd kimi yaddaşda saxlanılır. Avtomatik eşləşmə tezliklə əlavə olunacaq.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending || !fileName}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              İdxal et
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
