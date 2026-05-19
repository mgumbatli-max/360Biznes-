import type { Metadata } from "next";
import Link from "next/link";
import { Truck, Phone, MessageCircle, Banknote, User } from "lucide-react";
import { MaliyyeSubNav } from "@/components/maliyye-subnav";
import { AgingBar } from "@/features/maliyye/components/aging-bar";
import { QuickOpDialog } from "@/features/maliyye/components/quick-op-dialog";
import { getCreditors, getQuickRefs } from "@/features/maliyye/queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Kreditor (Təchizatçı borcu)" };
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; gecik?: string; sort?: string };

export default async function KreditorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const gecik = Number(sp.gecik ?? 0);
  const sort = sp.sort ?? "borc_h";

  const [allRows, refs] = await Promise.all([getCreditors(), getQuickRefs()]);

  let rows = allRows;
  if (q) {
    rows = rows.filter((r) =>
      [r.ad, r.telefon, r.voen].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }
  if (gecik > 0) rows = rows.filter((r) => r.gun_kecdi >= gecik);

  rows = [...rows].sort((a, b) => {
    if (sort === "borc_h") return b.borc - a.borc;
    if (sort === "borc_l") return a.borc - b.borc;
    if (sort === "gun_h") return b.gun_kecdi - a.gun_kecdi;
    if (sort === "ad") return a.ad.localeCompare(b.ad, "az");
    return 0;
  });

  const cemi = rows.reduce((s, r) => s + r.borc, 0);
  const cari = rows.filter((r) => r.gun_kecdi <= 30).reduce((s, r) => s + r.borc, 0);
  const orta = rows.filter((r) => r.gun_kecdi > 30 && r.gun_kecdi <= 60).reduce((s, r) => s + r.borc, 0);
  const kritik = rows.filter((r) => r.gun_kecdi > 60).reduce((s, r) => s + r.borc, 0);
  const ortaBorc = rows.length ? cemi / rows.length : 0;
  const top = rows[0];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kreditor — təchizatçı borcları</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bizim təchizatçılara borclu olduğumuz məbləğ.</p>
        </div>
        <Link
          href="/maliyye/kreditor?new=techizatci_odenish"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Banknote className="h-3.5 w-3.5" /> Ödəniş et
        </Link>
      </header>

      <MaliyyeSubNav active="/maliyye/kreditor" />

      {/* Stat hero */}
      <section className="grid grid-cols-2 gap-2 rounded-xl border-y border-border bg-card/30 md:grid-cols-3 lg:grid-cols-7">
        <Stat label="Cəmi kreditor" value={formatMoney(cemi)} tone="danger" />
        <Stat label="Təchizatçı sayı" value={String(rows.length)} />
        <Stat label="Cari (0-30)" value={formatMoney(cari)} />
        <Stat label="Gecikmiş (30-60)" value={formatMoney(orta)} tone="warning" />
        <Stat label="Kritik (60+)" value={formatMoney(kritik)} tone="danger" />
        <Stat label="Ortalama borc" value={formatMoney(ortaBorc)} />
        <Stat label="Top kreditor" value={top ? top.ad.slice(0, 20) : "—"} tone="info" small />
      </section>

      <div>
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Yaş dağılımı (aging)
        </div>
        <AgingBar cari={cari} orta={orta} kritik={kritik} />
      </div>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/30 p-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="🔍 Ad, telefon, VÖEN..."
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
            <Truck className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">{q || gecik ? "Filterə uyğun borc yoxdur" : "Borc yoxdur"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{!q && !gecik && "Bütün təchizatçılarla hesablaşma tamamdır."}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Təchizatçı</th>
                <th className="px-3 py-2.5">Telefon</th>
                <th className="px-3 py-2.5">VÖEN</th>
                <th className="px-3 py-2.5 text-right">Borc</th>
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
                const waText = encodeURIComponent(`Salam, ${r.ad}! Ödəniş tezliklə hazırlanacaq.`);
                return (
                  <tr key={r.id} className={`border-b border-border/30 ${rowBg}`}>
                    <td className="px-3 py-2.5 font-medium">{r.ad}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.telefon ? (
                        <a href={`tel:${r.telefon}`} className="inline-flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" /> {r.telefon}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.voen ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-danger">{formatMoney(r.borc)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.son_alver ? formatDate(r.son_alver) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums text-xs font-semibold ${tone}`}>
                      {r.son_alver ? r.gun_kecdi : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/maliyye/kreditor?new=techizatci_odenish&kontragent=${r.id}`}
                          title="Ödə"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary-light hover:bg-primary/20"
                        >
                          <Banknote className="h-3 w-3" /> Ödə
                        </Link>
                        {waDigits && (
                          <a
                            href={`https://wa.me/${waDigits}?text=${waText}`}
                            target="_blank"
                            rel="noopener"
                            title="WhatsApp"
                            className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-secondary"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Link
                          href={`/techiazatcilar?open=${r.id}`}
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
                <td className="px-3 py-2 text-right font-bold tabular-nums text-danger">{formatMoney(cemi)}</td>
                <td colSpan={3}></td>
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
