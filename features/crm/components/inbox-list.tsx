"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MessageCircle, MessageSquare, Mail, Smartphone, Hash } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { az } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ChatListItem } from "../inbox-queries";

const CHANNEL: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  whatsapp: { label: "WhatsApp", cls: "bg-success/15 text-success", icon: MessageCircle },
  telegram: { label: "Telegram", cls: "bg-info/15 text-info", icon: MessageSquare },
  instagram: { label: "Instagram", cls: "bg-accent/15 text-accent", icon: Hash },
  sms: { label: "SMS", cls: "bg-warning/15 text-warning", icon: Smartphone },
  email: { label: "Email", cls: "bg-primary/15 text-primary-light", icon: Mail },
};

export function InboxList({ chats, selectedId }: { chats: ChatListItem[]; selectedId: string | null }) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(key: string, val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    const base = selectedId ? `/crm/inbox/${selectedId}` : "/crm/inbox";
    router.push(`${base}?${p.toString()}`);
  }

  return (
    <Card className="glass">
      <CardContent className="space-y-2 p-2">
        <div className="space-y-2 px-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Axtarış..."
              defaultValue={sp.get("q") ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
              }}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <FilterChip label="Hamısı" active={!sp.get("kanal")} onClick={() => setParam("kanal", "")} />
            {Object.entries(CHANNEL).map(([k, c]) => (
              <FilterChip
                key={k}
                label={c.label}
                active={sp.get("kanal") === k}
                onClick={() => setParam("kanal", k)}
              />
            ))}
          </div>
        </div>

        <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
          {chats.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Söhbət tapılmadı
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {chats.map((c) => {
                const ch = CHANNEL[c.kanal] ?? CHANNEL.whatsapp;
                const Icon = ch.icon;
                const isOn = c.id === selectedId;
                return (
                  <Link
                    key={c.id}
                    href={`/crm/inbox/${c.id}`}
                    className={cn(
                      "flex items-start gap-2.5 rounded-md p-2 transition",
                      isOn ? "bg-primary/15" : "hover:bg-secondary/40"
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-secondary text-[10px]">
                        {c.ad.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate text-xs font-medium">{c.ad}</span>
                        <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      {c.son_mesaj && (
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {c.son_mesaj}
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {c.son_zaman ? formatDistanceToNow(c.son_zaman, { addSuffix: true, locale: az }) : "—"}
                        </span>
                        {c.oxunmamis > 0 && (
                          <Badge variant="destructive" className="h-4 text-[9px]">
                            {c.oxunmamis}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition",
        active ? "border-primary bg-primary/10 text-primary-light" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
