"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, CheckCircle2, AlertTriangle, Save, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/lib/toast";
import { saveEmailSettings, sendTestEmail, type EmailSettings } from "../actions";

const EVENT_OPTIONS: Array<{ key: "webhook_order" | "stok_alert" | "low_stock" | "daily_summary"; label: string; desc: string }> = [
  { key: "webhook_order", label: "Webhook sifarişləri", desc: "Marketplace (Wolt, Birmarket...) sifariş gəldikdə" },
  { key: "stok_alert", label: "Stok xəbərdarlığı", desc: "Minimum stok altına düşəndə (gələcək)" },
  { key: "low_stock", label: "Aşağı stok", desc: "Aşağı stok aşkar edildikdə (gələcək)" },
  { key: "daily_summary", label: "Günlük xülasə", desc: "Hər səhər saat 8:00-də dünənki satış, alış, marketplace və pul axını xülasəsi" },
];

export function EmailConfigForm({ initial }: { initial: EmailSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testPending, startTestTransition] = useTransition();
  const [recipient, setRecipient] = useState(initial.recipient ?? "");
  const [events, setEvents] = useState<string[]>(initial.events);

  function toggleEvent(key: string) {
    setEvents((prev) => (prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]));
  }

  function save() {
    startTransition(async () => {
      const res = await saveEmailSettings({
        recipient: recipient.trim(),
        events: events as ("webhook_order" | "stok_alert" | "low_stock" | "daily_summary")[],
      });
      if (res.ok) {
        toast.success("Email ayarları yadda saxlandı");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function test() {
    startTestTransition(async () => {
      const res = await sendTestEmail();
      if (res.ok) toast.success("Test email göndərildi — yoxlayın");
      else toast.error(res.error);
    });
  }

  if (!initial.provider_configured) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Email provayder konfiqurasiya olunmayıb</AlertTitle>
        <AlertDescription className="text-xs">
          Heç bir email göndərmə provayderi env-də qoyulmayıb. Server administratoru
          aşağıdakılardan birini Vercel-də əlavə etməlidir:
          <ul className="mt-2 list-disc pl-5">
            <li><strong>Resend</strong>: <code>RESEND_API_KEY</code> + <code>RESEND_FROM</code></li>
            <li><strong>SendGrid</strong>: <code>SENDGRID_API_KEY</code> + <code>SENDGRID_FROM</code></li>
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bildiriş email ünvanı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email *</Label>
            <div className="flex gap-1">
              <Input
                id="email"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="me@example.com"
                className="text-sm"
              />
              <Button onClick={test} disabled={testPending || !recipient.trim()} size="sm" variant="outline">
                {testPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hansı hadisələrdə email gəlsin?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {EVENT_OPTIONS.map((opt) => {
              const checked = events.includes(opt.key);
              const planned = opt.key === "stok_alert" || opt.key === "low_stock";
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
        <Button onClick={save} disabled={pending || !recipient.trim()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Yadda saxla
        </Button>
      </div>
    </div>
  );
}
