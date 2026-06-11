"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Bot, User } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { askReport } from "../ai-report-actions";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Son 30 günün satış hesabatını göstər",
  "Bu ayın xərclərini kateqoriya üzrə çıxar",
  "Ən çox borclu 10 müştəri kimdir?",
  "Kritik səviyyədə olan məhsulları göstər",
  "Kassa və bank qalıqları nə qədərdir?",
  "Son 10 satışı göstər",
];

export function ReportChat() {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setInput("");
    const history = messages.slice();
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    startTransition(async () => {
      const res = await askReport(q, history);
      if (!res.ok) {
        toast.error(res.error);
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠ ${res.error}` }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    });
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Sərbəst hesabat soruş (AI)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Təbii dildə yaz — AI real datadan hesabat hazırlayır. Məs. «bu ay nə qədər satdıq?»
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={pending}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] hover:bg-secondary disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-purple-500/15 text-purple-600",
                  )}
                >
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary/10 text-foreground"
                      : "border border-border/50 bg-card",
                  )}
                >
                  <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">{m.content}</pre>
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Hesabat hazırlanır…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Hesabat sualı yaz… (məs. son 7 günün satışı)"
            disabled={pending}
            className="min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
