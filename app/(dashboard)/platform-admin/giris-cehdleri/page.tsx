import type { Metadata } from "next";
import { Search, ShieldCheck, CheckCircle2, XCircle, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getLoginAttempts } from "@/features/platform-admin/queries";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Giriş cəhdləri" };

const SAAT_VARIANTS: Array<{ value: string; label: string }> = [
  { value: "24", label: "Son 24 saat" },
  { value: "168", label: "Son 7 gün" },
  { value: "720", label: "Son 30 gün" },
];

export default async function GirisCehdleriPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; result?: string; saat?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const sinceHours = Number(sp.saat) || 168;
  const rows = await getLoginAttempts({ q: sp.q, result: sp.result, sinceHours });

  // Üst zolaq üçün xülasə
  const ugursuzSay = rows.filter((r) => !r.ugurlu).length;
  const ferqliIp = new Set(rows.filter((r) => r.ip).map((r) => r.ip)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-1 h-5 w-5 text-primary-light" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Giriş cəhdləri (log){" "}
              <span className="text-base font-normal text-muted-foreground tabular-nums">
                · {rows.length}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Uğurlu/uğursuz girişlər, IP, brauzer.
            </p>
          </div>
        </div>
      </header>

      {/* Xülasə zolağı */}
      <section className="grid grid-cols-3 gap-3">
        <SummaryCell label="Cəm qeyd" value={rows.length} icon={ShieldCheck} />
        <SummaryCell
          label="Uğursuz"
          value={ugursuzSay}
          icon={XCircle}
          tone="danger"
        />
        <SummaryCell label="Fərqli IP" value={ferqliIp} icon={Globe} />
      </section>

      {/* Filtr paneli (GET) */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Email və ya IP..."
            className="h-9 pl-8"
          />
        </div>
        <select
          name="result"
          defaultValue={sp.result ?? ""}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Hamısı</option>
          <option value="ugurlu">Uğurlu</option>
          <option value="ugursuz">Uğursuz</option>
        </select>
        <select
          name="saat"
          defaultValue={String(sinceHours)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {SAAT_VARIANTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
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
            <p className="mt-2 text-sm text-muted-foreground">Qeyd yoxdur.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/40 text-left">
                <th className="px-3 py-2.5">Vaxt</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">IP</th>
                <th className="px-3 py-2.5">Nəticə</th>
                <th className="px-3 py-2.5">Brauzer / Cihaz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatDate(r.yaradildi, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    {r.email ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10.5px] text-muted-foreground">
                    {r.ip ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.ugurlu ? (
                      <Badge
                        variant="outline"
                        className="gap-1 bg-success/15 text-success border-success/30 text-[10px]"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Uğurlu
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 bg-danger/15 text-danger border-danger/30 text-[10px]"
                      >
                        <XCircle className="h-3 w-3" /> Uğursuz
                      </Badge>
                    )}
                  </td>
                  <td
                    className="px-3 py-2.5 max-w-[360px] truncate text-xs text-muted-foreground"
                    title={r.user_agent ?? undefined}
                  >
                    {r.user_agent ?? "—"}
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

function SummaryCell({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "danger";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          tone === "danger" ? "bg-danger/15 text-danger" : "bg-secondary text-primary-light"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div
          className={`text-xl font-bold tabular-nums ${tone === "danger" ? "text-danger" : ""}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
