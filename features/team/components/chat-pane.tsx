"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Loader2,
  Hash,
  MessageCircle,
  Building2,
  Trash2,
  Users,
  Bell,
  BellOff,
  Pin,
  Archive,
  Eye,
  EyeOff,
  Lock,
  Timer,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  sendTeamMessage,
  deleteTeamMessage,
  markChannelRead,
  toggleChannelNotif,
  archiveChannel,
  unlockMessage,
  readOneTimeMessage,
} from "../actions";

type Channel = {
  id: number;
  ad: string;
  tesvir: string | null;
  novu: string;
  qapali: boolean;
  filial: { id: number; ad: string; kod: string | null } | null;
  uzvler: Array<{
    rolu: string;
    bildiris: boolean;
    istifadeci: { id: string; ad_soyad: string; email: string; aktiv: boolean | null };
  }>;
};

type Message = {
  id: number;
  kanal_id: number;
  gonderici_id: string | null;
  mesaj: string;
  novu: string | null;
  silindi: boolean;
  parent_id: number | null;
  yaradildi: Date;
  gizli?: boolean;
  bir_dafelik?: boolean;
  kilid_sifre_hash?: string | null;
  oxuyan_id?: string | null;
  gonderici: { id: string; ad_soyad: string; email: string } | null;
};

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("az-AZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

function fmtDay(d: Date) {
  const now = new Date();
  const date = new Date(d);
  if (date.toDateString() === now.toDateString()) return "Bu gün";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Dünən";
  return new Intl.DateTimeFormat("az-AZ", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function ChatPane({
  channel,
  messages,
  currentUserId,
  bildirisActive,
}: {
  channel: Channel | null;
  messages: Message[];
  currentUserId: string;
  bildirisActive: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [showMembers, setShowMembers] = useState(false);
  const [secretMode, setSecretMode] = useState(false);
  const [oneTimeMode, setOneTimeMode] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [showLockInput, setShowLockInput] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [channel?.id, messages.length]);

  // Mark as read when opened
  useEffect(() => {
    if (channel?.id) {
      const fd = new FormData();
      fd.set("kanal_id", String(channel.id));
      markChannelRead(fd).catch(() => {});
    }
  }, [channel?.id]);

  function send() {
    if (!channel || !text.trim()) return;
    const fd = new FormData();
    fd.set("kanal_id", String(channel.id));
    fd.set("mesaj", text.trim());
    if (secretMode) fd.set("gizli", "true");
    if (oneTimeMode) fd.set("bir_dafelik", "true");
    if (showLockInput && lockPassword.trim()) fd.set("kilid_sifre", lockPassword.trim());
    startTransition(async () => {
      const res = await sendTeamMessage(fd);
      if (!res.ok) toast.error(res.error);
      else {
        setText("");
        setSecretMode(false);
        setOneTimeMode(false);
        setLockPassword("");
        setShowLockInput(false);
        router.refresh();
      }
    });
  }

  async function onDelete(id: number) {
    if (!confirm("Bu mesajı silmək istəyirsiniz?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    const res = await deleteTeamMessage(fd);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Silindi");
      router.refresh();
    }
  }

  async function toggleNotif() {
    if (!channel) return;
    const fd = new FormData();
    fd.set("kanal_id", String(channel.id));
    fd.set("value", String(!bildirisActive));
    const res = await toggleChannelNotif(fd);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(bildirisActive ? "Bildirişlər söndürüldü" : "Bildirişlər aktivləşdirildi");
      router.refresh();
    }
  }

  async function onArchive() {
    if (!channel) return;
    if (!confirm(`«${channel.ad}» kanalını arxivə göndərmək istəyirsiniz?\n\nKanal görünməyəcək, amma mesajlar saxlanılır.`)) return;
    const fd = new FormData();
    fd.set("id", String(channel.id));
    const res = await archiveChannel(fd);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Arxivləndi");
      router.refresh();
    }
  }

  if (!channel) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border/40 bg-card/40 p-8 text-center">
        <div>
          <Hash className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-2 text-sm font-semibold">Söhbət seç</h3>
          <p className="mt-1 text-xs text-muted-foreground">Sol paneldən kanal və ya şəxsi mesaj seç</p>
        </div>
      </div>
    );
  }

  const Icon = channel.novu === "direct" ? MessageCircle : channel.novu === "filial" ? Building2 : Hash;
  const dmOther = channel.novu === "direct"
    ? channel.uzvler.find((u) => u.istifadeci.id !== currentUserId)?.istifadeci ?? null
    : null;
  const displayName = dmOther?.ad_soyad ?? channel.ad;

  // Group messages by day
  const grouped: Array<{ day: string; msgs: Message[] }> = [];
  let currentDay = "";
  for (const m of messages) {
    const day = fmtDay(m.yaradildi);
    if (day !== currentDay) {
      grouped.push({ day, msgs: [m] });
      currentDay = day;
    } else {
      grouped[grouped.length - 1].msgs.push(m);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/40 bg-card/40" style={{ minHeight: 600 }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">{displayName}</span>
            {channel.novu === "filial" && channel.filial && (
              <Badge variant="outline" className="text-[9px]">{channel.filial.ad}</Badge>
            )}
            {channel.qapali && <Pin className="h-3 w-3 text-muted-foreground" />}
            <Badge variant="outline" className="text-[9px]">{channel.uzvler.length} üzv</Badge>
          </div>
          {channel.tesvir && <div className="truncate text-[11px] text-muted-foreground">{channel.tesvir}</div>}
        </div>
        <button
          type="button"
          onClick={() => setShowMembers(!showMembers)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Üzvlər"
        >
          <Users className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleNotif}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title={bildirisActive ? "Bildirişləri söndür" : "Bildirişləri aktiv et"}
        >
          {bildirisActive ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
          title="Arxivlə"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
          {grouped.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                Hələ mesaj yoxdur — sözə ilk başla
              </div>
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.day} className="space-y-1.5">
                <div className="sticky top-0 z-10 my-2 flex items-center justify-center">
                  <span className="rounded-full bg-card px-3 py-0.5 text-[10px] font-semibold text-muted-foreground shadow">
                    {g.day}
                  </span>
                </div>
                {g.msgs.map((m, i) => {
                  const prev = i > 0 ? g.msgs[i - 1] : null;
                  const sameSender =
                    prev?.gonderici_id === m.gonderici_id &&
                    m.yaradildi.getTime() - prev.yaradildi.getTime() < 5 * 60 * 1000;
                  const isMine = m.gonderici_id === currentUserId;
                  return (
                    <MessageItem
                      key={m.id}
                      msg={m}
                      sameSender={!!sameSender}
                      isMine={isMine}
                      onDelete={onDelete}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Members panel */}
        {showMembers && (
          <aside className="w-56 shrink-0 border-l border-border/40 bg-card/40 p-2">
            <h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Üzvlər ({channel.uzvler.length})
            </h4>
            <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: 480 }}>
              {channel.uzvler.map((u) => (
                <div
                  key={u.istifadeci.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                    !u.istifadeci.aktiv && "opacity-50"
                  )}
                >
                  <div
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    {u.istifadeci.ad_soyad
                      .split(" ")
                      .map((w) => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.istifadeci.ad_soyad}</div>
                  </div>
                  {u.rolu === "admin" && (
                    <Badge variant="outline" className="text-[8px]">admin</Badge>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-border/40 p-2">
        {(secretMode || oneTimeMode || showLockInput) && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px]">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">Xüsusi rejim:</span>
            {secretMode && <Badge variant="outline" className="text-[10px]"><EyeOff className="mr-1 h-2.5 w-2.5" /> Gizli</Badge>}
            {oneTimeMode && <Badge variant="outline" className="text-[10px]"><Timer className="mr-1 h-2.5 w-2.5" /> 1 dəfəlik</Badge>}
            {showLockInput && (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                <Input
                  type="password"
                  value={lockPassword}
                  onChange={(e) => setLockPassword(e.target.value)}
                  placeholder="Kilid şifrəsi"
                  className="h-6 w-32 text-xs"
                  disabled={pending}
                />
              </span>
            )}
            <span className="ml-auto text-muted-foreground">
              Bütün hadisələr sahibkar log-unda saxlanılır
            </span>
          </div>
        )}
        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={() => setSecretMode(!secretMode)}
            title="Gizli mesaj (yalnız üzvlər görür)"
            className={cn(
              "rounded-md p-2 transition",
              secretMode ? "bg-amber-500/15 text-amber-600" : "text-muted-foreground hover:bg-secondary"
            )}
            disabled={pending}
          >
            {secretMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setOneTimeMode(!oneTimeMode)}
            title="Bir dəfəlik (oxunduqdan sonra silinir)"
            className={cn(
              "rounded-md p-2 transition",
              oneTimeMode ? "bg-rose-500/15 text-rose-500" : "text-muted-foreground hover:bg-secondary"
            )}
            disabled={pending}
          >
            <Timer className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLockInput(!showLockInput);
              if (showLockInput) setLockPassword("");
            }}
            title="Şifrə ilə kilidlə"
            className={cn(
              "rounded-md p-2 transition",
              showLockInput ? "bg-violet-500/15 text-violet-500" : "text-muted-foreground hover:bg-secondary"
            )}
            disabled={pending}
          >
            <Lock className="h-4 w-4" />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`«${displayName}»-də mesaj yaz... (Cmd/Ctrl + Enter göndər)`}
            rows={1}
            disabled={pending}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ minHeight: 36, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={send}
            disabled={pending || !text.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Göndər
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageItem({
  msg,
  sameSender,
  isMine,
  onDelete,
}: {
  msg: Message;
  sameSender: boolean;
  isMine: boolean;
  onDelete: (id: number) => void;
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [unlockPw, setUnlockPw] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const initials = (msg.gonderici?.ad_soyad ?? "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (msg.silindi) {
    return (
      <div className="px-12 text-xs italic text-muted-foreground/70 flex items-center gap-1">
        <Timer className="h-3 w-3" />
        {msg.bir_dafelik
          ? "[Bir dəfəlik mesaj oxundu və silindi]"
          : "[Bu mesaj silinmişdir]"}
      </div>
    );
  }

  const isLocked = !!msg.kilid_sifre_hash && !revealed && !isMine;
  const isOneTime = !!msg.bir_dafelik && !msg.oxuyan_id && !isMine;
  const isHidden = isLocked || isOneTime;

  async function unlock() {
    setUnlocking(true);
    setUnlockError(null);
    const fd = new FormData();
    fd.set("id", String(msg.id));
    fd.set("sifre", unlockPw);
    const res = await unlockMessage(fd);
    setUnlocking(false);
    if (!res.ok) {
      setUnlockError(res.error);
    } else {
      setRevealed(res.mesaj);
      setUnlockPw("");
      router.refresh();
    }
  }

  async function readOnce() {
    setUnlocking(true);
    const fd = new FormData();
    fd.set("id", String(msg.id));
    const res = await readOneTimeMessage(fd);
    setUnlocking(false);
    if (!res.ok) {
      setUnlockError(res.error);
    } else {
      setRevealed(res.mesaj);
      router.refresh();
    }
  }

  const displayText = revealed ?? msg.mesaj;

  return (
    <div className={cn("group flex gap-2 px-1", sameSender ? "pt-0.5" : "pt-2")}>
      {!sameSender ? (
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          {initials}
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {!sameSender && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{msg.gonderici?.ad_soyad ?? "—"}</span>
            <span className="text-[10px] text-muted-foreground">{fmtTime(msg.yaradildi)}</span>
            {msg.gizli && (
              <Badge variant="outline" className="gap-1 text-[9px]">
                <EyeOff className="h-2.5 w-2.5" /> Gizli
              </Badge>
            )}
            {msg.bir_dafelik && (
              <Badge variant="outline" className="gap-1 text-[9px] text-rose-500 border-rose-500/40">
                <Timer className="h-2.5 w-2.5" /> 1 dəfəlik
              </Badge>
            )}
            {msg.kilid_sifre_hash && (
              <Badge variant="outline" className="gap-1 text-[9px] text-violet-500 border-violet-500/40">
                <Lock className="h-2.5 w-2.5" /> Kilidli
              </Badge>
            )}
          </div>
        )}

        {isHidden && !revealed ? (
          <div className="rounded-lg border border-dashed border-violet-500/40 bg-violet-500/5 p-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              {isLocked ? <Lock className="h-3.5 w-3.5 text-violet-500" /> : <Timer className="h-3.5 w-3.5 text-rose-500" />}
              {isLocked ? "Kilidli mesaj" : "Bir dəfəlik mesaj"}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {isLocked
                ? "Şifrəni daxil edib oxuya bilərsiniz."
                : "Bu mesajı yalnız bir dəfə oxumaq olur — açandan sonra silinir."}
            </div>
            {unlockError && <div className="mt-1 text-rose-500">{unlockError}</div>}
            {isLocked ? (
              <div className="mt-2 flex items-center gap-1">
                <Input
                  type="password"
                  value={unlockPw}
                  onChange={(e) => setUnlockPw(e.target.value)}
                  placeholder="Şifrə"
                  className="h-7 w-32 text-xs"
                />
                <button
                  type="button"
                  onClick={unlock}
                  disabled={unlocking || !unlockPw}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-1 text-[10px] font-semibold text-violet-600 hover:bg-violet-500/25 disabled:opacity-50"
                >
                  {unlocking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                  Aç
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={readOnce}
                disabled={unlocking}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-500/25 disabled:opacity-50"
              >
                {unlocking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                Oxu və sil
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{displayText}</div>
            {isMine && (
              <button
                type="button"
                onClick={() => onDelete(msg.id)}
                className="opacity-0 transition group-hover:opacity-100"
                title="Sil"
              >
                <Trash2 className="h-3 w-3 text-rose-500" />
              </button>
            )}
            {sameSender && (
              <span className="ml-auto text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100">
                {fmtTime(msg.yaradildi)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
