"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { sendMessage, clearHistory } from "../actions";
import type { ChatTurn } from "../types";

type Props = {
  initial: ChatTurn[];
  isMockMode: boolean;
  mode?: "owner" | "employee";
  suggestions?: string[];
  emptyHeading?: string;
  emptySubtext?: string;
  prefilledInput?: string;
};

const DEFAULT_EMPLOYEE_SUGGESTIONS = [
  "Bu ay nə qədər satmışam?",
  "Açıq tapşırıqlarım hansılardır?",
  "Mənim aylıq maaşım nə qədərdir?",
  "Satış texnikalarını necə yaxşılaşdırım?",
];

const DEFAULT_OWNER_SUGGESTIONS = [
  "Bu ayın ümumi gəliri necədir?",
  "TOP 5 satılan məhsulum hansılardır?",
  "Borclu müştərilərim varmı?",
  "Kassa qalığım nə qədərdir?",
];

export function ChatClient({
  initial,
  isMockMode,
  mode = "employee",
  suggestions,
  emptyHeading = "AI Köməkçi",
  emptySubtext = "Anbar, satış, vəzifə və şəxsi performans haqqında sual ver.",
  prefilledInput,
}: Props) {
  const chips = suggestions ?? (mode === "owner" ? DEFAULT_OWNER_SUGGESTIONS : DEFAULT_EMPLOYEE_SUGGESTIONS);
  const router = useRouter();
  const [messages, setMessages] = useState<ChatTurn[]>(initial);
  const [input, setInput] = useState(prefilledInput ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function onSend() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");

    const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userTurn]);

    startTransition(async () => {
      const res = await sendMessage(text, mode);
      if (!res.ok) {
        toast.error(res.error);
        setMessages((prev) => prev.filter((m) => m.id !== userTurn.id));
        return;
      }
      const reply: ChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        is_mock: res.is_mock,
      };
      setMessages((prev) => [...prev, reply]);
      inputRef.current?.focus();
    });
  }

  function onClear() {
    if (!confirm("Söhbət tarixçəsi silinsin?")) return;
    startTransition(async () => {
      const res = await clearHistory(mode);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMessages([]);
      toast.success("Tarixçə təmizləndi");
      router.refresh();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-180px)] max-w-3xl flex-col gap-3">
      {isMockMode && (
        <Alert>
          <AlertDescription className="text-xs">
            Mock rejim aktivdir. Real Claude AI cavablar üçün <code className="rounded bg-secondary px-1 py-0.5">.env</code>-də{" "}
            <code className="rounded bg-secondary px-1 py-0.5">ANTHROPIC_API_KEY</code> təyin edin.
          </AlertDescription>
        </Alert>
      )}

      <div className="glass flex-1 overflow-y-auto rounded-xl border border-border p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{emptyHeading}</h3>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">{emptySubtext}</p>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
              {chips.map((c) => (
                <SuggestChip key={c} onClick={(t) => setInput(t)}>{c}</SuggestChip>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <Turn key={m.id} turn={m} />
            ))}
            {pending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI düşünür...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 rounded-xl border border-border bg-card/40 px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Sual yazın... (Enter göndər, Shift+Enter yeni sətir)"
            className="w-full resize-none bg-transparent text-sm focus:outline-none disabled:opacity-60"
            disabled={pending}
            autoFocus
          />
        </div>
        <Button
          onClick={onSend}
          disabled={pending || !input.trim()}
          className="font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
        {messages.length > 0 && (
          <Button onClick={onClear} variant="ghost" size="icon" disabled={pending} title="Tarixçəni təmizlə">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className={cn("text-xs font-semibold", isUser ? "bg-secondary" : "")} style={!isUser ? { background: "var(--brand-gradient)", color: "#fff" } : undefined}>
          {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm", isUser ? "bg-primary/15 text-foreground" : "bg-secondary/60")}>
        <div className="whitespace-pre-wrap leading-relaxed">{turn.content}</div>
        {turn.is_mock && (
          <div className="mt-1 text-[10px] text-muted-foreground">mock cavab</div>
        )}
      </div>
    </div>
  );
}

function SuggestChip({ onClick, children }: { onClick: (t: string) => void; children: string }) {
  return (
    <button
      type="button"
      onClick={() => onClick(children)}
      className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
    >
      {children}
    </button>
  );
}
