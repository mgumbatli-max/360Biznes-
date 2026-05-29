"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Webhook,
  Loader2,
  Copy,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/lib/toast";
import {
  generateWebhookSecretForKanal,
  revokeWebhookSecret,
} from "../webhook-actions";

export function KanalWebhookButton({
  kanal,
  hasSecret,
}: {
  kanal: string;
  hasSecret: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openShow, setOpenShow] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);

  function generate() {
    const msg = hasSecret
      ? "Mövcud webhook secret əvəz olunacaq. Köhnə secret-lə gələn webhook-lar 401 alacaq. Davam edək?"
      : "Webhook secret yaradılsın?";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await generateWebhookSecretForKanal({ kanal });
      if (res.ok && res.data?.secret) {
        setPlaintext(res.data.secret);
        setOpenShow(true);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  function revoke() {
    if (!confirm("Webhook secret silinsin? Bu kanaldan webhook qəbul olunmayacaq.")) return;
    startTransition(async () => {
      const res = await revokeWebhookSecret({ kanal });
      if (res.ok) {
        toast.success("Webhook secret silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function copyText(text: string, kind: "url" | "secret") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      toast.success(kind === "url" ? "URL kopyalandı" : "Secret kopyalandı");
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/v1/marketplace/orders/${kanal}`;

  return (
    <>
      <div className="inline-flex items-center gap-1">
        {hasSecret ? (
          <>
            <Badge variant="outline" className="border-violet-500/40 text-[10px] text-violet-600">
              <Webhook className="h-3 w-3" /> Hook
            </Badge>
            <Button size="sm" variant="outline" onClick={generate} disabled={pending} title="Secret yenilə">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="outline" onClick={revoke} disabled={pending} className="text-rose-600 hover:bg-rose-50" title="Sil">
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Webhook className="h-3 w-3" />}
            Hook qur
          </Button>
        )}
      </div>

      <Dialog open={openShow} onOpenChange={setOpenShow}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4" /> Webhook qoşuldu — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Secret BİR DƏFƏ göstərilir</AlertTitle>
              <AlertDescription className="text-xs">
                Dialoq bağlandıqdan sonra secret-i artıq görə bilməyəcəksiniz. Platforma
                panelinə yapışdırın.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Webhook URL (platforma çağırır)</label>
              <div className="flex items-center gap-1">
                <code className="flex-1 truncate rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-mono">
                  POST {webhookUrl}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyText(webhookUrl, "url")}>
                  {copied === "url" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Webhook Secret (HMAC imzası üçün)</label>
              <div className="flex items-center gap-1">
                <code className="flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs font-mono">
                  {plaintext}
                </code>
                <Button size="sm" variant="outline" onClick={() => plaintext && copyText(plaintext, "secret")}>
                  {copied === "secret" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border/40 bg-secondary/30 p-3 font-mono">
              <div className="mb-1 text-[10.5px] font-bold uppercase text-muted-foreground">
                Header və body sxeması
              </div>
              <pre className="overflow-x-auto text-[10.5px] leading-relaxed">{`POST ${webhookUrl}
Content-Type: application/json
X-Signature: sha256=<HMAC_SHA256(rawBody, secret) as hex>

{
  "external_id": "WOLT-12345",
  "musteri": { "ad": "Əli Əliyev", "telefon": "+994501234567" },
  "items": [
    { "sku": "ABC", "miqdar": 2, "qiymet": 25.50 }
  ],
  "umumi_mebleg": 51.00,
  "valyuta": "AZN"
}`}</pre>
            </div>

            <p className="text-[10.5px] text-muted-foreground">
              • SKU ya barkod ilə məhsul tapılır, stok avtomatik azalır
              <br />
              • Eyni <code>external_id</code> təkrar gəlsə → 200 duplicate cavabı
              <br />
              • Stok yetməsə → 200 + warning, qismən qəbul
              <br />
              • Audit log <code>resurs_nov=webhook_order</code> sahəsində izlənir
            </p>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setOpenShow(false)}>
              Bağla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
