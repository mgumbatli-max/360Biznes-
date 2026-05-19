"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveLoginRule, deleteLoginRule, toggleLoginRuleActive } from "../security-actions";

type Rule = {
  id: number;
  istifadeci_id: string;
  aktiv: boolean;
  gunler: number[];
  baslama_saat: Date;
  bitme_saat: Date;
  qeyd: string | null;
  istifadeciler: { id: string; ad_soyad: string | null; email: string };
};

type UserOpt = { id: string; ad_soyad: string | null; email: string };

const DAYS = [
  { num: 1, label: "B.E" },
  { num: 2, label: "Ç.A" },
  { num: 3, label: "Ç" },
  { num: 4, label: "C.A" },
  { num: 5, label: "Cm" },
  { num: 6, label: "Şn" },
  { num: 7, label: "Bzr" },
];

function dateToTime(d: Date | string): string {
  if (typeof d === "string") return d.slice(11, 16);
  return d.toISOString().slice(11, 16);
}

export function LoginHoursManager({
  rules,
  users,
}: {
  rules: Rule[];
  users: UserOpt[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [userId, setUserId] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("19:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [qeyd, setQeyd] = useState("");

  function toggleDay(n: number) {
    setDays((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort()));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!userId) return setError("İstifadəçi seçin");
    if (days.length === 0) return setError("Ən az 1 gün seçilməlidir");

    const fd = new FormData();
    fd.set("istifadeci_id", userId);
    fd.set("baslama_saat", start);
    fd.set("bitme_saat", end);
    fd.set("gunler", days.join(","));
    fd.set("qeyd", qeyd);
    startTransition(async () => {
      const res = await saveLoginRule(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Giriş qaydası saxlanıldı");
        setUserId("");
        setStart("09:00");
        setEnd("19:00");
        setDays([1, 2, 3, 4, 5]);
        setQeyd("");
        router.refresh();
      }
    });
  }

  async function onDelete(id: number, name: string) {
    if (!confirm(`«${name}» üçün giriş qaydasını silmək istəyirsiniz?`)) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      const res = await deleteLoginRule(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Qayda silindi");
        router.refresh();
      }
    });
  }

  async function onToggle(id: number, current: boolean) {
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("value", String(!current));
    startTransition(async () => {
      const res = await toggleLoginRuleActive(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(current ? "Söndürüldü" : "Aktiv edildi");
        router.refresh();
      }
    });
  }

  const usedUserIds = new Set(rules.map((r) => r.istifadeci_id));
  const availableUsers = users.filter((u) => !usedUserIds.has(u.id));

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Yeni giriş qaydası
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  İstifadəçi *
                </label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">— Seçin —</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.ad_soyad ?? u.email} ({u.email})
                    </option>
                  ))}
                  {availableUsers.length === 0 && <option disabled>Hamısının qaydası var</option>}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Başlama saatı
                </label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Bitmə saatı
                </label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Günlər (icazəli olduğu gün)
              </label>
              <div className="flex flex-wrap gap-1">
                {DAYS.map((d) => {
                  const active = days.includes(d.num);
                  return (
                    <button
                      key={d.num}
                      type="button"
                      onClick={() => toggleDay(d.num)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600"
                          : "border-border bg-secondary text-muted-foreground hover:bg-secondary/70"
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setDays([1, 2, 3, 4, 5])}
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  İş günü (B.E-Cm)
                </button>
                <span className="text-[10px] text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setDays([1, 2, 3, 4, 5, 6])}
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  Bazar günündən savayı
                </button>
                <span className="text-[10px] text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setDays([1, 2, 3, 4, 5, 6, 7])}
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  Hər gün
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Qeyd
              </label>
              <Input value={qeyd} onChange={(e) => setQeyd(e.target.value)} placeholder="məs: əsas iş saatları" />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                disabled={pending || !userId || days.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Saxla
              </button>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              İstifadəçi yalnız seçilmiş gün və saat aralığında sistemə daxil ola bilər. Vaxt xaricində giriş cəhdi olarsa,
              «Hörmətli əməkdaş! Hal hazırda sistemə giriş icazəniz yoxdur» mesajı görünəcək.
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Mövcud qaydalar <span className="text-muted-foreground">({rules.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              Heç bir qayda təyin edilməyib
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">İstifadəçi</th>
                    <th className="px-3 py-2">Günlər</th>
                    <th className="px-3 py-2">Saatlar</th>
                    <th className="px-3 py-2">Vəziyyət</th>
                    <th className="px-3 py-2">Qeyd</th>
                    <th className="px-3 py-2 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className={cn("border-b border-border/20", !r.aktiv && "opacity-50")}>
                      <td className="px-3 py-2">
                        <div className="text-sm font-semibold">{r.istifadeciler.ad_soyad ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{r.istifadeciler.email}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {DAYS.map((d) => (
                            <span
                              key={d.num}
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                r.gunler.includes(d.num)
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : "bg-secondary text-muted-foreground/50"
                              )}
                            >
                              {d.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {dateToTime(r.baslama_saat)} – {dateToTime(r.bitme_saat)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onToggle(r.id, r.aktiv)}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-semibold transition",
                            r.aktiv
                              ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          )}
                          disabled={pending}
                        >
                          {r.aktiv ? "aktiv" : "söndürülüb"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs">{r.qeyd ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onDelete(r.id, r.istifadeciler.ad_soyad ?? r.istifadeciler.email)}
                          disabled={pending}
                          className="rounded-md p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
