"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hash, MessageCircle, Building2, Search, Plus, BellOff, Pin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

type ChannelRow = {
  uzv: { rolu: string; bildiris: boolean; son_oxudu_de: Date | null };
  kanal: {
    id: number;
    ad: string;
    tesvir: string | null;
    novu: string;
    qapali: boolean;
    filial: { id: number; ad: string; kod: string | null } | null;
    son_mesaj_de: Date | null;
    _count: { uzvler: number };
  };
  otherUser: { id: string; ad_soyad: string; email: string } | null;
  unread: number;
  lastMessage: {
    mesaj: string;
    yaradildi: Date;
    gonderici: { ad_soyad: string | null } | null;
  } | null;
};

function formatRelative(d: Date | null) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "indi";
  if (diffMin < 60) return `${diffMin}d`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}s`;
  const days = Math.floor(diffMin / 1440);
  if (days < 7) return `${days}g`;
  return formatDate(date, { day: "2-digit", month: "short" });
}

export function ChannelList({
  channels,
  selectedId,
  onNewChannel,
  onNewDm,
}: {
  channels: ChannelRow[];
  selectedId: number | null;
  onNewChannel: () => void;
  onNewDm: () => void;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return channels;
    const q = query.toLowerCase();
    return channels.filter((c) => {
      const name = c.kanal.novu === "direct" ? c.otherUser?.ad_soyad ?? "" : c.kanal.ad;
      return name.toLowerCase().includes(q);
    });
  }, [channels, query]);

  const groups = useMemo(() => {
    return {
      direct: filtered.filter((c) => c.kanal.novu === "direct"),
      kanal: filtered.filter((c) => c.kanal.novu === "kanal"),
      filial: filtered.filter((c) => c.kanal.novu === "filial"),
    };
  }, [filtered]);

  const select = (id: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("k", String(id));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <aside className="flex flex-col gap-2 rounded-xl border border-border/40 bg-card/40 p-2" style={{ minHeight: 600 }}>
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Söhbətlər</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewDm}
              title="Yeni şəxsi mesaj"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onNewChannel}
              title="Yeni kanal"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Axtar..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {groups.kanal.length > 0 && (
          <Section title="Kanallar" icon={Hash}>
            {groups.kanal.map((c) => (
              <ChannelRowComp key={c.kanal.id} row={c} active={c.kanal.id === selectedId} onClick={() => select(c.kanal.id)} />
            ))}
          </Section>
        )}

        {groups.direct.length > 0 && (
          <Section title="Birbaşa mesaj" icon={MessageCircle}>
            {groups.direct.map((c) => (
              <ChannelRowComp key={c.kanal.id} row={c} active={c.kanal.id === selectedId} onClick={() => select(c.kanal.id)} />
            ))}
          </Section>
        )}

        {groups.filial.length > 0 && (
          <Section title="Filial söhbətləri" icon={Building2}>
            {groups.filial.map((c) => (
              <ChannelRowComp key={c.kanal.id} row={c} active={c.kanal.id === selectedId} onClick={() => select(c.kanal.id)} />
            ))}
          </Section>
        )}

        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
            {query ? "Tapılmadı" : "Hələ söhbət yoxdur"}
            <div className="mt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={onNewChannel}
                className="rounded-md bg-primary px-2.5 py-1 text-[10.5px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                + Yeni kanal
              </button>
              <button
                type="button"
                onClick={onNewDm}
                className="rounded-md border border-border bg-secondary px-2.5 py-1 text-[10.5px] font-semibold hover:bg-secondary/70"
              >
                Şəxsi mesaj
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ChannelRowComp({
  row,
  active,
  onClick,
}: {
  row: ChannelRow;
  active: boolean;
  onClick: () => void;
}) {
  const isDm = row.kanal.novu === "direct";
  const isFilial = row.kanal.novu === "filial";
  const name = isDm ? row.otherUser?.ad_soyad ?? row.kanal.ad : row.kanal.ad;
  const Icon = isDm ? MessageCircle : isFilial ? Building2 : Hash;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/40",
        row.unread > 0 && !active && "font-semibold"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      {!row.uzv.bildiris && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
      {row.kanal.son_mesaj_de && (
        <span className="shrink-0 text-[10px] text-muted-foreground/70" suppressHydrationWarning>
          {formatRelative(row.kanal.son_mesaj_de)}
        </span>
      )}
      {row.unread > 0 && (
        <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {row.unread > 99 ? "99+" : row.unread}
        </span>
      )}
    </button>
  );
}
