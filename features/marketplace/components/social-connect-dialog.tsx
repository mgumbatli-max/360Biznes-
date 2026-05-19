"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Camera, Globe2, Music2, MessageCircle, Send as SendIcon, Briefcase, AtSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { connectSocialAccount } from "../social-actions";
import { SOCIAL_CHANNELS, type SocialChannel } from "../social-types";

const CHANNEL_ICONS: Record<SocialChannel, React.ComponentType<{ className?: string }>> = {
  instagram: Camera,
  facebook:  Globe2,
  tiktok:    Music2,
  telegram:  SendIcon,
  whatsapp:  MessageCircle,
  linkedin:  Briefcase,
  x:         AtSign,
};

const CHANNEL_HELP: Record<SocialChannel, string> = {
  instagram: "Instagram Graph API → 'Send URL' = öz relay endpoint-iniz",
  facebook:  "Facebook Pages API → Page access token",
  tiktok:    "TikTok Content Posting API",
  telegram:  "Telegram Bot API — webhook_url = https://api.telegram.org/bot<TOKEN>/sendMessage",
  whatsapp:  "WhatsApp Business API → endpoint URL",
  linkedin:  "LinkedIn Marketing API",
  x:         "X (Twitter) v2 API",
};

export function SocialConnectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<SocialChannel>("instagram");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("kanal", channel);
    startTransition(async () => {
      const r = await connectSocialAccount(fd);
      if (!r.ok) setError(r.error);
      else {
        toast.success("Hesab qoşuldu");
        setOpen(false);
        router.refresh();
      }
    });
  }

  const Icon = CHANNEL_ICONS[channel];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Sosial hesab qoş
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" /> Sosial hesab qoş
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div>
            <Label className="mb-1.5 block">Platforma *</Label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {SOCIAL_CHANNELS.map((c) => {
                const ChIcon = CHANNEL_ICONS[c.id];
                const on = channel === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10.5px] font-medium transition ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 hover:bg-secondary/40"
                    }`}
                  >
                    <ChIcon className={`h-4 w-4 ${on ? "text-primary" : "text-muted-foreground"}`} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">{CHANNEL_HELP[channel]}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sa-ad">Hesab adı *</Label>
            <Input id="sa-ad" name="ad" required minLength={2} maxLength={100} placeholder="Məsələn: «360biznes Official»" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sa-hesab-id">Hesab handle / ID</Label>
            <Input id="sa-hesab-id" name="hesab_id" maxLength={200} placeholder="@username və ya page ID" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sa-send-url">Göndərmə URL-i (Send URL)</Label>
            <Input id="sa-send-url" name="send_url" type="url" placeholder="https://api.example.com/post" />
            <p className="text-[10.5px] text-muted-foreground">
              Post məzmunu bu URL-ə POST göndərilir. Universal webhook-relay rejimi.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sa-token">API Token (Bearer)</Label>
            <Input id="sa-token" name="api_token" type="password" maxLength={2000} placeholder="İstək başlığında «Authorization: Bearer ...»" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sa-webhook">Gələn webhook URL (qəbul)</Label>
            <Input id="sa-webhook" name="webhook_url" type="url" placeholder="Sosial platformadan bizə gələn mesajlar üçün" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Qoş
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
