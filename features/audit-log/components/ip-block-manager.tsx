"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban, Unlock, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { createIpBlock, unblockIp, deleteIpBlock } from "../security-actions";

type IpBlock = {
  id: number;
  ip_adres: string;
  sebeb: string | null;
  aktiv: boolean;
  yaradildi: Date;
  bitme_tarixi: Date | null;
  istifadeciler: { ad_soyad: string | null; email: string } | null;
};

type FailedLogin = {
  id: bigint;
  email: string | null;
  ip_adres: string | null;
  ugurlu: boolean | null;
  user_agent: string | null;
  yaradildi: Date | null;
};

export function IpBlockManager({
  blocks,
  failedLogins,
}: {
  blocks: IpBlock[];
  failedLogins: FailedLogin[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ip, setIp] = useState("");
  const [sebeb, setSebeb] = useState("");
  const [bitme, setBitme] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("ip_adres", ip);
    fd.set("sebeb", sebeb);
    fd.set("bitme_tarixi", bitme);
    startTransition(async () => {
      const res = await createIpBlock(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("IP bloklandı");
        setIp("");
        setSebeb("");
        setBitme("");
        router.refresh();
      }
    });
  }

  function blockFromFailed(failedIp: string) {
    setIp(failedIp);
    setSebeb("Çox uğursuz giriş cəhdi");
    document.getElementById("ip_input")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => document.getElementById("ip_input")?.focus(), 200);
  }

  async function onUnblock(id: number) {
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      const res = await unblockIp(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Bloku açıldı");
        router.refresh();
      }
    });
  }

  async function onDelete(id: number) {
    if (!confirm("Bu IP blokunu tamamilə silmək istəyirsiniz?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      const res = await deleteIpBlock(fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("IP blok qeydi silindi");
        router.refresh();
      }
    });
  }

  const aktivBloks = blocks.filter((b) => b.aktiv);
  const passivBloks = blocks.filter((b) => !b.aktiv);

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ban className="h-4 w-4 text-rose-500" /> Yeni IP blok
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_180px_auto] md:items-end">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                IP ünvan *
              </label>
              <Input
                id="ip_input"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.50"
                required
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Səbəb
              </label>
              <Input value={sebeb} onChange={(e) => setSebeb(e.target.value)} placeholder="məs: çox uğursuz giriş cəhdi" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Bitmə (boş = daimi)
              </label>
              <Input type="datetime-local" value={bitme} onChange={(e) => setBitme(e.target.value)} />
            </div>
            <button
              type="submit"
              disabled={pending || !ip}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Blokla
            </button>
          </form>
        </CardContent>
      </Card>

      {/* AKTIV bloks */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Bloklu IP-lər <span className="text-muted-foreground">({aktivBloks.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {aktivBloks.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">Aktiv IP blok yoxdur</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Səbəb</th>
                    <th className="px-3 py-2">Bloklayan</th>
                    <th className="px-3 py-2">Tarix</th>
                    <th className="px-3 py-2">Bitmə</th>
                    <th className="px-3 py-2 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {aktivBloks.map((b) => {
                    const expired = b.bitme_tarixi && b.bitme_tarixi < new Date();
                    return (
                      <tr key={b.id} className="border-b border-border/20">
                        <td className="px-3 py-2 font-mono text-xs">{b.ip_adres}</td>
                        <td className="px-3 py-2 text-xs">{b.sebeb ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{b.istifadeciler?.ad_soyad ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(b.yaradildi)}</td>
                        <td className="px-3 py-2 text-xs">
                          {b.bitme_tarixi ? (
                            <Badge
                              variant="outline"
                              className={expired ? "border-amber-500/40 text-amber-500 text-[10px]" : "text-[10px]"}
                            >
                              {expired ? "Vaxtı keçib" : formatDate(b.bitme_tarixi)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-rose-500 border-rose-500/40">
                              Daimi
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onUnblock(b.id)}
                            disabled={pending}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            <Unlock className="h-3 w-3" /> Aç
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PASSIV bloks */}
      {passivBloks.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">
              Köhnə bloklar <span className="text-muted-foreground/70">({passivBloks.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {passivBloks.slice(0, 10).map((b) => (
                    <tr key={b.id} className="border-b border-border/20 opacity-60">
                      <td className="px-3 py-2 font-mono text-xs">{b.ip_adres}</td>
                      <td className="px-3 py-2 text-xs">{b.sebeb ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(b.yaradildi)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onDelete(b.id)}
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
          </CardContent>
        </Card>
      )}

      {/* Failed logins (24h) */}
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Son uğursuz girişlər (24 saat) <span className="text-muted-foreground">({failedLogins.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {failedLogins.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              Son 24 saatda uğursuz giriş yoxdur
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-3 py-2">Vaxt</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Brauzer / OS</th>
                    <th className="px-3 py-2 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {failedLogins.map((f) => (
                    <tr key={f.id.toString()} className="border-b border-border/20">
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {formatDate(f.yaradildi)}
                      </td>
                      <td className="px-3 py-2 text-xs">{f.email ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{f.ip_adres ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground line-clamp-1 max-w-xs">
                        {f.user_agent?.split(") ")[0]?.replace("(", "") ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {f.ip_adres && (
                          <button
                            type="button"
                            onClick={() => blockFromFailed(f.ip_adres!)}
                            disabled={pending}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20"
                          >
                            <Ban className="h-3 w-3" /> Blokla
                          </button>
                        )}
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

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("az-AZ", { dateStyle: "short", timeStyle: "short" }).format(d);
}
