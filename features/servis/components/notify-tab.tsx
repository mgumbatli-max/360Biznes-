"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, MessageCircle, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { sendCustomerNotification, NOTIFICATION_TEMPLATES } from "../actions";
import { formatDate } from "@/lib/utils";

type LogEntry = {
  yaradildi: Date | null;
  channel: string;
  message: string;
};

export function NotifyTab({
  servisId,
  servisNomre,
  musteriAd,
  musteriTelefon,
  son_xeber,
  trackToken,
  loglar,
}: {
  servisId: string;
  servisNomre: string;
  musteriAd: string;
  musteriTelefon: string;
  son_xeber: Date | null;
  trackToken: string;
  loglar: LogEntry[];
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<"sms" | "email" | "whatsapp">("sms");
  const [template, setTemplate] = useState<keyof typeof NOTIFICATION_TEMPLATES>("qebul");
  const [pending, startTransition] = useTransition();
  // 🔒 origin SSR-də və ilk client render-də boş → hər iki tərəf nisbi URL verir
  // (hidratasiya uyğun). Mount-dan sonra mütləq origin qoyulur. `typeof window`-u
  // birbaşa render-də oxumaq SSR(nisbi)≠client(mütləq) → React #418 yaradırdı.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  function buildMessage(): string {
    const tpl = NOTIFICATION_TEMPLATES[template].text;
    const trackUrl = `${origin}/servis-track/${trackToken}`;
    return tpl
      .replaceAll("{ad}", musteriAd)
      .replaceAll("{nomre}", servisNomre)
      .replaceAll("{link}", trackUrl);
  }

  const msg = buildMessage();

  function send() {
    startTransition(async () => {
      const res = await sendCustomerNotification(servisId, channel, msg, template);
      if (res.ok) {
        toast.success("Bildiriş göndərildi (mock)");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/40 bg-card/30 p-3 text-sm">
        <div className="text-xs text-muted-foreground">
          Son müştəri bildirişi:{" "}
          <span className="font-medium text-foreground">
            {son_xeber ? formatDate(son_xeber) : "—"}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Hədəf: <span className="font-medium text-foreground">{musteriAd}</span>
          {musteriTelefon && (
            <>
              {" · "}
              <span className="font-mono text-foreground">{musteriTelefon}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Şablon</Label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as keyof typeof NOTIFICATION_TEMPLATES)}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {(Object.keys(NOTIFICATION_TEMPLATES) as Array<keyof typeof NOTIFICATION_TEMPLATES>).map((k) => (
              <option key={k} value={k}>
                {NOTIFICATION_TEMPLATES[k].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kanal</Label>
          <div className="flex gap-1">
            <ChannelBtn icon={MessageSquare} label="SMS" active={channel === "sms"} onClick={() => setChannel("sms")} />
            <ChannelBtn icon={Mail} label="Email" active={channel === "email"} onClick={() => setChannel("email")} />
            <ChannelBtn
              icon={MessageCircle}
              label="WhatsApp"
              active={channel === "whatsapp"}
              onClick={() => setChannel("whatsapp")}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Mesaj önizləməsi</Label>
        <div className="min-h-[64px] whitespace-pre-wrap rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm">
          {msg}
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={send} disabled={pending}>
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          Göndər (mock)
        </Button>
      </div>

      {loglar.length > 0 && (
        <div>
          <Label className="text-xs">Bildiriş tarixçəsi</Label>
          <ul className="mt-1 divide-y divide-border/30 rounded-md border border-border/40">
            {loglar.map((l, i) => (
              <li key={i} className="px-3 py-2 text-xs">
                <span className="font-mono text-muted-foreground">
                  {formatDate(l.yaradildi, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>{" "}
                <span className="rounded bg-secondary/40 px-1 text-[10px] uppercase">{l.channel}</span>{" "}
                <span className="text-muted-foreground">{l.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChannelBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition ${
        active ? "border-primary/60 bg-primary/10 text-primary-light" : "border-border bg-card/40 hover:bg-secondary"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
