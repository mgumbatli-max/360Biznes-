"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Hash, Lock, Globe, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createChannel } from "../actions";

type User = {
  id: string;
  ad_soyad: string;
  email: string;
  vezife: string | null;
  roles: { ad: string; reng: string | null } | null;
};

export function NewChannelDialog({
  open,
  onOpenChange,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ad, setAd] = useState("");
  const [tesvir, setTesvir] = useState("");
  const [qapali, setQapali] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  function reset() {
    setAd("");
    setTesvir("");
    setQapali(false);
    setSelectedIds(new Set());
    setSearch("");
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("ad", ad);
    fd.set("tesvir", tesvir);
    fd.set("novu", "kanal");
    fd.set("qapali", String(qapali));
    fd.set("uzv_ids", Array.from(selectedIds).join(","));
    startTransition(async () => {
      const res = await createChannel(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Kanal yaradıldı");
        const data = (res as { data?: { id?: number } }).data;
        onOpenChange(false);
        reset();
        if (data?.id) router.replace(`/team?k=${data.id}`);
        router.refresh();
      }
    });
  }

  const filteredUsers = search.trim()
    ? users.filter(
        (u) => u.ad_soyad.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  function toggleUser(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" /> Yeni kanal
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="ch_ad">Kanal adı *</Label>
            <Input
              id="ch_ad"
              required
              minLength={2}
              maxLength={150}
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="layihə-2026, satıcılar, anbar-bildirişləri"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ch_tesvir">Təsvir</Label>
            <Input
              id="ch_tesvir"
              maxLength={500}
              value={tesvir}
              onChange={(e) => setTesvir(e.target.value)}
              placeholder="Nə üçündür? (opsional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setQapali(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-left transition",
                !qapali ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
              )}
            >
              <Globe className="h-4 w-4 text-emerald-500" />
              <div>
                <div className="text-sm font-semibold">Açıq</div>
                <div className="text-[11px] text-muted-foreground">Hər kəs qoşula bilər</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setQapali(true)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-left transition",
                qapali ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
              )}
            >
              <Lock className="h-4 w-4 text-amber-500" />
              <div>
                <div className="text-sm font-semibold">Qapalı</div>
                <div className="text-[11px] text-muted-foreground">Yalnız dəvət olunan</div>
              </div>
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>İstifadəçilər ({selectedIds.size} seçilib)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad və ya email ilə axtar"
              className="text-xs"
            />
            <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border/40">
              {filteredUsers.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Tapılmadı</div>
              ) : (
                filteredUsers.map((u) => {
                  const selected = selectedIds.has(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-2 py-1.5 text-left transition",
                        selected ? "bg-primary/10" : "hover:bg-secondary/40"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        readOnly
                        className="h-4 w-4 accent-primary"
                      />
                      <div
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: u.roles?.reng ?? "var(--brand-gradient)" }}
                      >
                        {u.ad_soyad
                          .split(" ")
                          .map((w) => w[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{u.ad_soyad}</div>
                        <div className="truncate text-[10.5px] text-muted-foreground">
                          {u.vezife ?? u.email}
                        </div>
                      </div>
                      {u.roles && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
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
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending || ad.length < 2}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yarat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewDmDialog({
  open,
  onOpenChange,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  function selectUser(userId: string, userName: string) {
    setError(null);
    const fd = new FormData();
    fd.set("ad", userName);
    fd.set("novu", "direct");
    fd.set("qapali", "true");
    fd.set("uzv_ids", userId);
    startTransition(async () => {
      const res = await createChannel(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        const data = (res as { data?: { id?: number } }).data;
        onOpenChange(false);
        setSearch("");
        if (data?.id) router.replace(`/team?k=${data.id}`);
        router.refresh();
      }
    });
  }

  const filteredUsers = search.trim()
    ? users.filter(
        (u) => u.ad_soyad.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto md:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni şəxsi mesaj</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İstifadəçi axtar..."
          autoFocus
        />
        <div className="max-h-80 space-y-0.5 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Tapılmadı</div>
          ) : (
            filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectUser(u.id, u.ad_soyad)}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-secondary/40 disabled:opacity-50"
              >
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: u.roles?.reng ?? "var(--brand-gradient)" }}
                >
                  {u.ad_soyad
                    .split(" ")
                    .map((w) => w[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.ad_soyad}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {u.vezife ? `${u.vezife} · ` : ""}
                    {u.email}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
