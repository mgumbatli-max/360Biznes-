"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cake, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runBirthdayReminders } from "@/features/elaqe/birthday-reminder-action";

export function BirthdayRemindersButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setResult(null);
    try {
      const res = await runBirthdayReminders();
      if (res.ok) {
        setResult(`${res.created} təbrik yaradıldı (${res.scanned} doğum günü, ${res.skipped} keçildi)`);
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
        {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Cake className="h-3.5 w-3.5" />}
        Doğum xatırlatmaları
      </Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}
