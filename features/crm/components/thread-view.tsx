"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, FileText, UserPlus, Loader2, Bot, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { sendReply, convertChatToMusteri } from "../inbox-actions";
import { suggestAiReply, suggestAiReplyVariants, toggleAutoReply, sendAutoReply } from "../ai-cavab-action";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "../inbox-queries";
import type { TemplateRow } from "../types";

const TONE_LABELS: Record<string, string> = {
  qisa: "Qısa",
  resmi: "Professional",
  dostluq: "Dostluq",
};

type ChatHeader = {
  id: string;
  display_ad: string | null;
  telefon: string | null;
  kanal: string;
  etiketler: string[];
  status: string | null;
};

type Variant = { uslub: "qisa" | "resmi" | "dostluq"; text: string };

type Props = {
  chat: ChatHeader;
  messages: ChatMessage[];
  templates: TemplateRow[];
};

export function ThreadView({ chat, messages, templates }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [aiPending, startAiTransition] = useTransition();
  const [convertPending, startConvertTransition] = useTransition();
  const [variantsPending, startVariantsTransition] = useTransition();
  const [autoPending, startAutoTransition] = useTransition();
  const [variants, setVariants] = useState<Variant[]>([]);
  const isAutoOn = (chat.etiketler ?? []).includes("auto_reply");
  const isEscalated = chat.status === "eskalasiya" || (chat.etiketler ?? []).includes("eskalasiya");

  function onSend(ai = false) {
    if (!text.trim()) {
      toast.error("Mesaj boş ola bilməz");
      return;
    }
    const fd = new FormData();
    fd.set("sohbet_id", chat.id);
    fd.set("metn", text);
    fd.set("ai_yaradilan", String(ai));
    startTransition(async () => {
      const res = await sendReply(fd);
      if (res.ok) {
        setText("");
        toast.success("Göndərildi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function applyTemplate(t: TemplateRow) {
    const replaced = t.matn
      .replace(/\{\{musteri_ad\}\}/g, chat.display_ad ?? "Müştəri")
      .replace(/\{\{telefon\}\}/g, chat.telefon ?? "");
    setText(replaced);
  }

  function aiSuggest() {
    const last = [...messages].reverse().find((m) => m.istiqamet === "in");
    const sual = last?.metn || "Bu müştəri ilə necə davam etməliyəm?";
    const fd = new FormData();
    fd.set("sual", sual);
    fd.set("uslub", "dostluq");
    fd.set("dil", "az");
    startAiTransition(async () => {
      const res = await suggestAiReply(fd);
      if (res.ok) {
        setText(res.text);
        toast.success("AI cavab hazırdır — redaktə edib göndərə bilərsiniz");
      } else {
        toast.error(res.error);
      }
    });
  }

  function convert() {
    const fd = new FormData();
    fd.set("sohbet_id", chat.id);
    startConvertTransition(async () => {
      const res = await convertChatToMusteri(fd);
      if (res.ok) toast.success("Müştəriyə çevrildi");
      else toast.error(res.error);
    });
  }

  function suggest3() {
    const last = [...messages].reverse().find((m) => m.istiqamet === "in");
    const sual = last?.metn || "Bu müştəri ilə necə davam etməliyəm?";
    const fd = new FormData();
    fd.set("sual", sual);
    fd.set("dil", "az");
    startVariantsTransition(async () => {
      const res = await suggestAiReplyVariants(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setVariants(res.variants);
      toast.success(`${res.variants.length} variant hazırdır`);
    });
  }

  function toggleAuto() {
    const fd = new FormData();
    fd.set("sohbet_id", chat.id);
    fd.set("aktiv", String(!isAutoOn));
    startAutoTransition(async () => {
      const res = await toggleAutoReply(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.aktiv ? "Avto-cavab aktiv" : "Avto-cavab söndürüldü");
      router.refresh();
    });
  }

  function sendVariantAuto(v: Variant) {
    const fd = new FormData();
    fd.set("sohbet_id", chat.id);
    fd.set("metn", v.text);
    startTransition(async () => {
      const res = await sendAutoReply(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.escalated) {
        toast.warning("Ardıcıl 2 AI cavabdan sonra menecera ötürüldü");
      } else {
        toast.success("AI cavab göndərildi");
      }
      setVariants([]);
      router.refresh();
    });
  }

  return (
    <Card className="glass">
      <CardContent className="flex flex-col gap-0 p-0" style={{ height: "calc(100vh - 240px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/40 p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-secondary text-xs">
                {(chat.display_ad ?? "—").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-semibold">{chat.display_ad ?? chat.telefon ?? "—"}</div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{chat.kanal}</Badge>
                {chat.telefon && <span>{chat.telefon}</span>}
                {isAutoOn && (
                  <Badge variant="outline" className="border-violet-400/40 bg-violet-400/10 text-violet-300 text-[10px]">
                    <Bot className="h-2.5 w-2.5" /> AI auto
                  </Badge>
                )}
                {isEscalated && (
                  <Badge variant="outline" className="border-rose-400/40 bg-rose-400/10 text-rose-300 text-[10px]">
                    <AlertTriangle className="h-2.5 w-2.5" /> Eskalasiya
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={isAutoOn ? "default" : "ghost"}
              onClick={toggleAuto}
              disabled={autoPending}
              title={isAutoOn ? "Avto-cavabı söndür" : "Avto-cavabı aktivləşdir"}
            >
              {autoPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              {isAutoOn ? "Auto: ON" : "Auto: OFF"}
            </Button>
            <Button size="sm" variant="ghost" onClick={convert} disabled={convertPending}>
              {convertPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Müştəriyə çevir
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Mesaj yoxdur</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.istiqamet === "out" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[78%] rounded-xl px-3 py-1.5 text-sm whitespace-pre-wrap",
                    m.istiqamet === "out"
                      ? "rounded-br-sm bg-primary/15 text-foreground border border-primary/30"
                      : "rounded-bl-sm bg-secondary/60"
                  )}
                >
                  {m.metn || (m.fayl_url ? `[Fayl: ${m.fayl_url}]` : "—")}
                  <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                    {m.ai_yaradilan && <Sparkles className="h-2.5 w-2.5" />}
                    <span>{m.yaradildi ? formatDistanceToNow(m.yaradildi, { addSuffix: true, locale: az }) : "—"}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="space-y-2 border-t border-border/40 p-3">
          {variants.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-violet-400/30 bg-violet-400/5 p-2">
              <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-violet-300">
                <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI variantları</span>
                <button type="button" onClick={() => setVariants([])} className="text-muted-foreground hover:text-foreground">
                  Bağla
                </button>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="rounded-md border border-border/40 bg-secondary/30 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{TONE_LABELS[v.uslub] ?? v.uslub}</Badge>
                    <div className="flex items-center gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => setText(v.text)} title="Redaktorə köçür">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="sm" onClick={() => sendVariantAuto(v)} disabled={pending}>
                        <Send className="h-3 w-3" /> Avto göndər
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-foreground">{v.text}</p>
                </div>
              ))}
            </div>
          )}
          <QuickReplyChips chat={chat} onPick={setText} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Cavab yazın..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={pending}
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => onSend(false)} disabled={pending || !text.trim()}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Göndər
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <FileText className="h-3.5 w-3.5" /> Şablon
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {templates.length === 0 ? (
                  <DropdownMenuItem disabled>Şablon yoxdur</DropdownMenuItem>
                ) : (
                  templates.slice(0, 20).map((t) => (
                    <DropdownMenuItem key={t.id} onSelect={() => applyTemplate(t)}>
                      {t.ad}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" onClick={aiSuggest} disabled={aiPending}>
              {aiPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI cavab təklif
            </Button>

            <Button size="sm" variant="outline" onClick={suggest3} disabled={variantsPending}>
              {variantsPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI: 3 variant
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const QUICK_REPLIES: { id: string; label: string; text: string }[] = [
  { id: "salam", label: "Salam", text: "Salam {{ad}}, sizinlə əlaqə saxlamağıma görə təşəkkürlər." },
  { id: "elaqe", label: "Sizinlə əlaqə saxlayacağıq", text: "Müraciətinizi qəbul etdim. Qısa zamanda sizinlə əlaqə saxlayacağıq." },
  { id: "qiymet", label: "Qiymət göndərirəm", text: "Qiymət təklifini hazırlayıram və bir neçə dəqiqəyə göndərəcəyəm." },
  { id: "ofis", label: "Ofisə dəvət", text: "Münasib vaxt seçərək ofisimizə dəvətli olduğunuzu bildirmək istəyirəm." },
  { id: "tesekkur", label: "Təşəkkür", text: "Müraciətiniz üçün təşəkkür edirik!" },
  { id: "xidmet", label: "Müştəri xidməti", text: "Hər hansı bir sualınız olarsa müştəri xidmət xəttinə yaza bilərsiniz." },
];

function QuickReplyChips({
  chat,
  onPick,
}: {
  chat: { display_ad: string | null; telefon: string | null };
  onPick: (text: string) => void;
}) {
  function apply(t: string) {
    const replaced = t.replace(/\{\{ad\}\}/g, chat.display_ad ?? "Müştəri").replace(/\{\{telefon\}\}/g, chat.telefon ?? "");
    onPick(replaced);
  }
  return (
    <div className="flex flex-wrap gap-1">
      {QUICK_REPLIES.map((q) => (
        <button
          key={q.id}
          type="button"
          onClick={() => apply(q.text)}
          className="rounded-full border border-border/60 bg-secondary/20 px-2 py-0.5 text-[10.5px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
          title={q.text}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}
