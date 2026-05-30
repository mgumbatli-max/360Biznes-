import type { Metadata } from "next";
import { Briefcase, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { prismaUnscoped } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Cross-tenant audit" };

async function getAuditLog(filter: { tenant?: string; q?: string }) {
  const where: Record<string, unknown> = {};
  if (filter.tenant) where.sahibkar_id = filter.tenant;
  if (filter.q) {
    where.OR = [
      { emeliyyat: { contains: filter.q, mode: "insensitive" } },
      { resurs_nov: { contains: filter.q, mode: "insensitive" } },
      { istifadeci_ad: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const [rows, tenants] = await Promise.all([
    prismaUnscoped.audit_log.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: {
        sahibkarlar: { select: { ad: true } },
      },
    }),
    prismaUnscoped.sahibkarlar.findMany({
      select: { id: true, ad: true },
      orderBy: { ad: "asc" },
    }),
  ]);
  return { rows, tenants };
}

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; q?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const { rows, tenants } = await getAuditLog({ tenant: sp.tenant, q: sp.q });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Cross-tenant audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bütün sahibkarlar üzrə audit qeydləri. Yalnız super-admin görür.
        </p>
      </header>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <select
          name="tenant"
          defaultValue={sp.tenant ?? ""}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Bütün tenantlar</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.ad}</option>
          ))}
        </select>
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Əməliyyat, resurs, istifadəçi..."
          className="h-9 max-w-md"
        />
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
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Audit qeydi tapılmadı.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="px-3 py-2 text-left">Tarix</th>
                <th className="px-3 py-2 text-left">Tenant</th>
                <th className="px-3 py-2 text-left">İstifadəçi</th>
                <th className="px-3 py-2 text-left">Əməliyyat</th>
                <th className="px-3 py-2 text-left">Resurs</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((r) => (
                <tr key={String(r.id)} className="hover:bg-secondary/30">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatDate(r.yaradildi, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2 font-medium text-xs">{r.sahibkarlar?.ad ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.istifadeci_ad ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">{r.emeliyyat}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.resurs_nov}</td>
                  <td className="px-3 py-2">
                    {r.status === "ugur" ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3 w-3" /> uğur
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-danger">
                        <AlertCircle className="h-3 w-3" /> {r.status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-muted-foreground">
                    {r.ip_adres ? String(r.ip_adres) : "—"}
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
