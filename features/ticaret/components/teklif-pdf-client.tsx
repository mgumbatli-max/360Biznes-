"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatMoney } from "@/lib/utils";

type Line = {
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  endirim_faiz: number;
};

type QuoteData = {
  musteri_ad: string | null;
  tarix: string;
  lines: Line[];
  endirim: number;
  catdirma: number;
  vat: number;
  vat_faiz: number;
  son_mebleg: number;
  valyuta: string;
  musteri_qeyd: string | null;
};

export function TeklifPdfClient() {
  const sp = useSearchParams();
  const [data, setData] = useState<QuoteData | null>(null);

  useEffect(() => {
    const d = sp.get("d");
    if (!d) return;
    try {
      const decoded = JSON.parse(decodeURIComponent(d)) as QuoteData;
      setData(decoded);
      // Auto open print dialog after a tick
      setTimeout(() => window.print(), 400);
    } catch {
      /* ignore */
    }
  }, [sp]);

  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Məlumat yüklənir...
      </div>
    );
  }

  const umumi = data.lines.reduce(
    (s, l) => s + l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100),
    0,
  );

  return (
    <div className="mx-auto max-w-3xl p-8 font-sans text-sm text-black bg-white print:p-0">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex justify-end gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-md border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100"
        >
          Çap et
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-gray-400 px-3 py-1 text-xs hover:bg-gray-100"
        >
          Bağla
        </button>
      </div>

      <header className="mb-6 flex items-start justify-between border-b-2 border-gray-800 pb-3">
        <div>
          <h1 className="text-2xl font-bold">TƏKLİF / QUOTE</h1>
          <div className="text-xs text-gray-500">Cari qiymət təklifi</div>
        </div>
        <div className="text-right text-xs">
          <div>Tarix: <strong>{data.tarix}</strong></div>
          <div>Valyuta: <strong>{data.valyuta}</strong></div>
        </div>
      </header>

      <section className="mb-4">
        <div className="text-xs uppercase tracking-wider text-gray-500">Müştəri</div>
        <div className="font-semibold">{data.musteri_ad ?? "—"}</div>
      </section>

      <table className="mb-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-gray-800 text-left">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">Məhsul</th>
            <th className="px-2 py-1">Kod</th>
            <th className="px-2 py-1 text-right">Miqdar</th>
            <th className="px-2 py-1 text-right">Qiymət</th>
            <th className="px-2 py-1 text-right">End %</th>
            <th className="px-2 py-1 text-right">Cəm</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => {
            const total = l.miqdar * l.qiymet * (1 - l.endirim_faiz / 100);
            return (
              <tr key={i} className="border-b border-gray-300">
                <td className="px-2 py-1">{i + 1}</td>
                <td className="px-2 py-1">{l.ad}</td>
                <td className="px-2 py-1">{l.kod ?? ""}</td>
                <td className="px-2 py-1 text-right">{l.miqdar}</td>
                <td className="px-2 py-1 text-right">{formatMoney(l.qiymet)}</td>
                <td className="px-2 py-1 text-right">{l.endirim_faiz}%</td>
                <td className="px-2 py-1 text-right font-semibold">{formatMoney(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="ml-auto mb-4 w-72 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Cəm</span>
          <span>{formatMoney(umumi)}</span>
        </div>
        {data.endirim > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Endirim</span>
            <span>- {formatMoney(data.endirim)}</span>
          </div>
        )}
        {data.vat > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">ƏDV {data.vat_faiz}%</span>
            <span>+ {formatMoney(data.vat)}</span>
          </div>
        )}
        {data.catdirma > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Çatdırılma</span>
            <span>+ {formatMoney(data.catdirma)}</span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t-2 border-gray-800 pt-1 text-base font-bold">
          <span>Yekun</span>
          <span>{formatMoney(data.son_mebleg)} {data.valyuta}</span>
        </div>
      </section>

      {data.musteri_qeyd && (
        <section className="rounded border border-gray-300 bg-gray-50 p-3 text-xs">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Qeyd</div>
          <div className="whitespace-pre-line">{data.musteri_qeyd}</div>
        </section>
      )}

      <footer className="mt-8 text-center text-[10px] text-gray-400">
        Bu sənəd təklif xarakterlidir; faktura/satış sənədi deyil. Təklif 7 gün etibarlıdır.
      </footer>
    </div>
  );
}
