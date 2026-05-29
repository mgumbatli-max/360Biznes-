"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send as SendIcon,
  Loader2,
  Calendar,
  Save,
  Image as ImageIcon,
  Camera,
  Globe2,
  Music2,
  MessageCircle,
  Briefcase,
  AtSign,
  Package,
  Wand2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createPost } from "../social-actions";
import type { SocialAccount, SocialChannel } from "../social-types";

const CHANNEL_ICONS: Record<SocialChannel, React.ComponentType<{ className?: string }>> = {
  instagram: Camera,
  facebook: Globe2,
  tiktok: Music2,
  telegram: SendIcon,
  whatsapp: MessageCircle,
  linkedin: Briefcase,
  x: AtSign,
};

type Product = { id: string; ad: string; sekil_url: string | null };
type Tone = "professional" | "friendly" | "playful" | "urgent";

const TONES: Array<{ id: Tone; label: string; emoji: string }> = [
  { id: "professional", label: "Rəsmi",   emoji: "💼" },
  { id: "friendly",     label: "Səmimi",  emoji: "😊" },
  { id: "playful",      label: "Əyləncəli", emoji: "🎉" },
  { id: "urgent",       label: "FOMO/Təcili", emoji: "🔥" },
];

export function PostComposer({
  accounts,
  products,
  prefillHesabId,
}: {
  accounts: SocialAccount[];
  products: Product[];
  prefillHesabId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aiPending, setAiPending] = useState(false);

  const [basliq, setBasliq] = useState("");
  const [metn, setMetn] = useState("");
  const [sekilUrl, setSekilUrl] = useState("");
  const [mehsulId, setMehsulId] = useState("");
  const [movzu, setMovzu] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [planTime, setPlanTime] = useState("");
  const [selectedAccs, setSelectedAccs] = useState<Set<string>>(
    new Set(prefillHesabId ? [prefillHesabId] : []),
  );

  function toggleAcc(id: string) {
    setSelectedAccs((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generateAI() {
    if (!mehsulId && !movzu.trim()) {
      toast.error("Məhsul və ya mövzu daxil edin");
      return;
    }
    if (selectedAccs.size === 0) {
      toast.error("Ən azı 1 platforma seçin");
      return;
    }
    setAiPending(true);
    try {
      const platforms = accounts
        .filter((a) => selectedAccs.has(a.id))
        .map((a) => a.kanal);
      const r = await fetch("/api/marketplace/ai-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mehsul_id: mehsulId || undefined,
          movzu: movzu.trim() || undefined,
          tone,
          platforms,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Xəta");
      const j = await r.json();
      setMetn(j.text);
      // Başlıq boş olsa, ilk cümləni başlıq kimi qoy
      if (!basliq.trim()) {
        const firstLine = String(j.text).split(/[.\n!?]/)[0].slice(0, 100).trim();
        if (firstLine) setBasliq(firstLine);
      }
      if (j.is_mock) {
        toast.info("AI mock-mode-da işlədi (OPENAI_API_KEY / ANTHROPIC_API_KEY yoxdur)");
      } else {
        toast.success("AI mətn hazırdır");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI alınmadı");
    } finally {
      setAiPending(false);
    }
  }

  function submit(saveAs: "qaralama" | "planlasdirilmis" | "indi") {
    if (!basliq.trim()) return toast.error("Başlıq lazımdır");
    if (!metn.trim()) return toast.error("Mətn lazımdır");
    if (selectedAccs.size === 0) return toast.error("Ən azı 1 hesab seçin");
    if (saveAs === "planlasdirilmis" && !planTime) {
      return toast.error("Planlaşdırma tarixi lazımdır");
    }

    const fd = new FormData();
    fd.set("basliq", basliq);
    fd.set("metn", metn);
    if (sekilUrl) fd.set("sekil_url", sekilUrl);
    if (mehsulId) fd.set("mehsul_id", mehsulId);
    if (saveAs === "planlasdirilmis" && planTime) {
      fd.set("planlasdirilan", new Date(planTime).toISOString());
    }
    fd.set("hesab_ids", Array.from(selectedAccs).join(","));

    startTransition(async () => {
      const r = await createPost(fd, saveAs);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(
          saveAs === "indi" ? "Dərc edildi" : saveAs === "planlasdirilmis" ? "Planlaşdırıldı" : "Qaralama saxlanıldı",
        );
        setBasliq(""); setMetn(""); setSekilUrl(""); setMehsulId(""); setMovzu("");
        setPlanTime(""); setSelectedAccs(new Set());
        router.refresh();
      }
    });
  }

  const activeAccs = accounts.filter((a) => a.aktiv);

  return (
    <Card className="glass">
      <CardContent className="space-y-4 p-5">
        {/* Hesab seçimi */}
        <div>
          <Label className="mb-1.5 block">Hansı platformalara göndərilsin? *</Label>
          {activeAccs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-center text-xs text-muted-foreground">
              Aktiv sosial hesab yoxdur. <a href="/marketplace/sosial" className="text-primary hover:underline">Sosial hesab qoş</a>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeAccs.map((a) => {
                const Icon = CHANNEL_ICONS[a.kanal] ?? Globe2;
                const on = selectedAccs.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAcc(a.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      on ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {a.ad}
                    <span className="text-[9px] capitalize text-muted-foreground">· {a.kanal}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Generator block */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Mətn generatoru</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <Label className="text-[10.5px]" htmlFor="mehsul-sel">Məhsul (məlumatları AI-ə ver)</Label>
              <select
                id="mehsul-sel"
                value={mehsulId}
                onChange={(e) => setMehsulId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— Məhsul seçin və ya boş buraxın —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.ad}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10.5px]">Tonlama</Label>
              <div className="flex flex-wrap gap-1">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`rounded-full border px-2 py-1 text-[10.5px] transition ${
                      tone === t.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary/40"
                    }`}
                    title={t.label}
                  >
                    {t.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <Input
              value={movzu}
              onChange={(e) => setMovzu(e.target.value)}
              placeholder="Və ya azad mövzu yazın: «Yeni qış kolleksiyası» və ya «Cüməsi axşamı endirim»"
              className="h-9 text-sm"
            />
          </div>
          <Button
            type="button"
            onClick={generateAI}
            disabled={aiPending || (!mehsulId && !movzu.trim())}
            className="mt-2 w-full font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
            size="sm"
          >
            {aiPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            AI ilə mətn yarat
          </Button>
        </div>

        {/* Başlıq + Mətn */}
        <div className="space-y-1.5">
          <Label htmlFor="post-basliq">Başlıq * <span className="text-[10.5px] text-muted-foreground">({basliq.length}/100)</span></Label>
          <Input
            id="post-basliq"
            value={basliq}
            onChange={(e) => setBasliq(e.target.value.slice(0, 200))}
            maxLength={200}
            placeholder="Postun qısa başlığı"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-metn">Mətn * <span className="text-[10.5px] text-muted-foreground">({metn.length}/2000)</span></Label>
          <textarea
            id="post-metn"
            value={metn}
            onChange={(e) => setMetn(e.target.value.slice(0, 2000))}
            rows={8}
            maxLength={2000}
            placeholder="Sosial media mətni — emoji, hashtag və call-to-action ilə"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Şəkil */}
        <div className="space-y-1.5">
          <Label htmlFor="post-sekil">
            <ImageIcon className="mr-1 inline h-3.5 w-3.5" />
            Şəkil URL (opsional)
          </Label>
          <Input
            id="post-sekil"
            type="url"
            value={sekilUrl}
            onChange={(e) => setSekilUrl(e.target.value)}
            placeholder="https://... və ya AI ilə yarat: /api/anbar/ai/generate-image"
          />
          {sekilUrl && (
            <div className="mt-2 inline-block overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" decoding="async" src={sekilUrl} alt="Önbax" className="max-h-40 w-auto" />
            </div>
          )}
        </div>

        {/* Planlaşdırma */}
        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <Label htmlFor="post-plan" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Planlaşdırma (gələcəkdə dərc et)
          </Label>
          <Input
            id="post-plan"
            type="datetime-local"
            value={planTime}
            onChange={(e) => setPlanTime(e.target.value)}
            className="mt-1.5"
          />
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Vaxt qoyulsa — Planlaşdırma düyməsi ilə saxlayın. Vaxtı gələndə avto-dərc olunacaq.
          </p>
        </div>

        {/* Aksiyalar */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => submit("qaralama")}
            disabled={pending}
          >
            <Save className="h-3.5 w-3.5" /> Qaralama saxla
          </Button>
          {planTime && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => submit("planlasdirilmis")}
              disabled={pending}
            >
              <Calendar className="h-3.5 w-3.5" /> Planlaşdır
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => submit("indi")}
            disabled={pending || activeAccs.length === 0}
            className="font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendIcon className="h-3.5 w-3.5" />}
            İndi dərc et
          </Button>
        </div>

        {mehsulId && (
          <div className="flex items-center gap-2 rounded-md bg-primary/5 px-2 py-1.5 text-[11px] text-primary">
            <Package className="h-3 w-3" />
            Bu post «{products.find((p) => p.id === mehsulId)?.ad}» məhsulu ilə bağlanıb.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
