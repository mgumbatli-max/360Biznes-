"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Send,
  Loader2,
  MessageSquare,
  CheckCheck,
  Check,
  Search,
  Trash2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  FileText,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn, formatDate as fmtDate } from "@/lib/utils";
import { sendFilialMessage, markFilialMessagesRead, deleteFilialMessage } from "../messages-actions";

type Partner = {
  id: number;
  ad: string;
  kod: string | null;
  tip: string | null;
  aktiv: boolean | null;
};

type LastMsg = {
  id: number;
  source_filial_id: number;
  target_filial_id: number;
  mesaj: string;
  movzu: string | null;
  yaradildi: Date;
  oxundu: boolean;
};

type PartnerRow = {
  partner: Partner;
  lastMessage: LastMsg | null;
  unread: number;
};

type Message = {
  id: number;
  source_filial_id: number;
  target_filial_id: number;
  gonderici_id: string | null;
  mesaj: string;
  movzu: string | null;
  novu: string | null;
  prioritet: string | null;
  oxundu: boolean;
  parent_id: number | null;
  yaradildi: Date;
  gonderici: { ad_soyad: string | null; email: string } | null;
};

const NOV_OPTIONS = [
  { value: "umumi", label: "Ümumi", icon: MessageSquare, color: "text-muted-foreground" },
  { value: "sorgu", label: "Sorğu", icon: HelpCircle, color: "text-sky-500" },
  { value: "cavab", label: "Cavab", icon: CheckCheck, color: "text-emerald-500" },
  { value: "sened", label: "Sənəd", icon: FileText, color: "text-violet-500" },
  { value: "telimat", label: "Təlimat", icon: BookOpen, color: "text-amber-500" },
];

const PRIORITET_OPTIONS = [
  { value: "asagi", label: "Aşağı", color: "text-muted-foreground" },
  { value: "normal", label: "Normal", color: "" },
  { value: "yuksek", label: "Yüksək", color: "text-amber-500" },
  { value: "kritik", label: "Kritik", color: "text-rose-500" },
];

function formatTime(d: Date) {
  return fmtDate(d, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: Date) {
  return fmtDate(d, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function isToday(d: Date) {
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function FilialMessages({
  sourceFilial,
  partners,
  selectedPartnerId,
  conversation,
}: {
  sourceFilial: { id: number; ad: string; kod: string | null };
  partners: PartnerRow[];
  selectedPartnerId: number | null;
  conversation: Message[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [mesaj, setMesaj] = useState("");
  const [movzu, setMovzu] = useState("");
  const [novu, setNovu] = useState("umumi");
  const [prioritet, setPrioritet] = useState("normal");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Mark as read when conversation opens
  useEffect(() => {
    if (selectedPartnerId && conversation.length > 0) {
      const fd = new FormData();
      fd.set("source_filial_id", String(sourceFilial.id));
      fd.set("target_filial_id", String(selectedPartnerId));
      markFilialMessagesRead(fd).catch(() => {});
    }
    // Scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedPartnerId, conversation.length, sourceFilial.id]);

  const selectPartner = (id: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("dm", String(id));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const filteredPartners = search.trim()
    ? partners.filter((p) => p.partner.ad.toLowerCase().includes(search.toLowerCase()))
    : partners;

  const selectedPartner = selectedPartnerId
    ? partners.find((p) => p.partner.id === selectedPartnerId)?.partner ?? null
    : null;

  function send() {
    if (!selectedPartnerId || !mesaj.trim()) return;
    const fd = new FormData();
    fd.set("source_filial_id", String(sourceFilial.id));
    fd.set("target_filial_id", String(selectedPartnerId));
    fd.set("mesaj", mesaj.trim());
    if (movzu.trim()) fd.set("movzu", movzu.trim());
    fd.set("novu", novu);
    fd.set("prioritet", prioritet);
    startTransition(async () => {
      const res = await sendFilialMessage(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Göndərildi");
        setMesaj("");
        setMovzu("");
        setNovu("umumi");
        setPrioritet("normal");
        setShowAdvanced(false);
        router.refresh();
      }
    });
  }

  async function onDelete(id: number) {
    if (!confirm("Bu mesajı silmək istəyirsiniz?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    const res = await deleteFilialMessage(fd);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Silindi");
      router.refresh();
    }
  }

  const totalUnread = partners.reduce((s, p) => s + p.unread, 0);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]" style={{ minHeight: 480 }}>
      {/* LEFT — PARTNER LIST */}
      <aside className="flex flex-col gap-2 rounded-xl border border-border/40 bg-card/40 p-2">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-semibold">Filiallar</h3>
          {totalUnread > 0 && (
            <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
              {totalUnread} oxunmamış
            </Badge>
          )}
        </div>
        <div className="relative px-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filial axtar..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="space-y-1 overflow-y-auto">
          {filteredPartners.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              Başqa filial yoxdur
            </div>
          ) : (
            filteredPartners.map(({ partner, lastMessage, unread }) => {
              const active = partner.id === selectedPartnerId;
              const isFromPartner = lastMessage && lastMessage.source_filial_id === partner.id;
              const ts = lastMessage?.yaradildi;
              return (
                <button
                  key={partner.id}
                  type="button"
                  onClick={() => selectPartner(partner.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition",
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:border-border hover:bg-secondary/40",
                    !partner.aktiv && "opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white text-[10px] font-bold",
                      unread > 0 && "ring-2 ring-primary"
                    )}
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    {(partner.kod ?? partner.ad).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold">{partner.ad}</span>
                      {ts && (
                        <span suppressHydrationWarning className="shrink-0 text-[10px] text-muted-foreground">
                          {isToday(ts) ? formatTime(ts) : formatDate(ts).split(" ")[0]}
                        </span>
                      )}
                    </div>
                    {lastMessage ? (
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "truncate text-[11px]",
                            unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {isFromPartner ? "" : "Siz: "}
                          {lastMessage.movzu ? `[${lastMessage.movzu}] ` : ""}
                          {lastMessage.mesaj}
                        </span>
                        {unread > 0 && (
                          <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {unread}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">Mesaj yoxdur</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT — CONVERSATION */}
      <section className="flex flex-col rounded-xl border border-border/40 bg-card/40">
        {!selectedPartner ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h3 className="mt-2 text-sm font-semibold">Filial seç</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Sol paneldən hansı filial ilə yazışacağını seç və ya yenisini başla
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white text-[10px] font-bold"
                style={{ background: "var(--brand-gradient)" }}
              >
                {(selectedPartner.kod ?? selectedPartner.ad).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">{selectedPartner.ad}</span>
                  {selectedPartner.kod && <Badge variant="outline" className="text-[9px]">{selectedPartner.kod}</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {sourceFilial.ad} → {selectedPartner.ad}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {conversation.length} mesaj
              </Badge>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: 400 }}>
              {conversation.length === 0 ? (
                <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                  <div>
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    Hələ mesaj yoxdur — ilk addımı sən at
                  </div>
                </div>
              ) : (
                conversation.map((m) => {
                  const isMine = m.source_filial_id === sourceFilial.id;
                  const NovIcon = NOV_OPTIONS.find((n) => n.value === m.novu)?.icon ?? MessageSquare;
                  const novColor = NOV_OPTIONS.find((n) => n.value === m.novu)?.color ?? "text-muted-foreground";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}
                    >
                      {m.movzu && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                          <NovIcon className={cn("h-3 w-3", novColor)} />
                          {m.movzu}
                          {m.prioritet === "yuksek" && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          {m.prioritet === "kritik" && <AlertTriangle className="h-3 w-3 text-rose-500" />}
                        </div>
                      )}
                      <div
                        className={cn(
                          "group relative max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          isMine
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-foreground"
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.mesaj}</div>
                        <div className={cn("mt-1 flex items-center gap-1 text-[10px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {m.gonderici?.ad_soyad && <span>{m.gonderici.ad_soyad}</span>}
                          <span>· {formatTime(m.yaradildi)}</span>
                          {isMine && (m.oxundu ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                        </div>
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => onDelete(m.id)}
                            className="absolute -right-7 top-1 opacity-0 transition group-hover:opacity-100"
                            title="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Compose */}
            <div className="border-t border-border/40 p-2">
              {showAdvanced && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-card/40 p-2">
                  <Input
                    value={movzu}
                    onChange={(e) => setMovzu(e.target.value)}
                    placeholder="Mövzu (opsional)"
                    className="h-7 flex-1 min-w-[180px] text-xs"
                    disabled={pending}
                  />
                  <select
                    value={novu}
                    onChange={(e) => setNovu(e.target.value)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    disabled={pending}
                  >
                    {NOV_OPTIONS.map((n) => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                  <select
                    value={prioritet}
                    onChange={(e) => setPrioritet(e.target.value)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    disabled={pending}
                  >
                    {PRIORITET_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={cn(
                    "rounded-md p-2 text-xs transition",
                    showAdvanced ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                  )}
                  title="Mövzu, növ, prioritet"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
                <textarea
                  value={mesaj}
                  onChange={(e) => setMesaj(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`«${selectedPartner.ad}»-ə mesaj yaz... (Cmd/Ctrl + Enter göndər)`}
                  rows={1}
                  disabled={pending}
                  className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  style={{ minHeight: 36, maxHeight: 120 }}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={pending || !mesaj.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Göndər
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
