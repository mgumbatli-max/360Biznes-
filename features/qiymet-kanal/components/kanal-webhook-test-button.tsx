"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle2, AlertTriangle, Beaker } from "lucide-react";
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
 * UI test üçün — istifadəçi öz tərəfdə Webhook secret yaratdıqdan sonra
 * burada onu yapışdırır, "Test sifariş göndər" basır, biz HMAC imzalayıb
 * öz endpoint-imizə POST edirik. Real platforma simulyasiyası.
 */
export function KanalWebhookTestButton({ kanal }: { kanal: string }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [sku, setSku] = useState("");
  const [miqdar, setMiqdar] = useState("1");
  const [qiymet, setQiymet] = useState("10");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: number; data: unknown; ms: number } | null>(null);

  async function runTest() {
    if (!secret.trim()) {
      toast.error("Webhook secret daxil edin");
      return;
    }
    if (!sku.trim()) {
      toast.error("SKU / kod daxil edin (test üçün)");
      return;
    }
    setLoading(true);
    setResult(null);

    const externalId = `TEST-${Date.now()}`;
    const body = JSON.stringify({
      external_id: externalId,
      musteri: { ad: "Test müştəri", telefon: "+994501234567" },
      items: [
        { sku: sku.trim(), miqdar: Number(miqdar), qiymet: Number(qiymet) },
      ],
      umumi_mebleg: Number(miqdar) * Number(qiymet),
      valyuta: "AZN",
      status: "yeni",
    });

    // HMAC SHA-256 hesabla (browser-native crypto.subtle)
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret.trim()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const t0 = performance.now();
    try {
      const res = await fetch(`/api/v1/marketplace/orders/${encodeURIComponent(kanal)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": `sha256=${sigHex}`,
        },
        body,
      });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json().catch(() => ({}));
      setResult({ status: res.status, data, ms });
    } catch (e) {
      setResult({ status: 0, data: { error: String(e) }, ms: Math.round(performance.now() - t0) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          setResult(null);
        }}
        title="Webhook test sifariş göndər"
      >
        <Beaker className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Webhook test — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wh-secret" className="text-xs">Webhook secret *</Label>
              <Input
                id="wh-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Hook qur dialoq-undan kopyalayın"
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="wh-sku" className="text-xs">SKU *</Label>
                <Input
                  id="wh-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="ABC123"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-miqdar" className="text-xs">Miqdar</Label>
                <Input
                  id="wh-miqdar"
                  type="number"
                  value={miqdar}
                  onChange={(e) => setMiqdar(e.target.value)}
                  min={1}
                  step={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-qiymet" className="text-xs">Qiymət</Label>
                <Input
                  id="wh-qiymet"
                  type="number"
                  value={qiymet}
                  onChange={(e) => setQiymet(e.target.value)}
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            <p className="text-[10.5px] text-muted-foreground">
              Test fake müştəri ilə real sifariş göndərir → real stok azaldılır.
              External ID hər test üçün unikaldır (TEST-timestamp).
            </p>

            <Button onClick={runTest} disabled={loading || !secret.trim() || !sku.trim()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Test sifariş göndər
            </Button>

            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {result.status >= 200 && result.status < 300 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  )}
                  <span className="text-xs font-semibold">HTTP {result.status}</span>
                  <span className="text-[10.5px] text-muted-foreground">· {result.ms}ms</span>
                </div>
                <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-secondary/40 p-3 text-[10.5px] leading-relaxed">
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
