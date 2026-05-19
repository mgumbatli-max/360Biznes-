import type { Metadata } from "next";
import Link from "next/link";
import { Search, Building2, ExternalLink, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getTenants } from "@/features/platform-admin/queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenantlar" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  aktiv: { label: "Aktiv", cls: "bg-success/15 text-success border-success/30" },
  dayandirildi: { label: "Dayandırıldı", cls: "bg-danger/15 text-danger border-danger/30" },
};

export default async function TenantlarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const rows = await getTenants({ q: sp.q, status: sp.status });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenantlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bütün sahibkar şirkətləri.</p>
        </div>
      </header>

      <form className="flex max-w-md items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Ad və ya email..." className="h-9 pl-8" />
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <h3 className="font-semibold">Tenant tapılmadı</h3>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Şirkət</th>
                <th className="px-3 py-2.5">Plan</th>
                <th className="px-3 py-2.5">Abunə bitir</th>
                <th className="px-3 py-2.5 text-center">İstifadəçi</th>
                <th className="px-3 py-2.5 text-center">Məhsul</th>
                <th className="px-3 py-2.5 text-right">Satış cəmi</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const status = STATUS_LABELS[t.status] ?? STATUS_LABELS.aktiv;
                return (
                  <tr key={t.id} className="border-b border-border/30 transition hover:bg-secondary/40">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{t.ad}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {t.email}
                        {t.telefon && (<><span>·</span><Phone className="h-3 w-3" /> {t.telefon}</>)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {t.plan_ad ? (
                        <div>
                          <div className="text-sm">{t.plan_ad}</div>
                          {t.abune_novu === "sinaq" ? (
                            <Badge variant="outline" className="mt-0.5 text-[10px] border-warning/30 text-warning">Sınaq</Badge>
                          ) : (
                            <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(t.plan_qiymet)}/ay</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {t.abune_bitme ? formatDate(t.abune_bitme) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs">{t.istifadeci_sayi}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-xs">{t.mehsul_sayi}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{formatMoney(t.satish_cemi)}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={status.cls}>{status.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/platform-admin/tenantlar/${t.id}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Detay"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
