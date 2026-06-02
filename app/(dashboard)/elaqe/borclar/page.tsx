import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  CreditCard,
  AlertTriangle,
  Hourglass,
  ArrowRight,
  ExternalLink,
  Phone,
} from "lucide-react";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { PaymentDialog } from "@/features/elaqe/components/payment-dialog";
import { BorcReminderDialog } from "@/features/elaqe/components/borc-reminder-dialog";
import { getActiveUsers } from "@/features/crm/leadler-queries";
import { Badge } from "@/components/ui/badge";
import { getDebtorList, getCreditorList } from "@/features/elaqe/queries";
import { NisyePaymentQuick } from "@/features/maliyye/components/nisye-payment-quick";
import { getQuickRefs, getOpenSalesForCustomer } from "@/features/maliyye/queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Borc mərkəzi" };

export default async function BorclarPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; mod?: string }>;
}) {
  const { requireElaqePerm } = await import("@/features/elaqe/access-guard");
  await requireElaqePerm("elaqe.borc");

  const sp = await searchParams;
  const sortKey = sp.sort ?? "borc";
  const mod = sp.mod === "kreditor" ? "kreditor" : "debitor";

  if (mod === "kreditor") {
    const { items, totals } = await getCreditorList();
    const sorted = [...items].sort((a, b) => {
      if (sortKey === "yas") return (b.yas_gun ?? -1) - (a.yas_gun ?? -1);
      return b.borc - a.borc;
    });
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Borc mərkəzi — Kreditor</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Biz təchizatçılara borcluyuq. Bu siyahıda mənfi balanslı təchizatçılar göstərilir.
            </p>
          </div>
          <Link href="/elaqe" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-3 w-3 rotate-180" /> Hamısı
          </Link>
        </header>

        <div className="inline-flex rounded-lg bg-secondary/60 p-1">
          <Link
            href="/elaqe/borclar"
            className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
          >
            Debitor (bizə borc)
          </Link>
          <span className="rounded-md bg-background px-3 py-1 text-xs font-semibold shadow-sm">
            Kreditor (biz borcluyuq)
          </span>
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={CreditCard}
            label="Cəmi kreditor"
            value={formatMoney(totals.cemi)}
            subline={`${totals.sayi} təchizatçı`}
            tone={totals.cemi > 0 ? "danger" : "neutral"}
          />
          <KpiCard
            icon={Hourglass}
            label="30+ gün gecikmiş"
            value={formatMoney(totals.gecikmis_30)}
            subline="Son alışdan"
            tone={totals.gecikmis_30 > 0 ? "danger" : "neutral"}
          />
          <KpiCard icon={Users} label="Sıra" value={String(totals.sayi)} subline="Mənfi balans" />
          <KpiCard icon={AlertTriangle} label="Ortalama" value={formatMoney(totals.sayi > 0 ? totals.cemi / totals.sayi : 0)} subline="Təchizatçı başına" />
        </section>

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/40 p-2">
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Sırala:</span>
          <SortLink current={sortKey} value="borc" label="Borc məbləği" mod="kreditor" />
          <SortLink current={sortKey} value="yas" label="Yaş (gün)" mod="kreditor" />
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-success/15">
              <CreditCard className="h-5 w-5 text-success" />
            </div>
            <h3 className="font-semibold">Kreditor yoxdur</h3>
            <p className="mt-1 text-sm text-muted-foreground">Heç bir təchizatçıya borcumuz yoxdur.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Təchizatçı</th>
                  <th className="px-3 py-2.5">Telefon</th>
                  <th className="px-3 py-2.5">VÖEN</th>
                  <th className="px-3 py-2.5 text-right">Borc</th>
                  <th className="px-3 py-2.5">Son alış</th>
                  <th className="px-3 py-2.5">Yaş</th>
                  <th className="px-3 py-2.5 text-right w-28">Əməl</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => {
                  const old30 = d.yas_gun !== null && d.yas_gun > 30;
                  return (
                    <tr key={d.id} className="border-b border-border/30 hover:bg-secondary/40">
                      <td className="px-3 py-2.5">
                        <Link href={`/elaqe/techizatcilar/${d.id}`} className="font-medium hover:text-primary-light">
                          {d.ad}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {d.telefon ? (
                          <a href={`tel:${d.telefon}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary-light">
                            <Phone className="h-3 w-3" /> {d.telefon}
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{d.voen ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-danger">{formatMoney(d.borc)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {d.son_alis_nomre ? (
                          <div className="font-mono">
                            {d.son_alis_nomre}
                            {d.son_alis_tarix && <div className="opacity-70">{formatDate(d.son_alis_tarix)}</div>}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {d.yas_gun !== null ? (
                          <Badge variant="outline" className={`text-[10px] ${old30 ? "text-danger" : ""}`}>
                            {d.yas_gun} gün
                          </Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/elaqe/techizatcilar/${d.id}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                            title="Profil"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
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

  const [{ items, totals }, refs, staffOptions] = await Promise.all([
    getDebtorList(),
    getQuickRefs(),
    getActiveUsers(),
  ]);
  // Pre-fetch open sales for top debtors (cap to avoid huge bulk fetch)
  const TOP = 25;
  const openSalesMap = new Map<string, Awaited<ReturnType<typeof getOpenSalesForCustomer>>>();
  await Promise.all(
    items.slice(0, TOP).map(async (r) => {
      openSalesMap.set(r.id, await getOpenSalesForCustomer(r.id, 30));
    }),
  );

  const sorted = [...items].sort((a, b) => {
    if (sortKey === "yas") return (b.yas_gun ?? -1) - (a.yas_gun ?? -1);
    if (sortKey === "limit") return (b.limit_istifade ?? 0) - (a.limit_istifade ?? 0);
    return b.borc - a.borc;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Borc mərkəzi — Debitor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bizə borclu olan müştərilər, ödəniş və yaş analizi.
          </p>
        </div>
        <Link href="/elaqe" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-3 w-3 rotate-180" /> Hamısı
        </Link>
      </header>

      <div className="inline-flex rounded-lg bg-secondary/60 p-1">
        <span className="rounded-md bg-background px-3 py-1 text-xs font-semibold shadow-sm">
          Debitor (bizə borc)
        </span>
        <Link
          href="/elaqe/borclar?mod=kreditor"
          className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
        >
          Kreditor (biz borcluyuq)
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={CreditCard}
          label="Cəmi borc"
          value={formatMoney(totals.cemi)}
          subline={`${totals.sayi} kontragent`}
          tone={totals.cemi > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={Hourglass}
          label="30+ gün gecikmiş"
          value={formatMoney(totals.gecikmis_30)}
          subline="Son əlaqədən"
          tone={totals.gecikmis_30 > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Limit aşıb"
          value={String(totals.kritik_limit_asib)}
          subline="Kritik müştərilər"
          tone={totals.kritik_limit_asib > 0 ? "danger" : "neutral"}
        />
        <KpiCard
          icon={Users}
          label="Sıra"
          value={String(totals.sayi)}
          subline="Borclu kontragent"
        />
      </section>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/40 p-2">
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Sırala:</span>
        <SortLink current={sortKey} value="borc" label="Borc məbləği" />
        <SortLink current={sortKey} value="yas" label="Yaş (gün)" />
        <SortLink current={sortKey} value="limit" label="Limit istifadəsi" />
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-success/15">
            <CreditCard className="h-5 w-5 text-success" />
          </div>
          <h3 className="font-semibold">Borc yoxdur</h3>
          <p className="mt-1 text-sm text-muted-foreground">Bütün müştərilərin balansı sıfırdır.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Ad</th>
                <th className="px-3 py-2.5">Əlaqə</th>
                <th className="px-3 py-2.5 text-right">Borc</th>
                <th className="px-3 py-2.5 text-right">Limit</th>
                <th className="px-3 py-2.5 text-right">İstifadə</th>
                <th className="px-3 py-2.5">Yaş</th>
                <th className="px-3 py-2.5">Son satış</th>
                <th className="px-3 py-2.5 text-right w-40">Əməl</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const overLimit = d.borc_limiti !== null && d.borc_limiti > 0 && d.borc > d.borc_limiti;
                const old30 = d.yas_gun !== null && d.yas_gun > 30;
                return (
                  <tr key={d.id} className="border-b border-border/30 hover:bg-secondary/40">
                    <td className="px-3 py-2.5">
                      <Link href={`/elaqe/musteriler/${d.id}`} className="font-medium hover:text-primary-light">
                        {d.ad}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {d.telefon ? (
                        <a href={`tel:${d.telefon}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary-light">
                          <Phone className="h-3 w-3" /> {d.telefon}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-warning">
                      {formatMoney(d.borc)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                      {d.borc_limiti !== null ? formatMoney(d.borc_limiti) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {d.limit_istifade !== null ? (
                        <span className={overLimit ? "font-semibold text-danger" : "text-muted-foreground"}>
                          {d.limit_istifade}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {d.yas_gun !== null ? (
                        <Badge variant="outline" className={`text-[10px] ${old30 ? "text-danger" : ""}`}>
                          {d.yas_gun} gün
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {d.son_satis_nomre ? (
                        <div className="font-mono">
                          {d.son_satis_nomre}
                          {d.son_satis_tarix && <div className="opacity-70">{formatDate(d.son_satis_tarix)}</div>}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <BorcReminderDialog
                          kontragentId={d.id}
                          ad={d.ad}
                          telefon={d.telefon}
                          borc={d.borc}
                          yasGun={d.yas_gun}
                          staffOptions={staffOptions}
                        />
                        <NisyePaymentQuick
                          musteriId={d.id}
                          ad={d.ad}
                          borc={d.borc}
                          hesablar={refs.hesablar}
                          openSales={openSalesMap.get(d.id) ?? []}
                          variant="button"
                        />
                        <PaymentDialog kontragentId={d.id} ad={d.ad} maxAmount={d.borc} variant="button" />
                        <Link
                          href={`/elaqe/musteriler/${d.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="Profil"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
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

function SortLink({ current, value, label, mod }: { current: string; value: string; label: string; mod?: string }) {
  const active = current === value;
  const href = mod
    ? `/elaqe/borclar?mod=${mod}&sort=${value}`
    : `/elaqe/borclar?sort=${value}`;
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex h-7 items-center rounded-full border border-primary/40 bg-primary/15 px-2.5 text-xs font-medium text-primary-light"
          : "inline-flex h-7 items-center rounded-full border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}
