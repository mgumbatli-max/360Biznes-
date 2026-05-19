"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, CalendarClock } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { addFollowup } from "../actions";

type Contact = { id: string; ad: string };

type Props = {
  contacts: Contact[];
  /** Pre-fill the kontragent id (e.g. from a detail page). If set, the dropdown is hidden. */
  defaultKontragentId?: string;
};

export function FollowupDialog({ contacts, defaultKontragentId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (defaultKontragentId) fd.set("kontragent_id", defaultKontragentId);
    startTransition(async () => {
      const res = await addFollowup(fd);
      if (!res.ok) setError(res.error);
      else {
        toast.success("Follow-up əlavə edildi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const dtLocal = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}T${String(tomorrow.getHours()).padStart(2, "0")}:${String(tomorrow.getMinutes()).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle><CalendarClock className="inline h-4 w-4" /> Yeni follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          {!defaultKontragentId && (
            <div className="space-y-1.5">
              <Label htmlFor="kontragent_id">Kontragent *</Label>
              <select
                id="kontragent_id"
                name="kontragent_id"
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                disabled={pending}
              >
                <option value="">— seçin —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.ad}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="basliq">Başlıq *</Label>
            <Input id="basliq" name="basliq" required minLength={2} maxLength={200} placeholder="məs. Zəng vur" disabled={pending} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vaxt">Tarix & saat *</Label>
              <Input id="vaxt" name="vaxt" type="datetime-local" required defaultValue={dtLocal} disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prioritet">Prioritet</Label>
              <select id="prioritet" name="prioritet" defaultValue="normal" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" disabled={pending}>
                <option value="dusuk">Düşük</option>
                <option value="normal">Normal</option>
                <option value="yuksek">Yüksək</option>
                <option value="kritik">Kritik</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kanal">Kanal</Label>
            <select id="kanal" name="kanal" defaultValue="zeng" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" disabled={pending}>
              <option value="zeng">Zəng</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="gorush">Görüş</option>
              <option value="diger">Digər</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qeyd">Qeyd</Label>
            <textarea id="qeyd" name="qeyd" rows={2} maxLength={2000} className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" disabled={pending} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
