"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveBroadcast } from "../broadcast-action";
import type { TemplateRow } from "../types";

const HEDEF_OPTIONS = [
  { value: "all_musteri", label: "Bütün müştərilər" },
  { value: "topdan", label: "Topdan müştərilər" },
  { value: "vip", label: "VIP müştərilər" },
  { value: "borclu", label: "Borclu müştərilər" },
  { value: "passiv_30d", label: "Passiv (30+ gün)" },
  { value: "son_alish_30d", label: "Son 30 gündə alış edən" },
];

export function BroadcastDialog({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{ ad: string; matn: string; kanallar: string[]; hedef: string; zamanlama: string } | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [matn, setMatn] = useState("");
  const [kanallar, setKanallar] = useState<string[]>(["whatsapp"]);
  const [hedef, setHedef] = useState("all_musteri");

  function toggleKanal(k: string) {
    setKanallar((curr) => (curr.includes(k) ? curr.filter((x) => x !== k) : [...curr, k]));
  }

  function applyTemplate(id: string) {
    setSelectedTemplate(id);
    const t = templates.find((x) => String(x.id) === id);
    if (t) {
      setMatn(t.matn);
      if (t.kanal && !kanallar.includes(t.kanal)) setKanallar([t.kanal]);
    }
  }

  function onPreSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const ad = String(fd.get("ad") ?? "").trim();
    const zamanlama = String(fd.get("zamanlama") ?? "");
    if (!ad || !matn.trim() || kanallar.length === 0) {
      setError("Ad, mətn və kanal mütləqdir");
      return;
    }
    setConfirm({ ad, matn, kanallar, hedef, zamanlama });
  }

  function doSubmit(testSend: boolean) {
    if (!confirm) return;
    const fd = new FormData();
    fd.set("ad", confirm.ad);
    fd.set("matn", confirm.matn);
    fd.set("kanallar", confirm.kanallar.join(","));
    fd.set("hedef", confirm.hedef);
    fd.set("zamanlama", confirm.zamanlama);
    fd.set("test_send", String(testSend));
    startTransition(async () => {
      const res = await saveBroadcast(fd);
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success(testSend ? "Test göndərildi" : `${res.sayi ?? 0} müştəriyə göndərildi`);
        setOpen(false);
        setConfirm(null);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Yeni broadcast kampaniya</DialogTitle>
        </DialogHeader>

        {!confirm ? (
          <form onSubmit={onPreSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="space-y-2">
              <Label htmlFor="ad">Kampaniya adı *</Label>
              <Input id="ad" name="ad" required minLength={2} maxLength={150} autoFocus disabled={pending} />
            </div>

            <div className="space-y-2">
              <Label>Şablon seç</Label>
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                <option value="">— Şablonsuz —</option>
                {templates.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.ad} ({t.kanal})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="matn">Mətn *</Label>
              <textarea
                id="matn"
                value={matn}
                onChange={(e) => setMatn(e.target.value)}
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                placeholder="Salam {{musteri_ad}}, sizdə ..."
                disabled={pending}
              />
              <p className="text-[10.5px] text-muted-foreground">
                Dəyişənlər: <code>{`{{musteri_ad}}`}</code>, <code>{`{{borc}}`}</code>, <code>{`{{son_alish}}`}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Kanallar *</Label>
              <div className="flex flex-wrap gap-2">
                {["whatsapp", "sms", "email", "telegram"].map((k) => (
                  <label key={k} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2.5 py-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={kanallar.includes(k)}
                      onChange={() => toggleKanal(k)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {k}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hedef">Hədəf seqmenti *</Label>
                <select
                  id="hedef"
                  value={hedef}
                  onChange={(e) => setHedef(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  disabled={pending}
                >
                  {HEDEF_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zamanlama">Planlı göndəriş (boş — indi)</Label>
                <Input id="zamanlama" name="zamanlama" type="datetime-local" disabled={pending} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
              <Button type="submit" disabled={pending}>Növbəti</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Aşağıdakı parametrlərlə kampaniya yaradılacaq və qeydə salınacaq. Real göndəriş üçün kanal inteqrasiyası tələb olunur.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
              <div><b>Ad:</b> {confirm.ad}</div>
              <div><b>Kanallar:</b> {confirm.kanallar.map((k) => <Badge key={k} variant="outline" className="ml-1 text-[10px]">{k}</Badge>)}</div>
              <div><b>Hədəf:</b> {HEDEF_OPTIONS.find((h) => h.value === confirm.hedef)?.label}</div>
              {confirm.zamanlama && <div><b>Vaxt:</b> {confirm.zamanlama}</div>}
              <div className="mt-2 whitespace-pre-wrap rounded border border-border/40 bg-background p-2 font-mono">
                {confirm.matn}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setConfirm(null)} disabled={pending}>Geri</Button>
              <Button type="button" variant="outline" onClick={() => doSubmit(true)} disabled={pending}>
                <Send className="h-3.5 w-3.5" /> Test göndər
              </Button>
              <Button type="button" onClick={() => doSubmit(false)} disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Təsdiqlə və göndər
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
