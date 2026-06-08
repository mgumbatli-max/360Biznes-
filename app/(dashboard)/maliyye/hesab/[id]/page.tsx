import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Wallet, Building2, CreditCard, ArrowDownToLine, ArrowUpFromLine,
  ChevronLeft, Calendar, History,
} from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { getAccountDetail } from "@/features/maliyye/account-queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Hesab detalı" };

const TYPE_LABEL: Record<string, string> = {
  nagd: "Nağd kassa",
  bank: "Bank hesabı",
  kart: "Kart / POS",
  e_pul: "Elektron pul",
  diger: "Digər",
};

const TYPE_ICON: Record<string, typeof Wallet> = {
  nagd: Wallet,
  bank: Building2,
  kart: CreditCard,
};

const Y_N_LABEL: Record<string, string> = {
  daxil: "Mədaxil",
  mexaric: "Məxariç",
  medaxil: "Mədaxil",
};

export default async function HesabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { requireMaliyyePerm } = await import("@/features/maliyye/access-guard");
  await requireMaliyyePerm("hesab.oxu");

  const { id } = await params;
  const h = await getAccountDetail(id);
  if (!h) notFound();

  const Icon = TYPE_ICON[h.nov] ?? Wallet;
  const maxAxis = Math.max(1, ...h.son_30_gun.map((d) => Math.max(d.giris, d.cixis)));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/maliyye/hesab"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Hesablar
        </Link>
      </div>

      <MaliyyeSubNav active="/maliyye/hesab" />

      {/* Hero card */}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{h.ad}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {TYPE_LABEL[h.nov] ?? h.nov}
              {h.bank_adi && ` · ${h.bank_adi}`}
              {h.kart_son4 && ` · **** ${h.kart_son4}`}
              {!h.aktiv && (
                <span className="ml-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                  Qeyri-aktiv
                </span>
              )}
            </p>
            {h.iban && <div className="mt-1 font-mono text-[11px] text-muted-foreground">IBAN: {h.iban}</div>}
            {h.qeyd && <div className="mt-2 text-[11px] text-muted-foreground italic">{h.qeyd}</div>}
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Cari balans</div>
            <div className={`text-3xl font-bold tabular-nums ${h.qaliq < 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatMoney(h.qaliq)}
            </div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">{h.valyuta}</div>
          </div>
        </div>
      </section>

      {/* Period stats */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Bugün giriş" value={formatMoney(h.bugun_giris)} tone="success" icon={ArrowDownToLine} />
        <Stat label="Bugün çıxış" value={formatMoney(h.bugun_cixis)} tone="danger" icon={ArrowUpFromLine} />
        <Stat label="Bu ay giriş" value={formatMoney(h.ay_giris)} tone="success" icon={ArrowDownToLine} />
        <Stat label="Bu ay çıxış" value={formatMoney(h.ay_cixis)} tone="danger" icon={ArrowUpFromLine} />
      </section>

      {/* 30-day sparkbars */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">Son 30 gün — balans hərəkəti</h3>
        </div>
        <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5">
          {h.son_30_gun.map((d) => {
            const gPct = (d.giris / maxAxis) * 100;
            const cPct = (d.cixis / maxAxis) * 100;
            return (
              <div key={d.tarix} className="flex flex-col items-center gap-0.5" title={`${d.tarix}\n+${formatMoney(d.giris)}\n-${formatMoney(d.cixis)}`}>
                <div className="relative h-16 w-full">
                  <div className="absolute bottom-1/2 left-0 right-0 bg-emerald-500/70 rounded-t" style={{ height: `${Math.max(2, gPct * 0.5)}%` }} />
                  <div className="absolute top-1/2 left-0 right-0 bg-rose-500/70 rounded-b" style={{ height: `${Math.max(2, cPct * 0.5)}%` }} />
                </div>
                <div className="text-[8px] text-muted-foreground">{d.tarix.slice(8, 10)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/70" /> Giriş
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-rose-500/70" /> Çıxış
          </span>
        </div>
      </section>

      {/* Operations */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">Son əməliyyatlar</h3>
          <span className="text-[10.5px] text-muted-foreground">(ən son 100)</span>
        </div>
        {h.operations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/40 py-10 text-center text-sm text-muted-foreground">
            Bu hesabda hələ əməliyyat yoxdur
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card/40">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Tarix</th>
                  <th className="px-3 py-2.5">Sənəd</th>
                  <th className="px-3 py-2.5">Tip</th>
                  <th className="px-3 py-2.5">Qarşı tərəf</th>
                  <th className="px-3 py-2.5 text-right">Məbləğ</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {h.operations.map((op) => {
                  const isIn = op.y_n === "daxil" || op.y_n === "medaxil";
                  return (
                    <tr key={op.id} className="border-b border-border/30 hover:bg-secondary/30">
                      <td className="px-3 py-2 text-xs">{op.tarix ? formatDate(op.tarix) : "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{op.sened_nomresi ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          isIn
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-rose-500/15 text-rose-700"
                        }`}>
                          {isIn ? <ArrowDownToLine className="h-2.5 w-2.5" /> : <ArrowUpFromLine className="h-2.5 w-2.5" />}
                          {Y_N_LABEL[op.y_n] ?? op.y_n}
                        </span>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{op.type_kod}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{op.kontragent_ad ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                        {isIn ? "+" : "-"}{formatMoney(Math.abs(op.meblegh))}
                      </td>
                      <td className="px-3 py-2 text-[10.5px]">
                        {op.status === "aktiv" ? (
                          <span className="text-emerald-600">Aktiv</span>
                        ) : op.status === "gozleyen_tesdiq" ? (
                          <span className="text-amber-600">Gözləyir</span>
                        ) : (
                          <span className="text-muted-foreground">{op.status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "success" | "danger";
  icon: typeof Wallet;
}) {
  const cls = tone === "success" ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
