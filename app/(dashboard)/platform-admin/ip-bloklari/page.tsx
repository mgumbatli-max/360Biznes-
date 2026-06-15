import type { Metadata } from "next";
import { Search, ShieldX, ShieldOff, ShieldCheck, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getGlobalIpBlocks } from "@/features/platform-admin/queries";
import { IpBlockForm } from "@/features/platform-admin/components/ip-block-form";
import { IpUnblockButton } from "@/features/platform-admin/components/ip-unblock-button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "IP bloklama" };

export default async function IpBloklariPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const activeOnly = sp.active !== "0";
  const rows = await getGlobalIpBlocks({ q: sp.q, activeOnly });

  const aktivSay = rows.filter((r) => r.aktiv).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldX className="mt-1 h-5 w-5 text-primary-light" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              IP bloklama{" "}
              <span className="text-base font-normal text-muted-foreground tabular-nums">· {rows.length}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Şübhəli IP-ləri login-dən qlobal bloklayın. {aktivSay} aktiv blok.
            </p>
          </div>
        </div>
      </header>

      {/* Yeni IP blokla */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary-light" /> Yeni IP blokla
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IpBlockForm />
        </CardContent>
      </Card>

      {/* Filtr paneli (GET) */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="IP ünvanı..."
            className="h-9 pl-8"
          />
        </div>
        <select
          name="active"
          defaultValue={activeOnly ? "1" : "0"}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="1">Yalnız aktiv</option>
          <option value="0">Hamısı</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Axtar
        </button>
      </form>

      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Bloklanmış IP tapılmadı.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/40 text-left">
                <th className="px-3 py-2.5">IP</th>
                <th className="px-3 py-2.5">Səbəb</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Yaradıldı</th>
                <th className="px-3 py-2.5">Bitmə</th>
                <th className="px-3 py-2.5 text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-3 py-2.5 font-mono text-xs tabular-nums">{r.ip}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.sebeb ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {r.aktiv ? (
                      <Badge variant="outline" className="gap-1 border-success/30 bg-success/15 text-[10px] text-success">
                        <ShieldX className="h-3 w-3" /> Aktiv
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-border bg-secondary text-[10px] text-muted-foreground">
                        <ShieldOff className="h-3 w-3" /> Passiv
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatDate(r.yaradildi, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {r.bitme_tarixi ? formatDate(r.bitme_tarixi, { dateStyle: "short", timeStyle: "short" }) : "müddətsiz"}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.aktiv ? (
                      <IpUnblockButton id={r.id} />
                    ) : (
                      <span className="flex items-center justify-end text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
