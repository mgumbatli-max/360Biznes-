import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users, Mail, Phone, Building2, ShieldCheck, CheckCircle2, MinusCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePlatformAdmin } from "@/lib/platform-admin/guard";
import { getGlobalUsers } from "@/features/platform-admin/queries";
import { UserAdminActions } from "@/features/platform-admin/components/user-admin-actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "İstifadəçilər" };

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Hamısı" },
  { value: "aktiv", label: "Aktiv" },
  { value: "deaktiv", label: "Deaktiv" },
  { value: "silinmis", label: "Silinmiş" },
];

export default async function IstifadecilerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tenant?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const { rows, total, tenants } = await getGlobalUsers({
    q: sp.q,
    status: sp.status,
    tenantId: sp.tenant,
  });

  const aktivSay = rows.filter((u) => u.aktiv && !u.deleted_at).length;
  const deaktivSay = rows.filter((u) => !u.aktiv && !u.deleted_at).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Users className="mt-1 h-5 w-5 text-primary-light" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              İstifadəçilər{" "}
              <span className="text-base font-normal text-muted-foreground tabular-nums">· {total}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bütün tenantlar üzrə qlobal istifadəçilər.
            </p>
          </div>
        </div>
      </header>

      {/* Xülasə zolağı */}
      <section className="grid grid-cols-3 gap-3">
        <SummaryCell label="Görünən" value={rows.length} icon={ShieldCheck} />
        <SummaryCell label="Aktiv" value={aktivSay} icon={CheckCircle2} tone="success" />
        <SummaryCell label="Deaktiv" value={deaktivSay} icon={MinusCircle} tone="muted" />
      </section>

      {/* Filtr paneli (GET) */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Ad, email və ya telefon..."
            className="h-9 pl-8"
          />
        </div>
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          name="tenant"
          defaultValue={sp.tenant ?? ""}
          className="h-9 max-w-[220px] rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Bütün şirkətlər</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ad}
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
            <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">İstifadəçi tapılmadı.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/40 text-left">
                <th className="px-3 py-2.5">Ad soyad</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Şirkət</th>
                <th className="px-3 py-2.5">Rol</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Son giriş</th>
                <th className="px-3 py-2.5 text-right">Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/30">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/platform-admin/istifadeciler/${u.id}`}
                      className="font-medium text-primary-light transition hover:underline"
                    >
                      {u.ad_soyad}
                    </Link>
                    {u.telefon ? (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {u.telefon}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Mail className="h-3 w-3 text-muted-foreground" /> {u.email}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {u.tenant_ad}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{u.rol_ad}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge aktiv={u.aktiv} deletedAt={u.deleted_at} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {u.son_giris ? formatDate(u.son_giris, { dateStyle: "short", timeStyle: "short" }) : "heç vaxt"}
                  </td>
                  <td className="px-3 py-2.5">
                    <UserAdminActions
                      user={{
                        id: u.id,
                        ad_soyad: u.ad_soyad,
                        aktiv: u.aktiv,
                        deleted_at: u.deleted_at,
                      }}
                    />
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

function StatusBadge({ aktiv, deletedAt }: { aktiv: boolean; deletedAt: Date | null }) {
  if (deletedAt) {
    return (
      <Badge variant="outline" className="gap-1 bg-danger/15 text-danger border-danger/30 text-[10px]">
        <Trash2 className="h-3 w-3" /> Silinmiş
      </Badge>
    );
  }
  if (aktiv) {
    return (
      <Badge variant="outline" className="gap-1 bg-success/15 text-success border-success/30 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> Aktiv
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 bg-secondary text-muted-foreground border-border text-[10px]">
      <MinusCircle className="h-3 w-3" /> Deaktiv
    </Badge>
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
  tone?: "success" | "muted";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          tone === "success"
            ? "bg-success/15 text-success"
            : tone === "muted"
              ? "bg-secondary text-muted-foreground"
              : "bg-secondary text-primary-light"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div
          className={`text-xl font-bold tabular-nums ${
            tone === "success" ? "text-success" : ""
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
