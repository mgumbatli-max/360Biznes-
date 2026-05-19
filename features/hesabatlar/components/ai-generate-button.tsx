"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

export function AiGenerateButton() {
  const [text, setText] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/hesabatlar/ai/generate", { method: "POST", cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setText(json.text || "Cavab boş gəldi");
        setIsMock(Boolean(json.is_mock));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Xəta");
      }
    });
  }

  return (
    <div className="space-y-3" data-section="ai-generate">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        data-ai-generate-button="1"
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
        style={{ background: "var(--brand-gradient, linear-gradient(135deg,#7c3aed,#ec4899))" }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : text ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {pending ? "Yaradılır..." : text ? "Yenidən yarat" : "Hesabat yarat"}
      </button>
      {err && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {err}
        </p>
      )}
      {text && (
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">AI tövsiyə</h4>
            {isMock && <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">mock</span>}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
        </div>
      )}
    </div>
  );
}
