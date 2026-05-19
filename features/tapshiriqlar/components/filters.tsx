"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type UserOpt = { id: string; ad_soyad: string };

type Props = {
  users: UserOpt[];
};

export function TaskFilters({ users }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(sp.toString());
      if (value) {
        p.set(key, value);
      } else {
        p.delete(key);
      }
      startTransition(() => router.push(`/tapshiriqlar?${p.toString()}`));
    },
    [sp, router]
  );

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    update("q", q);
  };

  const hasFilters = Boolean(
    sp.get("q") ||
      sp.get("tip") ||
      sp.get("status") ||
      sp.get("prioritet") ||
      sp.get("mesul_id") ||
      sp.get("sort")
  );

  const clearAll = () => {
    const p = new URLSearchParams();
    const scope = sp.get("scope");
    const view = sp.get("view");
    if (scope) p.set("scope", scope);
    if (view) p.set("view", view);
    startTransition(() => router.push(`/tapshiriqlar?${p.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={onSearch} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={sp.get("q") ?? ""}
          placeholder="Axtar (başlıq + təsvir)..."
          className="h-9 w-[220px] pl-8"
          disabled={pending}
        />
      </form>

      <select
        value={sp.get("tip") ?? ""}
        onChange={(e) => update("tip", e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        disabled={pending}
      >
        <option value="">Hər tip</option>
        <option value="adi">Adi</option>
        <option value="cagrish">Çağrış</option>
        <option value="gorush">Görüş</option>
        <option value="email">E-poçt</option>
        <option value="senedlesme">Sənədləşmə</option>
      </select>

      <select
        value={sp.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        disabled={pending}
      >
        <option value="">Hər status</option>
        <option value="yeni">Gözləyir</option>
        <option value="icrada">İcradadır</option>
        <option value="gozlemede">Yoxlanılır</option>
        <option value="tamamlandi">Tamamlandı</option>
        <option value="legv">Ləğv</option>
      </select>

      <select
        value={sp.get("prioritet") ?? ""}
        onChange={(e) => update("prioritet", e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        disabled={pending}
      >
        <option value="">Hər prioritet</option>
        <option value="tecili">Təcili</option>
        <option value="yuksek">Yüksək</option>
        <option value="normal">Normal</option>
        <option value="asagi">Aşağı</option>
      </select>

      <select
        value={sp.get("mesul_id") ?? ""}
        onChange={(e) => update("mesul_id", e.target.value)}
        className="h-9 max-w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        disabled={pending}
      >
        <option value="">Hər məsul</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.ad_soyad}</option>
        ))}
      </select>

      <select
        value={sp.get("sort") ?? "deadline"}
        onChange={(e) => update("sort", e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        disabled={pending}
      >
        <option value="deadline">Sıralama: Son tarix</option>
        <option value="yaradildi">Sıralama: Yaradılma</option>
        <option value="prioritet">Sıralama: Prioritet</option>
        <option value="xatirlatma">Sıralama: Xatırlatma</option>
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-secondary/40 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Təmizlə
        </button>
      )}
    </div>
  );
}
