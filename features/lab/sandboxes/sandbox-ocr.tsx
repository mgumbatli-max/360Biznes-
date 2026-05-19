"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanLine, Upload, Loader2, Check } from "lucide-react";

type Parsed = { ad: string; qiymet: number; miqdar: number };

const SAMPLE_PARSED: { satici: string; tarix: string; cemi: number; satirlar: Parsed[] } = {
  satici: "ARAZ MARKET",
  tarix: "15.05.2026",
  cemi: 47.85,
  satirlar: [
    { ad: "Süd 1L 2.5%", qiymet: 3.20, miqdar: 2 },
    { ad: "Çörək toxunma", qiymet: 0.90, miqdar: 3 },
    { ad: "Yumurta 10 ad", qiymet: 4.50, miqdar: 1 },
    { ad: "Pomidor kq", qiymet: 2.80, miqdar: 1.5 },
    { ad: "Xiyar kq", qiymet: 3.40, miqdar: 1 },
    { ad: "Qatıq 500ml", qiymet: 2.20, miqdar: 2 },
    { ad: "Çay 100g", qiymet: 5.85, miqdar: 1 },
    { ad: "Şəkər kq", qiymet: 1.80, miqdar: 1 },
    { ad: "Toyuq qabaq kq", qiymet: 8.50, miqdar: 1 },
  ],
};

export function SandboxOcr() {
  const [stage, setStage] = useState<"idle" | "loading" | "done">("idle");
  const [filename, setFilename] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setStage("loading");
    setTimeout(() => setStage("done"), 1200);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4 text-primary" />
            Çek skener
          </CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/40 transition hover:border-primary/40 hover:bg-primary/5">
            {stage === "loading" ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-semibold">OCR ilə oxunur…</p>
                <p className="text-[10px] text-muted-foreground">{filename}</p>
              </>
            ) : stage === "done" ? (
              <>
                <Check className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-500">Oxundu — {SAMPLE_PARSED.satirlar.length} sətir</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-semibold">Çek şəkilini yüklə</p>
                <p className="text-[10px] text-muted-foreground">JPG, PNG, PDF</p>
              </>
            )}
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
          </label>

          {stage === "done" && (
            <button type="button" onClick={() => setStage("idle")} className="mt-2 h-8 w-full rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary">
              Yenidən yüklə
            </button>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Parsed nəticə</CardTitle>
        </CardHeader>
        <CardContent>
          {stage !== "done" ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
              Çek yüklədikdən sonra məhsullar burada görünəcək
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-md bg-secondary/30 p-2 text-xs">
                <div>
                  <div className="text-[10px] text-muted-foreground">Satıcı</div>
                  <div className="font-semibold">{SAMPLE_PARSED.satici}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Tarix</div>
                  <div className="font-semibold">{SAMPLE_PARSED.tarix}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Cəmi</div>
                  <div className="font-bold tabular-nums text-emerald-500">{SAMPLE_PARSED.cemi.toFixed(2)} ₼</div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-1.5">Məhsul</th>
                    <th className="py-1.5 text-right">Miq.</th>
                    <th className="py-1.5 text-right">Qiymət</th>
                    <th className="py-1.5 text-right">Cəm</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_PARSED.satirlar.map((s, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-1.5 text-xs font-medium">{s.ad}</td>
                      <td className="py-1.5 text-right tabular-nums text-xs">{s.miqdar}</td>
                      <td className="py-1.5 text-right tabular-nums text-xs">{s.qiymet.toFixed(2)}</td>
                      <td className="py-1.5 text-right tabular-nums text-xs font-semibold">{(s.qiymet * s.miqdar).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
