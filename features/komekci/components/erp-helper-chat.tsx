"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bot, Send, Loader2, Sparkles, ArrowRight, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { askErpHelper } from "../ai-help-actions";

type Turn = {
  role: "user" | "assistant";
  content: string;
  suggested?: { id: string; basliq: string; href: string }[];
  isMock?: boolean;
};

const PRESET_QUESTIONS = [
  "Necə yeni məhsul yaradım?",
  "Satışı necə qaytarım?",
  "İşçiyə KPI hədəfi necə verim?",
  "Borc olan müştəriləri necə görüm?",
  "Yeni filial necə əlavə edim?",
  "Audit log harada görünür?",
];

/** /komekci səhifəsinin başında ERP haqqında sual-cavab chat-i. */
export function ErpHelperChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setQuestion("");

    // Son 4 mesajı history kimi göndər
    const history = next.slice(-9, -1).map((t) => ({ role: t.role, content: t.content }));

    startTransition(async () => {
      const res = await askErpHelper({ question: text, history });
      if (res.ok) {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: res.reply, suggested: res.suggestedTopics, isMock: res.isMock },
        ]);
      } else {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: `⚠ ${res.error}` },
        ]);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-background to-background shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
          <Bot className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold">ERP köməkçi botu</h2>
          <p className="text-[10.5px] text-muted-foreground">
            Sistem haqqında sual ver — addım-addım cavab verim
          </p>
        </div>
        <Sparkles className="h-4 w-4 text-violet-500" />
      </div>

      {/* Chat area */}
      <div className="max-h-[400px] min-h-[160px] space-y-3 overflow-y-auto p-4">
        {turns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              💡 Aşağıdakılardan birini seç və ya öz sualını yaz:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  disabled={pending}
                  className="rounded-full border border-violet-500/30 bg-violet-500/5 px-3 py-1 text-[11.5px] font-medium text-violet-600 hover:bg-violet-500/10 disabled:opacity-50 dark:text-violet-400"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((t, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-2",
                t.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {t.role === "assistant" && (
                <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] space-y-2 rounded-2xl px-3 py-2 text-sm",
                t.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-foreground",
              )}>
                <div className="whitespace-pre-wrap leading-relaxed">{t.content}</div>
                {t.isMock && (
                  <div className="text-[9.5px] italic text-muted-foreground">
                    (test cavabı — AI açar yoxdur)
                  </div>
                )}
                {t.suggested && t.suggested.length > 0 && (
                  <div className="border-t border-border/30 pt-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Əlaqəli mövzular
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                      {t.suggested.map((s) => (
                        <Link
                          key={s.id}
                          href={s.href}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-light hover:underline"
                        >
                          <ArrowRight className="h-3 w-3" />
                          {s.basliq}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {t.role === "user" && (
                <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                  <UserIcon className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))
        )}
        {pending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cavab yazır...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border/40 bg-background/40 px-3 py-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Məsələn: necə yeni satış edim?"
          disabled={pending}
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          maxLength={500}
        />
        <Button type="submit" size="sm" disabled={pending || !question.trim()} className="h-9 gap-1">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Soruş
        </Button>
        {turns.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setTurns([])} disabled={pending} className="h-9">
            Təmizlə
          </Button>
        )}
      </form>
    </div>
  );
}
