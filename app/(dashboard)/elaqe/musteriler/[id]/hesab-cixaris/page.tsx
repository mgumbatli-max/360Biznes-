import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone, Mail, FileText, ChevronLeft, ArrowDownToLine, ArrowUpFromLine,
  RotateCcw, Wallet, Trash2, MessageCircle, FileDown,
} from "lucide-react";
import { getCustomerStatement, type StatementRow } from "@/features/maliyye/customer-statement";
import { formatMoney, formatDate } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Hesab çıxarışı" };

const NOV_META: Record<StatementRow["nov"], { label: string; icon: typeof FileText; tone: string }> = {
  satish: { label: "Nisyə satış", icon: ArrowDownToLine, tone: "border-rose-500/40 bg-rose-500/10 text-rose-700" },
  odenis: { label: "Ödəniş", icon: ArrowUpFromLine, tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" },
  qaytarma: { label: "Qaytarma", icon: RotateCcw, tone: "border-amber-500/40 bg-amber-500/10 text-amber-700" },
  borc_silinme: { label: "Borc silinmə", icon: Trash2, tone: "border-sky-500/40 bg-sky-500/10 text-sky-700" },
  avans: { label: "Avans tətbiqi", icon: Wallet, tone: "border-violet-500/40 bg-violet-500/10 text-violet-700" },
};

type SP = { from?: string; to?: string };

function parseDate(s: string | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return new Date(s);
}

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const from = parseDate(sp.from);
  const to = parseDate(sp.to);

  const data = await getCustomerStatement({ musteri_id: id, from, to });
  if (!data) notFound();

  const waText = encodeURIComponent(
    `Salam, ${data.musteri_ad}!\nHesab çıxarışınız:\nBaşlanğıc qalıq: ${formatMoney(data.baslangic_qaliq)}\nDövr debet: ${formatMoney(data.cemi_debet)}\nDövr kredit: ${formatMoney(data.cemi_kredit)}\nSon qalıq: ${formatMoney(data.son_qaliq)}\n\nƏtraflı: ${data.rows.length} əməliyyat`,
  );
  const waDigits = (data.telefon ?? "").replace(/[^0-9]/g, "");

  return (
    <div className="mx-auto max-w-7xl space-y-5 print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/elaqe/musteriler/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Müştəri kartına qayıt
        </Link>
        <div className="flex items-center gap-2">
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}?text=${waText}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          )}
          <a
            href={`/api/musteri/${id}/hesab-cixaris.csv${sp.from || sp.to ? `?${new URLSearchParams(sp as Record<string, string>).toString()}` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-secondary"
          >
            <FileDown className="h-3.5 w-3.5" /> CSV
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Header */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.musteri_ad}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {data.telefon && (
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {data.telefon}</span>
              )}
              {data.email && (
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {data.email}</span>
              )}
              {data.voen && <span>VÖEN: {data.voen}</span>}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Dövr: {formatDate(data.donem_baslama)} — {formatDate(data.donem_bitme)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Son qalıq</div>
            <div className={`text-3xl font-bold tabular-nums ${data.son_qaliq > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatMoney(data.son_qaliq)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {data.son_qaliq > 0 ? "Müştəri bizə borcludur" : data.son_qaliq < 0 ? "Avans qalığı" : "Hesab qapalıdır"}
            </div>
          </div>
        </div>
      </section>

      {/* Filter */}
      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card/40 p-3 print:hidden">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Başlanğıc</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Son</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          />
        </div>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
          Filtrə
        </button>
      </form>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Başlanğıc qalıq" value={formatMoney(data.baslangic_qaliq)} />
        <Stat label="Dövr debet (satış)" value={formatMoney(data.cemi_debet)} tone="danger" />
        <Stat label="Dövr kredit (ödəniş)" value={formatMoney(data.cemi_kredit)} tone="success" />
        <Stat label="Son qalıq" value={formatMoney(data.son_qaliq)} tone={data.son_qaliq > 0 ? "danger" : "success"} />
      </section>

      {/* Tarixçə */}
      {data.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/40 py-14 text-center text-sm text-muted-foreground">
          Bu dövrdə əməliyyat yoxdur
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-secondary/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Tarix</th>
                <th className="px-3 py-2.5">Növ</th>
                <th className="px-3 py-2.5">Sənəd №</th>
                <th className="px-3 py-2.5">Təsviri</th>
                <th className="px-3 py-2.5 text-right">Debet</th>
                <th className="px-3 py-2.5 text-right">Kredit</th>
                <th className="px-3 py-2.5 text-right">Qalıq</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30 bg-secondary/20">
                <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={6}>
                  Dövr başlanğıcında qalıq
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {formatMoney(data.baslangic_qaliq)}
                </td>
              </tr>
              {data.rows.map((r, i) => {
                const meta = NOV_META[r.nov];
                const Icon = meta.icon;
                return (
                  <tr key={i} className="border-b border-border/30 hover:bg-secondary/30">
                    <td className="px-3 py-2 text-xs">{formatDate(r.tarix)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${meta.tone}`}>
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {r.ref_link ? (
                        <Link href={r.ref_link} className="hover:text-primary hover:underline">{r.sened_nomresi}</Link>
                      ) : (
                        r.sened_nomresi
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.tesvir}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.debet > 0 ? "font-semibold text-rose-600" : "text-muted-foreground"}`}>
                      {r.debet > 0 ? formatMoney(r.debet) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.kredit > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}`}>
                      {r.kredit > 0 ? formatMoney(r.kredit) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.qaliq > 0 ? "text-rose-600" : r.qaliq < 0 ? "text-emerald-600" : ""}`}>
                      {formatMoney(r.qaliq)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border/60 bg-secondary/40 text-xs">
              <tr>
                <td colSpan={4} className="px-3 py-2 font-semibold">Cəmi ({data.rows.length} əməliyyat)</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-600">{formatMoney(data.cemi_debet)}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-600">{formatMoney(data.cemi_kredit)}</td>
                <td className={`px-3 py-2 text-right font-bold tabular-nums ${data.son_qaliq > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {formatMoney(data.son_qaliq)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const cls = tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-rose-600" : "";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
