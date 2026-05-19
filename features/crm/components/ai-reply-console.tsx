"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AI_TONES, AI_LANGS } from "../types";
import { suggestAiReply } from "../ai-cavab-action";

export function AiReplyConsole() {
  const router = useRouter();
  const [sual, setSual] = useState("");
  const [uslub, setUslub] = useState("resmi");
  const [dil, setDil] = useState("az");
  const [cavab, setCavab] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sual.trim()) {
      toast.error("Sual boş ola bilməz");
      return;
    }
    const fd = new FormData();
    fd.set("sual", sual.trim());
    fd.set("uslub", uslub);
    fd.set("dil", dil);
    startTransition(async () => {
      const res = await suggestAiReply(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        setCavab(res.text);
        setModel(res.model);
        setIsMock(res.is_mock);
        router.refresh();
      }
    });
  }

  function copyCavab() {
    if (!cavab) return;
    navigator.clipboard.writeText(cavab);
    toast.success("Kopyalandı");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="uslub">Üslub</Label>
          <select
            id="uslub"
            value={uslub}
            onChange={(e) => setUslub(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            disabled={pending}
          >
            {AI_TONES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dil">Dil</Label>
          <select
            id="dil"
            value={dil}
            onChange={(e) => setDil(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            disabled={pending}
          >
            {AI_LANGS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sual">Müştəri sualı *</Label>
        <textarea
          id="sual"
          value={sual}
          onChange={(e) => setSual(e.target.value)}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Salam, məhsulun qiyməti nə qədərdir? Endirim var?"
          disabled={pending}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Cavab generasiya et
        </Button>
        {model && (
          <Badge variant="outline" className="text-[10px]">
            {isMock ? "mock" : model}
          </Badge>
        )}
      </div>

      {cavab && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider">AI cavab</Label>
            <Button type="button" size="sm" variant="ghost" onClick={copyCavab}>
              <Copy className="h-3.5 w-3.5" /> Kopya
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm">{cavab}</p>
        </div>
      )}
    </form>
  );
}
