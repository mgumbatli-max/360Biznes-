"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, ExternalLink, ArrowLeft, ChevronRight, Check } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createWebhook } from "../actions";
import { WEBHOOK_PRESETS, WEBHOOK_EVENTS, type WebhookPreset } from "../catalog";

type Step = "preset" | "config";

export function WebhookDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("preset");
  const [preset, setPreset] = useState<WebhookPreset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const reset = () => {
    setStep("preset");
    setPreset(null);
    setSelectedEvents([]);
    setError(null);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const choose = (p: WebhookPreset) => {
    setPreset(p);
    setSelectedEvents(p.recommended_events);
    setStep("config");
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("events", selectedEvents.join(","));
    startTransition(async () => {
      const res = await createWebhook(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Webhook yaradıldı — Test düyməsi ilə yoxlayın");
        close();
        router.refresh();
      }
    });
  }

  const toggleEvent = (kod: string) => {
    setSelectedEvents((prev) =>
      prev.includes(kod) ? prev.filter((e) => e !== kod) : [...prev, kod]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTimeout(reset, 300); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "config" && (
              <button type="button" onClick={() => setStep("preset")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {step === "preset" ? "Xidmət seç" : `${preset?.ad ?? "Webhook"} konfiqurasiyası`}
          </DialogTitle>
        </DialogHeader>

        {step === "preset" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Hadisələri haraya göndərmək istəyirsiniz? Aşağıdakı xidmətlərdən birini seçin və ya öz serverinizi göstərin.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WEBHOOK_PRESETS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p)}
                    className="group flex items-start gap-3 rounded-lg border border-border bg-card/40 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br shadow", p.color)}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-bold">
                        {p.ad}
                        <ChevronRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{p.desc}</p>
                      {p.recommended_events.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.recommended_events.slice(0, 3).map((e) => (
                            <Badge key={e} variant="outline" className="text-[9px] font-mono">{e}</Badge>
                          ))}
                          {p.recommended_events.length > 3 && (
                            <Badge variant="outline" className="text-[9px]">+{p.recommended_events.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "config" && preset && (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {/* Preset banner */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2">
                <preset.icon className="h-4 w-4 text-foreground" />
                <span className="text-sm font-bold">{preset.ad}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{preset.url_help}</p>
              {preset.setup_url && (
                <Link
                  href={preset.setup_url}
                  target="_blank"
                  rel="noopener"
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  Quraşdırma təlimatı
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad">Ad *</Label>
              <Input
                id="ad"
                name="ad"
                required
                minLength={2}
                maxLength={150}
                defaultValue={`${preset.ad} bildirişləri`}
                autoFocus
                disabled={pending}
              />
              <p className="text-[10.5px] text-muted-foreground">
                İdarə üçün ad — istifadəçinin tanıyacağı etiket
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                name="url"
                type="url"
                required
                placeholder={preset.url_placeholder}
                disabled={pending}
                className="font-mono text-xs"
              />
              <p className="text-[10.5px] text-muted-foreground">
                Hadisələrin POST olunacağı endpoint
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hadisələr ({selectedEvents.length} seçilib)</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-background p-2">
                {WEBHOOK_EVENTS.map((e) => {
                  const Icon = e.icon;
                  const active = selectedEvents.includes(e.kod);
                  return (
                    <label
                      key={e.kod}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-secondary/40",
                        active && "bg-primary/5"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleEvent(e.kod)}
                        className="mt-1 h-3 w-3"
                        disabled={pending}
                      />
                      <Icon className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-[10.5px] text-foreground">{e.kod}</code>
                          <Badge variant="outline" className="text-[9px]">{e.modul}</Badge>
                          {active && <Check className="h-3 w-3 text-emerald-500" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{e.tesvir}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Boş buraxsanız bütün hadisələr göndəriləcək.
                <strong> Tövsiyə</strong>: yalnız lazım olanları seçin — şəbəkə yükü azalır.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>İmtina</Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yarat
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
