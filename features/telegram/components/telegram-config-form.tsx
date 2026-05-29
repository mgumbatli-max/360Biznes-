"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, CheckCircle2, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/lib/toast";
import { saveTelegramSettings, sendTestTelegram, type TelegramSettings } from "../actions";

const EVENT_OPTIONS: Array<{ key: "webhook_order" | "stok_alert" | "low_stock" | "yeni_satis"; label: string; desc: string }> = [
  { key: "webhook_order", label: "Webhook sifarişləri", desc: "Marketplace (Wolt, Birmarket...) sifariş gəldikdə" },
  { key: "stok_alert", label: "Stok xəbərdarlığı", desc: "Minimum stok altına düşəndə (gələcək)" },
  { key: "low_stock", label: "Aşağı stok", desc: "Aşağı stok aşkar edildikdə (gələcək)" },
  { key: "yeni_satis", label: "Yeni satış (POS)", desc: "Kassada sifariş tamamlandıqda (gələcək)" },
];

export function TelegramConfigForm({ initial }: { initial: TelegramSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testPending, startTestTransition] = useTransition();
  const [chatId, setChatId] = useState(initial.chat_id ?? "");
  const [events, setEvents] = useState<string[]>(initial.events);

  function toggleEvent(key: string) {
    setEvents((prev) => (prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]));
  }

  function save() {
    startTransition(async () => {
      const res = await saveTelegramSettings({
        chat_id: chatId.trim(),
        events: events as ("webhook_order" | "stok_alert" | "low_stock" | "yeni_satis")[],
      });
      if (res.ok) {
        toast.success("Telegram ayarları yadda saxlandı");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function test() {
    startTestTransition(async () => {
      const res = await sendTestTelegram();
      if (res.ok) toast.success("Test mesaj göndərildi — Telegram-da yoxlayın");
      else toast.error(res.error);
    });
  }

  if (!initial.bot_configured) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Bot konfiqurasiya olunmayıb</AlertTitle>
        <AlertDescription className="text-xs">
          <code>TELEGRAM_BOT_TOKEN</code> environment variable qoyulmayıb. Server administratoru
          @BotFather-də bot yaratmalıdır və token-i Vercel-də əlavə etməlidir. Token əlavə
          olunduqdan sonra bu səhifəyə qayıdın.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Necə qoşulur?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Telegram-da <strong>@BotFather</strong>-ə yazıb yeni bot yaradın (admin bunu artıq edib)</li>
            <li>Telegram-da bot-u açın və <code>/start</code> göndərin</li>
            <li>Şəxsi chat ID-nizi tapmaq üçün: <strong>@userinfobot</strong>-a yazıb "Id" göstərəcək</li>
            <li>Qrup üçün: bot-u qrupa əlavə edin, sonra <strong>@RawDataBot</strong>-u qrupa əlavə edin və ya <strong>@userinfobot</strong>-a yönləndirin</li>
            <li>Aşağıda chat ID-nizi yapışdırın və "Test mesaj göndər" basın</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Chat ID</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="chat-id" className="text-xs">
              Telegram chat ID *
            </Label>
            <div className="flex gap-1">
              <Input
                id="chat-id"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="123456789 və ya -1001234567890 (qrup)"
                className="font-mono text-sm"
              />
              <Button
                onClick={test}
                disabled={testPending || !chatId.trim()}
                size="sm"
                variant="outline"
              >
                {testPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Test
              </Button>
            </div>
            <p className="text-[10.5px] text-muted-foreground">
              Şəxsi chat üçün müsbət rəqəm, qrup üçün <code>-100...</code> ilə başlayan mənfi rəqəm.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hansı hadisələrdə bildiriş gəlsin?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {EVENT_OPTIONS.map((opt) => {
              const checked = events.includes(opt.key);
              const planned = opt.key !== "webhook_order";
              return (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                    checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/30"
                  } ${planned ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEvent(opt.key)}
                    disabled={planned}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      {planned && (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          planlaşdırılır
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.desc}</p>
                  </div>
                  {checked && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !chatId.trim()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Yadda saxla
        </Button>
      </div>
    </div>
  );
}
