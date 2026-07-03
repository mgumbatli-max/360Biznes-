"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Key, Loader2, Copy, AlertTriangle, RefreshCw, Trash2, Check } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import { generateKanalApiKey, revokeKanalApiKey } from "../api-key-actions";

export function KanalApiKeyButton({
  kanal,
  hasKey,
  created,
}: {
  kanal: string;
  hasKey: boolean;
  created?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openShow, setOpenShow] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    const action = hasKey
      ? "Mövcud API key əvəz olunacaq (köhnə key işləməyəcək). Davam edək?"
      : "Yeni API key yaradılsın?";
    if (!confirm(action)) return;
    startTransition(async () => {
      const res = await generateKanalApiKey({ kanal });
      if (res.ok && res.data?.key) {
        setPlaintext(res.data.key);
        setOpenShow(true);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  function revoke() {
    if (!confirm("API key silinsin? Bu kanalın inteqrasiyaları işləməyəcək.")) return;
    startTransition(async () => {
      const res = await revokeKanalApiKey({ kanal });
      if (res.ok) {
        toast.success("API key silindi");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function copyUrl() {
    if (!plaintext) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/v1/marketplace/products?kanal=${encodeURIComponent(kanal)}&key=${plaintext}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("URL kopyalandı");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyKeyOnly() {
    if (!plaintext) return;
    navigator.clipboard.writeText(plaintext).then(() => {
      toast.success("API key kopyalandı");
    });
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        {hasKey ? (
          <>
            <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">
              <Key className="h-3 w-3" /> Aktiv
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={generate}
              disabled={pending}
              title="Key-i yenilə (rotate)"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={revoke}
              disabled={pending}
              className="text-rose-600 hover:bg-rose-50"
              title="Sil"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
            Yarat
          </Button>
        )}
      </div>

      <Dialog open={openShow} onOpenChange={setOpenShow}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" /> API key yaradıldı — <code>{kanal}</code>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Bu key BİR DƏFƏ göstərilir</AlertTitle>
              <AlertDescription className="text-xs">
                Dialoq bağlandıqdan sonra key-i artıq görə bilməyəcəksiniz. Yadda saxlayın
                və ya hazır URL-i kopyalayıb platforma adapterinə verin.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">API Key</label>
              <div className="flex items-center gap-1">
                <code className="flex-1 truncate rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs font-mono">
                  {plaintext}
                </code>
                <Button size="sm" variant="outline" onClick={copyKeyOnly}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Hazır URL (platformaya verin)</label>
              <div className="flex items-center gap-1">
                <code className="flex-1 truncate rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-mono">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/v1/marketplace/products?kanal={kanal}&amp;key={plaintext}
                </code>
                <Button size="sm" variant="outline" onClick={copyUrl}>
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Bu URL-i Wolt / Birmarket / Tap.az / sayt-ın adapter-inə verin. GET çağırışı
                JSON qaytarır: <code>{`{ items: [{ sku, ad, stok, qiymet, ... }] }`}</code>
              </p>
            </div>

            {created && (
              <p className="text-[10.5px] text-muted-foreground">
                Köhnə key yaradılma tarixi: {formatDate(created, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} — artıq işləməyəcək
              </p>
            )}
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
