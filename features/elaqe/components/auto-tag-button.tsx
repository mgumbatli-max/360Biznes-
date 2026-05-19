"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAutoTagUpdate } from "@/features/elaqe/auto-tag-action";

export function AutoTagButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setResult(null);
    try {
      const res = await runAutoTagUpdate();
      if (res.ok) {
        setResult(
          `${res.scanned} müştəri yoxlanıldı · ${res.added} əlavə · ${res.removed} silindi`,
        );
        startTransition(() => router.refresh());
      } else {
        setResult(res.error);
      }
    } catch (e) {
      console.error(e);
      setResult("Xəta baş verdi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={busy}>
        {busy ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        Avto-tag yenilə
      </Button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
