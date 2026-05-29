"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

/**
 * UI testi — istifadəçi key-i yapışdırır, "Test et" basır, endpoint çağırılır,
 * cavab JSON-da göstərilir. Real platforma simulyasiyası.
 */
export function KanalApiTestButton({ kanal }: { kanal: string }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: number; data: unknown; ms: number } | null>(null);

  async function runTest() {
    if (!key.trim()) {
      toast.error("API key daxil edin");
      return;
    }
    setLoading(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const url = `/api/v1/marketplace/products?kanal=${encodeURIComponent(kanal)}&key=${encodeURIComponent(key.trim())}&limit=5`;
      const res = await fetch(url, { cache: "no-store" });
      const ms = Math.round(performance.now() - t0);
      const ct = res.headers.get("content-type") ?? "";
      const data = ct.includes("json") ? await res.json() : await res.text();
      setResult({ status: res.status, data, ms });
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      setResult({ status: 0, data: { error: String(e) }, ms });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setKey("");
    setResult(null);
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          reset();
        }}
        title="API key-i sınamaq"
      >
        <Play className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              API key sınağı — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="test-key" className="text-xs">API key</Label>
              <div className="flex gap-1">
                <Input
                  id="test-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Bayaq yaradılmış key-i yapışdırın"
                  className="font-mono text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runTest();
                  }}
                />
                <Button onClick={runTest} disabled={loading || !key.trim()} size="sm">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Test et
                </Button>
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Endpoint <code>limit=5</code> ilə çağırılacaq. Real platforma üçün limit
                500-ə qədər ola bilər.
              </p>
            </div>

            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {result.status >= 200 && result.status < 300 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  )}
                  <span className="text-xs font-semibold">
                    HTTP {result.status}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">· {result.ms}ms</span>
                  {result.status === 200 && typeof result.data === "object" && result.data !== null && "count" in result.data && (
                    <span className="text-[10.5px] text-emerald-600">
                      · {(result.data as { count: number }).count} məhsul qaytarıldı
                    </span>
                  )}
                </div>
                <pre className="max-h-96 overflow-auto rounded-md border border-border/60 bg-secondary/40 p-3 text-[10.5px] leading-relaxed">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Bağla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
