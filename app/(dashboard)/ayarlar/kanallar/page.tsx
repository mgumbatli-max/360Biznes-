import type { Metadata } from "next";
import { Network, Info, Code2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getKanalKomissiyaList } from "@/features/qiymet-kanal/queries";
import { listKanalApiKeyStatus } from "@/features/qiymet-kanal/api-key-actions";
import { getAllKanalStats } from "@/features/qiymet-kanal/api-stats";
import { getAllKanalExtra } from "@/features/qiymet-kanal/kanal-extra";
import { listWebhookSecretStatus } from "@/features/qiymet-kanal/webhook-actions";
import { getAllOutboundStats } from "@/features/qiymet-kanal/outbound-stats";
import { getAllRetryQueues } from "@/features/qiymet-kanal/outbound-retry";
import { KanalListTable } from "@/features/qiymet-kanal/components/kanal-list-table";
import { KanalFormDialog } from "@/features/qiymet-kanal/components/kanal-form-dialog";

export const metadata: Metadata = { title: "Satış kanalları" };

export default async function KanallarPage() {
  const [kanallar, apiKeyStatus, stats, extras, webhookStatus, outboundStats, retryQueues] =
    await Promise.all([
      getKanalKomissiyaList(),
      listKanalApiKeyStatus(),
      getAllKanalStats(),
      getAllKanalExtra(),
      listWebhookSecretStatus(),
      getAllOutboundStats(),
      getAllRetryQueues(),
    ]);
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Network className="h-5 w-5 text-primary-light" />
            Satış kanalları
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mağaza, Wolt, Birmarket, Tap.az və digər platformalar — hər birinin komissiya
            faizini və əlavə xərclərini buradan idarə edin. Məhsul detal səhifəsində hər
            kanal üçün ayrı qiymət strategiyası seçirsiniz.
          </p>
        </div>
        <KanalFormDialog />
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Necə işləyir?</AlertTitle>
        <AlertDescription className="space-y-1 text-xs">
          <p>Hər məhsulun "kanal qiymət strategiyası" 4 metoddan biri ola bilər:</p>
          <ul className="list-disc pl-4 leading-relaxed">
            <li>
              <strong>Baza qiymət</strong> — mağaza qiyməti ilə eyni (default)
            </li>
            <li>
              <strong>+ Komissiya</strong> — baza qiymət üzərinə komissiya markup (sadə, amma ziyan riski var)
            </li>
            <li>
              <strong>Net qoru</strong> — qiymət avtomatik elə hesablanır ki, komissiyadan sonra net qazanc baza qədər qalsın (tövsiyə olunan)
            </li>
            <li>
              <strong>Manual</strong> — istifadəçi əl ilə fərqli qiymət təyin edir
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <KanalListTable
        items={kanallar}
        apiKeyStatus={apiKeyStatus}
        stats={stats}
        extras={extras}
        webhookStatus={webhookStatus}
        outboundStats={outboundStats}
        retryQueues={retryQueues}
      />

      <Card className="glass border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Code2 className="h-4 w-4 text-primary-light" />
            Platforma inteqrasiyası — Public REST API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            Hər kanal üçün <strong>API açar</strong> yaradın — Wolt, Birmarket, Tap.az,
            sayt adapterləri bu açarla bizdən stok və <strong>kanal-spesifik qiymət</strong>{" "}
            oxuyur. Eyni stok bütün kanallara, qiymət isə hər kanalın komissiyasına görə
            avtomatik hesablanır.
          </p>

          <div className="rounded-md border border-border/40 bg-secondary/30 p-3 font-mono">
            <div className="mb-1 text-[10.5px] font-bold uppercase text-muted-foreground">
              Endpoint
            </div>
            <code className="block text-[11px]">
              GET /api/v1/marketplace/products?kanal=<span className="text-primary-light">wolt</span>&amp;key=<span className="text-emerald-600">&lt;api_key&gt;</span>
            </code>
            <div className="mt-2 text-[10.5px] text-muted-foreground">
              CSV format üçün: <code>&amp;format=csv</code> (manual upload üçün hazır fayl yüklənir)
            </div>
          </div>

          <div className="rounded-md border border-border/40 bg-secondary/30 p-3 font-mono">
            <div className="mb-1 text-[10.5px] font-bold uppercase text-muted-foreground">
              Response (nümunə)
            </div>
            <pre className="overflow-x-auto text-[10.5px] leading-relaxed">{`{
  "kanal": "wolt",
  "count": 100,
  "total": 1500,
  "items": [
    {
      "sku": "ABC123",
      "barkod": "4811234567890",
      "ad": "AirPods Pro 2",
      "stok": 25,
      "qiymet": 136.67,
      "valyuta": "AZN",
      "sekil_url": "https://...",
      "kateqoriya": "Aksesuar",
      "marka": "Apple",
      "vahid": "ədəd",
      "aktiv": true
    }
  ]
}`}</pre>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border/40 bg-card/40 p-2.5">
              <div className="text-[10.5px] font-bold uppercase text-muted-foreground">
                Query parametrləri
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                <li><code>kanal</code> — kanal kodu (məcburi)</li>
                <li><code>key</code> — API açar (məcburi)</li>
                <li><code>limit</code> — default 500, max 5000</li>
                <li><code>offset</code> — pagination üçün</li>
                <li><code>only_active</code> — default true</li>
                <li><code>only_in_stock</code> — default false</li>
                <li><code>format</code> — <code>json</code> (default) və ya <code>csv</code></li>
              </ul>
            </div>
            <div className="rounded-md border border-border/40 bg-card/40 p-2.5">
              <div className="text-[10.5px] font-bold uppercase text-muted-foreground">
                Xüsusiyyətlər
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                <li>✓ <strong>Stok</strong> bütün kanallara eynidir (singlesource)</li>
                <li>✓ <strong>Qiymət</strong> kanal-spesifik (avto/manual)</li>
                <li>✓ CORS açıq — browser-dən də oxumaq olar</li>
                <li>✓ <code>no-store</code> cache — həmişə canlı data</li>
                <li>✓ Key rotation hər vaxt mümkün</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
