"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { saveTemplate } from "../actions";
import type { TemplateRow } from "../types";

type Props = { initial?: TemplateRow; trigger?: "new" | "edit" };

export function TemplateDialog({ initial, trigger = "new" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", String(initial.id));
    startTransition(async () => {
      const res = await saveTemplate(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success(initial ? "Yeniləndi" : "Yaradıldı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "new" ? (
          <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
            <Plus className="h-4 w-4" /> Yeni şablon
          </Button>
        ) : (
          <Button size="icon-sm" variant="ghost" title="Redaktə">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Şablon redaktəsi" : "Yeni şablon"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ad">Ad *</Label>
              <Input id="ad" name="ad" required maxLength={100} defaultValue={initial?.ad} autoFocus disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hadisi">Kateqoriya / Hadisə *</Label>
              <select
                id="hadisi"
                name="hadisi"
                defaultValue={initial?.hadisi ?? "manual"}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                <option value="welcome">Salamlama</option>
                <option value="follow_up">Follow-up</option>
                <option value="promosyon">Promosyon</option>
                <option value="borc_xebardarliq">Borc xəbərdarlıq</option>
                <option value="satish_yeni">Yeni satış</option>
                <option value="tesekkur">Təşəkkür</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kanal">Kanal</Label>
              <select
                id="kanal"
                name="kanal"
                defaultValue={initial?.kanal ?? "whatsapp"}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movzu">Mövzu (email üçün)</Label>
              <Input id="movzu" name="movzu" maxLength={200} defaultValue={initial?.movzu ?? ""} disabled={pending} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="matn">Mətn *</Label>
            <textarea
              id="matn"
              name="matn"
              required
              rows={6}
              defaultValue={initial?.matn ?? "Hörmətli {{musteri_ad}},\nSatışınız üçün təşəkkür edirik."}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              disabled={pending}
            />
            <p className="text-[10.5px] text-muted-foreground">
              Dəyişənlər: <code className="rounded bg-secondary px-1 py-0.5">{`{{musteri_ad}}`}</code>{" "}
              <code className="rounded bg-secondary px-1 py-0.5">{`{{meblegh}}`}</code>{" "}
              <code className="rounded bg-secondary px-1 py-0.5">{`{{satish_no}}`}</code> formatında yazın.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="aktiv"
              value="true"
              defaultChecked={initial?.aktiv ?? true}
              className="h-4 w-4 accent-primary"
              disabled={pending}
            />
            Aktivdir
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Yenilə" : "Yarat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
