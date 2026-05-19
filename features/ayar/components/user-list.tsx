"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UserRow = {
  id: string;
  ad_soyad: string;
  email: string;
  aktiv: boolean | null;
  son_giris: Date | null;
  iki_fa_aktiv: boolean;
  isci_kod: string | null;
  roles: { id: number; ad: string; reng: string | null } | null;
};

const FILTERS = [
  { key: "all", label: "Hamısı" },
  { key: "aktiv", label: "Aktiv" },
  { key: "passiv", label: "Passiv" },
  { key: "login7", label: "Son 7 gün" },
] as const;

export function UserList({ users, selectedId }: { users: UserRow[]; selectedId: string | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const filtered = useMemo(() => {
    let list = users;
    if (filter === "aktiv") list = list.filter((u) => u.aktiv);
    else if (filter === "passiv") list = list.filter((u) => !u.aktiv);
    else if (filter === "login7") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      list = list.filter((u) => u.son_giris && u.son_giris >= cutoff);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (u) =>
          u.ad_soyad.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.roles?.ad.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filter, query]);

  const select = (id: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("selected", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <aside className="space-y-3">
      <h2 className="text-sm font-semibold">İstifadəçilər</h2>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Axtar..."
          className="pl-8 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {filtered.map((u) => {
          const active = u.id === selectedId;
          const initials = u.ad_soyad
            .split(" ")
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => select(u.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition",
                active
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/30 hover:border-border hover:bg-secondary/40",
                !u.aktiv && "opacity-50"
              )}
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {initials || "??"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{u.ad_soyad}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {u.email.split("@")[0]}@{u.email.split("@")[1]?.slice(0, 6) ?? ""}
                </div>
              </div>
              {u.roles && (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: `${u.roles.reng ?? "#6366f1"}20`,
                    color: u.roles.reng ?? "#6366f1",
                  }}
                >
                  {u.roles.ad}
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            Tapılmadı
          </div>
        )}
      </div>
    </aside>
  );
}
