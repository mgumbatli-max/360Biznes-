"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, MessageSquare, Mail, Phone, Send, Camera, Hash, Eye, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveTemplate, deleteTemplate } from "@/features/crm/sablon-actions";
import { cn } from "@/lib/utils";

export type MessageTemplate = {
  id: number;
  ad: string;
  hadisi: string;
  kanal: string | null;
  movzu: string | null;
  matn: string;
  deyisenler: string[];
  aktiv: boolean | null;
  default_sablon: boolean | null;
};

// Mövcud hadisə tipləri — sənəd və ya CRM-də istifadə olunan event-lərə uyğun
const EVENTS: { value: string; label: string }[] = [
  { value: "satis_yarandi", label: "Yeni satış" },
  { value: "satis_tamamlandi", label: "Satış tamamlandı" },
  { value: "borc_xatirla", label: "Borc xatırlatması" },
  { value: "qaytarma", label: "Qaytarma" },
  { value: "servis_qebul", label: "Servis qəbulu" },
  { value: "servis_hazir", label: "Servis hazırdır" },
  { value: "zemanet_bitir", label: "Zəmanət bitir" },
  { value: "dogum_gunu", label: "Doğum günü" },
  { value: "bayram", label: "Bayram təbriki" },
  { value: "yeni_kampaniya", label: "Yeni kampaniya" },
  { value: "lead_first", label: "Lead — ilk təmas" },
  { value: "lead_followup", label: "Lead — follow-up" },
];

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "text-green-600" },
  { value: "sms", label: "SMS", icon: Phone, color: "text-sky-600" },
  { value: "email", label: "Email", icon: Mail, color: "text-violet-600" },
  { value: "telegram", label: "Telegram", icon: Send, color: "text-cyan-600" },
  { value: "instagram", label: "Instagram", icon: Camera, color: "text-pink-600" },
];

// Köməkçi placeholder-lər — istifadəçi "Daxil et" düyməsi ilə əlavə edir
const PLACEHOLDERS = [
  { key: "musteri_ad", label: "Müştəri adı" },
  { key: "mebleg", label: "Məbləğ" },
  { key: "tarix", label: "Tarix" },
  { key: "qaime_no", label: "Qaimə №" },
  { key: "borc", label: "Qalan borc" },
  { key: "magaza_ad", label: "Mağaza adı" },
  { key: "telefon", label: "Telefon" },
  { key: "endirim", label: "Endirim %" },
];

export function MessageTemplateList({ items }: { items: MessageTemplate[] }) {
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onDelete(id: number, name: string) {
    if (!confirm(`"${name}" şablonunu silmək istəyirsən?`)) return;
    startTransition(async () => {
      const r = await deleteTemplate(id);
      if (r.ok) {
        toast.success("Şablon silindi");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {items.length} şablon
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Yeni şablon
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2">Hadisə</th>
                    <th className="px-3 py-2">Kanal</th>
                    <th className="px-3 py-2">Mətn</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const ch = CHANNELS.find((c) => c.value === t.kanal);
                    const Icon = ch?.icon ?? Hash;
                    const event = EVENTS.find((e) => e.value === t.hadisi);
                    return (
                      <tr key={t.id} className="border-t border-border/30 hover:bg-secondary/20">
                        <td className="px-3 py-2 font-medium">{t.ad}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {event?.label ?? <span className="font-mono">{t.hadisi}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-flex items-center gap-1 text-xs", ch?.color)}>
                            <Icon className="h-3.5 w-3.5" /> {ch?.label ?? t.kanal}
                          </span>
                        </td>
                        <td className="max-w-md px-3 py-2 text-xs text-muted-foreground">
                          <span className="line-clamp-2">{t.matn}</span>
                        </td>
                        <td className="px-3 py-2">
                          {t.aktiv ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">aktiv</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">passiv</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(t.id, t.ad)}
                              disabled={pending}
                              className="text-rose-500 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {(editing || creating) && (
        <TemplateDialog
          template={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="glass">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold">Heç bir şablon yoxdur</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            İlk şablonunu yarat — müştəriyə yeni satış, borc xatırlatması, kampaniya kimi avtomatik mesajlar üçün.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-1 h-4 w-4" /> İlk şablonu yarat
        </Button>
      </CardContent>
    </Card>
  );
}

function TemplateDialog({
  template,
  onClose,
  onSaved,
}: {
  template: MessageTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ad, setAd] = useState(template?.ad ?? "");
  const [hadisi, setHadisi] = useState(template?.hadisi ?? EVENTS[0].value);
  const [kanal, setKanal] = useState(template?.kanal ?? "whatsapp");
  const [movzu, setMovzu] = useState(template?.movzu ?? "");
  const [matn, setMatn] = useState(template?.matn ?? "");
  const [aktiv, setAktiv] = useState(template?.aktiv !== false);
  const [pending, startTransition] = useTransition();

  // Placeholder daxil etmə (cursor yerinə əlavə et)
  function insertPlaceholder(key: string) {
    const ta = document.getElementById("matn") as HTMLTextAreaElement | null;
    const insert = `{{${key}}}`;
    if (ta) {
      const start = ta.selectionStart ?? matn.length;
      const end = ta.selectionEnd ?? matn.length;
      const next = matn.slice(0, start) + insert + matn.slice(end);
      setMatn(next);
      setTimeout(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + insert.length;
      }, 0);
    } else {
      setMatn((m) => m + insert);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ad || ad.length < 2) {
      toast.error("Ad ən az 2 simvol olmalıdır");
      return;
    }
    if (!matn || matn.length < 2) {
      toast.error("Mətn boş ola bilməz");
      return;
    }
    const fd = new FormData();
    if (template?.id) fd.append("id", String(template.id));
    fd.append("ad", ad);
    fd.append("hadisi", hadisi);
    fd.append("kanal", kanal);
    fd.append("movzu", movzu);
    fd.append("matn", matn);
    fd.append("aktiv", aktiv ? "true" : "false");
    startTransition(async () => {
      const r = await saveTemplate(fd);
      if (r.ok) {
        toast.success(template ? "Yeniləndi" : "Yaradıldı");
        onSaved();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Mətn içində istifadə olunan placeholder-ləri canlı göstər
  const usedVars = Array.from(matn.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)).map((m) => m[1]);
  const uniqueVars = Array.from(new Set(usedVars));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Şablonu redaktə et" : "Yeni mesaj şablonu"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ad" className="text-xs">Ad <span className="text-rose-500">*</span></Label>
              <Input id="ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Məs: Yeni satış WhatsApp" />
            </div>
            <div>
              <Label htmlFor="hadisi" className="text-xs">Hadisə <span className="text-rose-500">*</span></Label>
              <select
                id="hadisi"
                value={hadisi}
                onChange={(e) => setHadisi(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {EVENTS.map((ev) => (
                  <option key={ev.value} value={ev.value}>{ev.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="kanal" className="text-xs">Kanal <span className="text-rose-500">*</span></Label>
              <select
                id="kanal"
                value={kanal}
                onChange={(e) => setKanal(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} className="h-4 w-4" />
                <span>Aktiv</span>
              </label>
            </div>
          </div>

          {kanal === "email" && (
            <div>
              <Label htmlFor="movzu" className="text-xs">Mövzu (email subject)</Label>
              <Input id="movzu" value={movzu} onChange={(e) => setMovzu(e.target.value)} placeholder="Sifarişiniz qəbul edildi" />
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label htmlFor="matn" className="text-xs">Mətn <span className="text-rose-500">*</span></Label>
              <span className="text-[10px] text-muted-foreground">{matn.length} simvol</span>
            </div>
            <textarea
              id="matn"
              value={matn}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMatn(e.target.value)}
              placeholder="Salam {{musteri_ad}}, sifarişiniz #{{qaime_no}} hazırdır. Məbləğ: {{mebleg}} ₼"
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="mt-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Placeholder daxil et
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => insertPlaceholder(p.key)}
                    className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[11px] font-mono transition hover:bg-secondary"
                    title={p.label}
                  >
                    {`{{${p.key}}}`}
                  </button>
                ))}
              </div>
            </div>
            {uniqueVars.length > 0 && (
              <div className="mt-2 rounded-md border border-sky-500/20 bg-sky-500/5 px-3 py-2">
                <div className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-sky-600">
                  <Eye className="h-3 w-3" /> İstifadə olunur ({uniqueVars.length})
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {uniqueVars.map((v) => (
                    <Badge key={v} variant="outline" className="border-sky-500/30 text-[10px] text-sky-600 font-mono">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Ləğv et
            </Button>
            <Button type="submit" disabled={pending}>
              <Save className="mr-1 h-4 w-4" />
              {pending ? "Saxlanılır..." : "Saxla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
