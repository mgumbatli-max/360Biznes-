"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Check,
  Loader2,
  RefreshCw,
  Zap,
  Package,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateProductImage } from "@/features/anbar/image-actions";

type Item = {
  id: string;
  ad: string;
  kod: string | null;
  kateqoriyalar: { ad: string } | null;
  markalar: { ad: string } | null;
};

type Generated = {
  url: string | null;
  loading: boolean;
  source: "ai" | "fast" | "manual" | null;
  saved: boolean;
};

export function BulkImageGrid({ items }: { items: Item[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, Generated>>({});
  const [bulkRunning, startBulk] = useTransition();
  const [manualUrls, setManualUrls] = useState<Record<string, string>>({});

  function buildPrompt(it: Item): string {
    const parts = [it.ad];
    if (it.markalar?.ad) parts.push(it.markalar.ad);
    if (it.kateqoriyalar?.ad) parts.push(`(${it.kateqoriyalar.ad})`);
    return parts.join(" ");
  }

  async function generateOne(it: Item, source: "ai" | "fast") {
    setState((p) => ({ ...p, [it.id]: { url: null, loading: true, source, saved: false } }));
    try {
      if (source === "ai") {
        // OpenAI DALL-E 3 — yüksək keyfiyyət, OPENAI_API_KEY tələb edir
        const r = await fetch("/api/anbar/ai/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: buildPrompt(it) }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Xəta");
        const j = await r.json();
        setState((p) => ({ ...p, [it.id]: { url: j.url, loading: false, source: "ai", saved: false } }));
      } else {
        // Pollinations.ai — pulsuz AI generasiya, key tələb etmir
        const q = encodeURIComponent(`product photo: ${buildPrompt(it)}, white background, professional, centered`);
        const url = `https://image.pollinations.ai/prompt/${q}?width=600&height=600&nologo=true`;
        setState((p) => ({ ...p, [it.id]: { url, loading: false, source: "fast", saved: false } }));
      }
    } catch (e) {
      setState((p) => ({ ...p, [it.id]: { url: null, loading: false, source: null, saved: false } }));
      toast.error(e instanceof Error ? e.message : "Yarana bilmədi");
    }
  }

  async function save(it: Item, url?: string) {
    const finalUrl = url ?? state[it.id]?.url ?? null;
    if (!finalUrl) return;
    const r = await updateProductImage(it.id, finalUrl);
    if (r.ok) {
      setState((p) => ({ ...p, [it.id]: { ...(p[it.id] ?? { url: finalUrl, loading: false, source: "manual" }), saved: true } }));
      toast.success(`"${it.ad}" — şəkil saxlandı`);
    } else {
      toast.error(r.error);
    }
  }

  function saveManual(it: Item) {
    const url = (manualUrls[it.id] ?? "").trim();
    if (!url) return toast.error("URL daxil edin");
    save(it, url);
  }

  function autoFillAll() {
    if (!window.confirm(`${items.length} məhsula AI ilə şəkil avtomatik təyin olunsun?`)) return;
    startBulk(async () => {
      let success = 0;
      for (const it of items) {
        if (state[it.id]?.saved) continue;
        const q = encodeURIComponent(`product photo: ${buildPrompt(it)}, white background, professional, centered`);
        const url = `https://image.pollinations.ai/prompt/${q}?width=600&height=600&nologo=true`;
        const r = await updateProductImage(it.id, url);
        if (r.ok) {
          setState((p) => ({ ...p, [it.id]: { url, loading: false, source: "fast", saved: true } }));
          success += 1;
        }
      }
      toast.success(`${success} məhsula şəkil təyin olundu`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Bulk toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            Bu səhifədə <strong>{items.length}</strong> məhsul üçün şəkillər təyin edilə bilər
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={autoFillAll}
          disabled={bulkRunning}
          className="font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          {bulkRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Hamısına AI ilə avto-doldur
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const s = state[it.id];
          return (
            <div
              key={it.id}
              className={`flex gap-3 rounded-xl border p-3 transition ${
                s?.saved ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"
              }`}
            >
              {/* Preview */}
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/40 bg-secondary">
                {s?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" decoding="async" src={s.url} alt={it.ad} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground/40" />
                )}
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div>
                  <div className="line-clamp-2 text-sm font-semibold leading-tight" title={it.ad}>
                    {it.ad}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">
                    {[it.kod, it.markalar?.ad, it.kateqoriyalar?.ad].filter(Boolean).join(" · ")}
                  </div>
                </div>

                {s?.saved ? (
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Saxlandı
                  </div>
                ) : s?.url ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" className="h-7 px-2 text-[10.5px]" onClick={() => save(it)}>
                      <Check className="mr-1 h-3 w-3" /> Saxla
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10.5px]"
                      onClick={() => generateOne(it, s.source === "ai" ? "ai" : "fast")}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" /> Yenilə
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => generateOne(it, "fast")}
                      disabled={s?.loading}
                      title="Pollinations.ai — pulsuz AI generasiya"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[10.5px] font-semibold hover:bg-secondary/70 disabled:opacity-50"
                    >
                      {s?.loading && s.source === "fast" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      Sürətli AI
                    </button>
                    <button
                      type="button"
                      onClick={() => generateOne(it, "ai")}
                      disabled={s?.loading}
                      title="OpenAI DALL-E 3 — yüksək keyfiyyət"
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      {s?.loading && s.source === "ai" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Premium AI
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <LinkIcon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  <Input
                    value={manualUrls[it.id] ?? ""}
                    onChange={(e) => setManualUrls((p) => ({ ...p, [it.id]: e.target.value }))}
                    placeholder="və ya URL yapışdır..."
                    className="h-6 px-1.5 text-[10.5px]"
                  />
                  <button
                    type="button"
                    onClick={() => saveManual(it)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title="URL-i təyin et"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
