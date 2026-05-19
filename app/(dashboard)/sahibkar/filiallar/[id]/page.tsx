import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin, Phone, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { getBranchDetail } from "@/features/sahibkar/owner-queries";
import { BranchDialog } from "@/features/sahibkar/components/branch-dialog";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Filial detalı" };
export const dynamic = "force-dynamic";

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSahibkarSession();
  const { id } = await params;
  const filialId = Number(id);
  if (!Number.isFinite(filialId)) notFound();

  const data = await getBranchDetail(filialId);
  if (!data) notFound();
  const { branch, sales_total, sales_count, expenses_total, users } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link href="/sahibkar/filiallar" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Filiallar
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{branch.ad}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {branch.seh_r ? <span><MapPin className="inline h-3 w-3" /> {branch.seh_r}</span> : null}
              {branch.telefon ? <span><Phone className="inline h-3 w-3" /> {branch.telefon}</span> : null}
              <Badge variant="outline" className="text-[10px]">{branch.tip ?? "magaza"}</Badge>
            </div>
          </div>
        </div>
        <BranchDialog filial={{ id: branch.id, ad: branch.ad, unvan: branch.unvan, telefon: branch.telefon, seh_r: branch.seh_r, tip: branch.tip }} />
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard icon={Building2} label="Bu ay satış" value={formatMoney(sales_total)} subline={`${sales_count} sifariş`} tone="success" />
        <KpiCard icon={Building2} label="Bu ay xərc" value={formatMoney(expenses_total)} tone="warning" />
        <KpiCard icon={Users} label="İstifadəçi" value={String(users.length)} />
      </section>

      <Card className="glass">
        <CardContent className="py-4">
          <h3 className="mb-3 text-sm font-semibold">İstifadəçilər</h3>
          {users.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bu filiala bağlı istifadəçi yoxdur.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {users.map((u) => u ? (
                <li key={u.id} className="flex items-center justify-between py-2">
                  <Link href={`/iscilier/${u.id}`} className="text-sm font-medium hover:text-primary-light">{u.ad_soyad}</Link>
                  <span className="text-xs text-muted-foreground">{u.vezife ?? "—"}</span>
                </li>
              ) : null)}
            </ul>
          )}
        </CardContent>
      </Card>

      {branch.qeyd ? (
        <Card className="glass">
          <CardContent className="py-4">
            <h3 className="mb-2 text-sm font-semibold">Qeyd</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{branch.qeyd}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
