import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { PrintTrigger } from "@/features/servis/components/print-trigger";
import { getEmployeeFullDetail, getEmployeeBordroHistory } from "@/features/iscilier/detail-queries";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Maaş bordrosu (çap)" };
export const dynamic = "force-dynamic";

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

type SP = Record<string, string | string[] | undefined>;

function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function BordroPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SP>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const ay = pickStr(sp, "ay");
  const il = pickStr(sp, "il");

  const [e, bordroHistory] = await Promise.all([
    getEmployeeFullDetail(id),
    getEmployeeBordroHistory(id, 24),
  ]);
  if (!e) notFound();

  // Choose row matching ay+il, default to most recent
  let row = bordroHistory.rows[0];
  if (ay && il) {
    const ayN = Number(ay);
    const ilN = Number(il);
    const found = bordroHistory.rows.find((r) => r.ay === ayN && r.il === ilN);
    if (found) row = found;
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <h1 className="text-xl font-semibold">Bordro yoxdur</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {e.ad_soyad} üçün hələ bordro hesablanmayıb.
        </p>
        <Link href={`/iscilier/${id}`} className="mt-4 inline-block text-sm underline">
          ← Geri
        </Link>
      </div>
    );
  }

  const bonus = row.kpi_bonus + row.manual_bonus;
  const gross = Number(row.detal?.gross ?? row.prorata_maas + bonus);
  const vergi = Number(row.detal?.vergi ?? 0);
  const sosial = Number(row.detal?.sosial_sigorta ?? 0);
  const satisKomisyon = Number(row.detal?.satis_komisyon ?? 0);

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between print:hidden">
        <BackButton fallback={`/iscilier/${id}`} label="Geri" />
        <PrintTrigger />
      </div>

      <div className="mx-auto max-w-3xl bg-white p-10 text-black shadow-sm" style={{ minHeight: "297mm" }}>
        <header className="mb-8 border-b-2 border-neutral-900 pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide">Maaş bordrosu</h1>
          <div className="mt-1 text-sm text-neutral-600">
            {MONTH_LABELS[row.ay - 1]} {row.il}
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">İşçi</div>
            <div className="text-lg font-semibold">{e.ad_soyad}</div>
            {e.vezife && <div className="text-sm text-neutral-700">{e.vezife}</div>}
            {e.fin_kod && <div className="mt-1 text-xs text-neutral-600">FİN: {e.fin_kod}</div>}
            {e.email && <div className="text-xs text-neutral-600">{e.email}</div>}
          </div>
          <div className="text-right">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Bordro №</div>
            <div className="font-mono text-sm">{`BR-${row.il}-${String(row.ay).padStart(2, "0")}-${String(row.id).padStart(4, "0")}`}</div>
            <div className="mt-2 text-xs text-neutral-600">
              Status: <strong>{row.status === "odenilib" ? "Ödənilib" : "Çernovik"}</strong>
            </div>
            {row.odenish_tarixi && (
              <div className="text-xs text-neutral-600">Ödəniş: {formatDate(row.odenish_tarixi)}</div>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 border-b border-neutral-300 pb-1 text-sm font-semibold uppercase tracking-wider">
            Gəlir hesabı
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <Row label="Əsas (aylıq) maaş" value={formatMoney(row.esas_maas)} />
              <Row
                label={`İş günü (${row.ish_gun_faktiki ?? 0}/${row.ish_gun_norma ?? 0})`}
                value={formatMoney(row.prorata_maas)}
                sub
              />
              {bonus > 0 && (
                <>
                  {row.kpi_bonus > 0 && <Row label="KPI bonus" value={formatMoney(row.kpi_bonus)} sub />}
                  {row.manual_bonus > 0 && <Row label="Manual bonus" value={formatMoney(row.manual_bonus)} sub />}
                </>
              )}
              {satisKomisyon > 0 && <Row label="Satış komissiyası" value={formatMoney(satisKomisyon)} sub />}
              <Row label="Brüt cəm" value={formatMoney(gross)} bold />
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 border-b border-neutral-300 pb-1 text-sm font-semibold uppercase tracking-wider">
            Tutulmalar
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {vergi > 0 && <Row label="Gəlir vergisi" value={`− ${formatMoney(vergi)}`} />}
              {sosial > 0 && <Row label="Sosial sığorta" value={`− ${formatMoney(sosial)}`} />}
              {row.cerime > 0 && <Row label="Cərimə" value={`− ${formatMoney(row.cerime)}`} />}
              {row.avans > 0 && <Row label="Avans" value={`− ${formatMoney(row.avans)}`} />}
              {vergi + sosial + row.cerime + row.avans === 0 && (
                <Row label="—" value="—" sub />
              )}
            </tbody>
          </table>
        </section>

        <section className="mt-8 border-t-2 border-neutral-900 pt-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-wider">Net məbləğ</div>
            <div className="text-3xl font-bold tabular-nums">{formatMoney(row.son_meblegh)}</div>
          </div>
        </section>

        {e.bank_ad && (
          <section className="mt-6 text-xs text-neutral-600">
            Ödəniş üsulu: bank köçürmə
            <div>Bank: {e.bank_ad}</div>
            {e.bank_hesab && <div>IBAN/Hesab: {e.bank_hesab}</div>}
          </section>
        )}

        <footer className="mt-12 grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="mb-8 border-b border-neutral-700"></div>
            <div className="text-center text-neutral-600">İşçi imzası</div>
          </div>
          <div>
            <div className="mb-8 border-b border-neutral-700"></div>
            <div className="text-center text-neutral-600">İşəgötürən imzası</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value, sub, bold }: { label: string; value: string; sub?: boolean; bold?: boolean }) {
  return (
    <tr className={sub ? "" : "border-t border-neutral-200"}>
      <td className={`py-1.5 ${sub ? "pl-4 text-xs text-neutral-600" : "font-medium"} ${bold ? "font-semibold" : ""}`}>
        {label}
      </td>
      <td className={`py-1.5 text-right tabular-nums ${sub ? "text-xs text-neutral-600" : ""} ${bold ? "font-semibold" : ""}`}>
        {value}
      </td>
    </tr>
  );
}
