import type { Metadata } from "next";
import Link from "next/link";
import { Users, Phone, Mail, MessageCircle, HandCoins, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { AgingBar } from "@/features/maliyye/components/aging-bar";
import { QuickOpDialog } from "@/features/maliyye/components/quick-op-dialog";
import { NisyePaymentQuick } from "@/features/maliyye/components/nisye-payment-quick";
import { getDebtors, getQuickRefs, getOpenSalesForCustomer } from "@/features/maliyye/queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Debitor (Müştəri borcu)" };

type SearchParams = { q?: string; gecik?: string; sort?: string };

export default async function DebitorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const gecik = Number(sp.gecik ?? 0);
  const sort = sp.sort ?? "borc_h";

  const [allRows, refs] = await Promise.all([getDebtors(), getQuickRefs()]);
  // Pre-fetch open sales for the top-N debtors so the per-row "Ödə" button can
  // populate a useful qaime list without further data round-trips.
  const TOP = 25;
  const openSalesMap = new Map<string, Awaited<ReturnType<typeof getOpenSalesForCustomer>>>();
  await Promise.all(
    allRows.slice(0, TOP).map(async (r) => {
      openSalesMap.set(r.id, await getOpenSalesForCustomer(r.id, 30));
    }),
  );

  let rows = allRows;
  if (q) {
    rows = rows.filter((r) =>
      [r.ad, r.telefon, r.voen, r.menecer_ad].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }
  if (gecik > 0) rows = rows.filter((r) => r.gun_kecdi >= gecik);

  // Sort
  rows = [...rows].sort((a, b) => {
    if (sort === "borc_h") return b.borc - a.borc;
    if (sort === "borc_l") return a.borc - b.borc;
    if (sort === "gun_h") return b.gun_kecdi - a.gun_kecdi;
    if (sort === "ad") return a.ad.localeCompare(b.ad, "az");
    return 0;
  });

  // Aggregates
  const cemi = rows.reduce((s, r) => s + r.borc, 0);
  const cari = rows.filter((r) => r.gun_kecdi <= 30).reduce((s, r) => s + r.borc, 0);
  const orta = rows.filter((r) => r.gun_kecdi > 30 && r.gun_kecdi <= 60).reduce((s, r) => s + r.borc, 0);
  const kritik = rows.filter((r) => r.gun_kecdi > 60).reduce((s, r) => s + r.borc, 0);
  const limAsib = rows.filter((r) => r.limit_asib).length;
  const ortaBorc = rows.length ? cemi / rows.length : 0;
  const top = rows[0];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debitor — müştəri borcları</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bizə borclu olan müştərilər.</p>
        </div>
        <Link
          href="/maliyye/debitor?new=musteri_odenish"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <HandCoins className="h-3.5 w-3.5" /> Ödəniş qəbul et
        </Link>
      </header>

      <MaliyyeSubNav active="/maliyye/debitor" />

      {/* Stat hero */}
      <section className="grid grid-cols-2 gap-2 rounded-xl border-y border-border bg-card/30 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Cəmi debitor" value={formatMoney(cemi)} tone="success" />
        <Stat label="Müştəri sayı" value={String(rows.length)} />
        <Stat label="Cari (0-30)" value={formatMoney(cari)} />
        <Stat label="Gecikmiş (30-60)" value={formatMoney(orta)} tone="warning" />
        <Stat label="Kritik (60+)" value={formatMoney(kritik)} tone="danger" />
        <Stat label="Limit aşan" value={String(limAsib)} tone={limAsib > 0 ? "danger" : "neutral"} />
        <Stat label="Top debitor" value={top ? top.ad.slice(0, 20) : "—"} tone="info" small />
      </section>

      <div>
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Yaş dağılımı (aging)
        </div>
        <AgingBar cari={cari} orta={orta} kritik={kritik} />
        <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
          <span><span className="inline-block h-2 w-2 rounded-sm bg-success" /> 0-30 gün</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-warning" /> 31-60 gün</span>
          <span><span className="inline-block h-2 w-2 rounded-sm bg-danger" /> 60+ gün</span>
          {ortaBorc > 0 && <span className="ml-auto">Ortalama: {formatMoney(ortaBorc)}</span>}
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/30 p-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="🔍 Ad, telefon, VÖEN, menecer..."
          className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select name="gecik" defaultValue={String(gecik || "")} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Bütün borclar</option>
          <option value="30">30+ gün gecikən</option>
          <option value="60">60+ gün gecikən</option>
          <option value="90">90+ gün gecikən</option>
        </select>
        <select name="sort" defaultValue={sort} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="borc_h">Borc ↓</option>
          <option value="borc_l">Borc ↑</option>
          <option value="gun_h">Gün ↓</option>
          <option value="ad">Ad üzrə</option>
        </select>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Filtrlə</button>
      </form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">{q || gecik ? "Filterə uyğun borc yoxdur" : "Borclu müştəri yoxdur"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{!q && !gecik && "Bütün müştərilər tam ödəyiblər."}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Müştəri</th>
                <th className="px-3 py-2.5">Telefon</th>
                <th className="px-3 py-2.5">Menecer</th>
                <th className="px-3 py-2.5 text-right">Borc</th>
                <th className="px-3 py-2.5 text-right">Limit</th>
                <th className="px-3 py-2.5">Son alver</th>
                <th className="px-3 py-2.5 text-right">Gün</th>
                <th className="px-3 py-2.5 text-right">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tone =
                  r.gun_kecdi > 60 ? "text-danger" : r.gun_kecdi > 30 ? "text-warning" : "text-muted-foreground";
                const rowBg =
                  r.gun_kecdi > 60 ? "bg-danger/5" : r.gun_kecdi > 30 ? "bg-warning/5" : "";
                const waNumber = r.whatsapp ?? r.telefon ?? "";
                const waDigits = waNumber.replace(/[^0-9]/g, "");
                const waText = encodeURIComponent(`Salam, ${r.ad}! Borcunuz: ${formatMoney(r.borc)} ₼.`);
                return (
                  <tr key={r.id} className={`border-b border-border/30 ${rowBg}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.ad}</div>
                      {r.voen && <div className="text-[11px] text-muted-foreground">VÖEN: {r.voen}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.telefon ? (
                        <a href={`tel:${r.telefon}`} className="inline-flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" />
                          {r.telefon}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {r.email && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Mail className="h-3 w-3" /> {r.email}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{r.menecer_ad ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-success">{formatMoney(r.borc)}</td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {r.borc_limiti != null ? (
                        <>
                          {formatMoney(r.borc_limiti)}
                          {r.limit_asib && (
                            <Badge variant="outline" className="ml-1 border-danger/30 bg-danger/10 px-1 py-0 text-[9px] text-danger">
                              aşıb
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.son_alver ? formatDate(r.son_alver) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums text-xs font-semibold ${tone}`}>
                      {r.son_alver ? r.gun_kecdi : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <NisyePaymentQuick
                          musteriId={r.id}
                          ad={r.ad}
                          borc={r.borc}
                          hesablar={refs.hesablar}
                          openSales={openSalesMap.get(r.id) ?? []}
                          variant="icon"
                        />
                        {waDigits && (
                          <a
                            href={`https://wa.me/${waDigits}?text=${waText}`}
                            target="_blank"
                            rel="noopener"
                            title="WhatsApp xatırlatma"
                            className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-secondary"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Link
                          href={`/musteriler?open=${r.id}`}
                          title="Profil"
                          className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-secondary"
                        >
                          <User className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border/60 bg-secondary/40 text-xs">
              <tr>
                <td colSpan={3} className="px-3 py-2 font-semibold">Cəmi ({rows.length})</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-success">{formatMoney(cemi)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <QuickOpDialog
        hesablar={refs.hesablar}
        iscilier={refs.iscilier}
        kontragentler={refs.kontragentler}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  small,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
  small?: boolean;
}) {
  const cls =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-danger" :
    tone === "warning" ? "text-warning" :
    tone === "info" ? "text-info" : "";
  return (
    <div className="border-r border-border/40 px-4 py-3 last:border-r-0">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${small ? "text-sm" : "text-lg"} font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
