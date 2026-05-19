"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock4, RefreshCw } from "lucide-react";
import { expireOldQuotes } from "../teklif-bron-actions";

export function TeklifExpireButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onClick() {
    if (busy) return;
    setBusy(true);
    const r = await expireOldQuotes();
    setBusy(false);
    if (!r.ok) {
      alert(r.error);
      return;
    }
    if (r.data) {
      alert(
        `${r.data.expired} təklif "vaxtı bitdi" oldu, ${r.data.releasedRows} rezerv buraxıldı.`
      );
    }
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Vaxtı bitmiş təklifləri yenilə"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
    >
      {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Clock4 className="h-3.5 w-3.5" />}
      Vaxtı bitmişləri yenilə
    </button>
  );
}
