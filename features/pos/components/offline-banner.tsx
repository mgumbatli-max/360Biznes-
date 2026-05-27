"use client";

import { useEffect, useState, useTransition } from "react";
import { Wifi, WifiOff, CloudUpload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "../hooks/use-online-status";
import { getQueue, removeFromQueue, markAttempt, type QueuedSale } from "@/lib/pos/offline-queue";
import { createSale } from "../sale-action";

/**
 * POS offline banner — kassa səhifəsinin üstündə görsənir.
 *
 * - Internet itəndə qırmızı banner + queue sayı.
 * - Internet qayıtdıqda yaşıl banner + "Sinxronlaşdır" düyməsi.
 * - Avtomatik sinxron: online olduğu anda 5 saniyə gözləyib drain başlayır.
 *
 * Köhnə kassa flow-ı dəyişdirilmir — bu sadəcə offline-aware UI əlavəsidir.
 * Gələcəkdə createSale wrap olunub offline halda enqueue edə bilər.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [syncing, startSync] = useTransition();
  const [hasMounted, setHasMounted] = useState(false);

  // Mount-da queue oxu + hər 3 saniyədə yenilə (digər tablardan dəyişiklik üçün)
  useEffect(() => {
    setHasMounted(true);
    const refresh = () => setQueue(getQueue());
    refresh();
    const id = setInterval(refresh, 3000);
    window.addEventListener("storage", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Online qayıtdıqda 5sn gözlə → avtomatik sinxron
  useEffect(() => {
    if (!online || queue.length === 0) return;
    const id = setTimeout(() => {
      void drainQueue();
    }, 5000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, queue.length]);

  async function drainQueue() {
    if (queue.length === 0) return;
    startSync(async () => {
      let success = 0;
      let fail = 0;
      for (const item of queue) {
        try {
          // payload createSale-in input format-ındadır
          const res = await createSale(item.payload as Parameters<typeof createSale>[0]);
          if (res && (res as { ok?: boolean }).ok !== false) {
            removeFromQueue(item.id);
            success++;
          } else {
            markAttempt(item.id, (res as { error?: string })?.error ?? "Bilinməyən xəta");
            fail++;
          }
        } catch (e) {
          markAttempt(item.id, e instanceof Error ? e.message : "Şəbəkə xətası");
          fail++;
        }
      }
      setQueue(getQueue());
      if (success > 0) toast.success(`${success} satış sinxronlaşdı`);
      if (fail > 0) toast.error(`${fail} satış sinxronlaşmadı — yenidən cəhd ediləcək`);
    });
  }

  // SSR / mount-dan əvvəl heç nə render etmə (hydration mismatch qoruması)
  if (!hasMounted) return null;
  if (online && queue.length === 0) return null;

  return (
    <div
      className={`sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${
        online
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span className="font-semibold">
          {online ? "Internet bərpa olundu" : "Offline rejim"}
        </span>
        {queue.length > 0 && (
          <span className="rounded-full bg-current/10 px-2 py-0.5 font-medium">
            {queue.length} satış növbədə
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {online && queue.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={syncing}
            onClick={() => void drainQueue()}
            className="h-7 gap-1 text-xs"
          >
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />}
            Sinxronlaşdır
          </Button>
        )}
        {online && queue.length === 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Hamısı sinxron
          </span>
        )}
      </div>
    </div>
  );
}
