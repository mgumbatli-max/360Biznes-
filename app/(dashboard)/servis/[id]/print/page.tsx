import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServisDetail } from "@/features/servis/queries";
import { SERVIS_STATUS_LABELS } from "@/features/servis/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { PrintTrigger } from "@/features/servis/components/print-trigger";

export const metadata: Metadata = { title: "Servis qəbz çapı" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function ServisPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SP>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const formatRaw = Array.isArray(sp.format) ? sp.format[0] : sp.format;
  const isThermal = formatRaw === "thermal";
  const isAkt = formatRaw === "akt";

  const s = await getServisDetail(id);
  if (!s) notFound();

  const status = SERVIS_STATUS_LABELS[s.status]?.label ?? s.status;
  const balance = Number(s.temir_xerci ?? 0) - Number(s.musteriden_alinan ?? 0);

  // QR kod — public servis-track linki
  const trackToken = s.zemanetler[0]?.qr_token ?? s.id.slice(-8);
  const qrPayload = `/servis-track/${trackToken}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=0&data=${encodeURIComponent(qrPayload)}`;

  // İki layout: A4 (geniş) vs thermal (80mm)
  const wrapClass = isThermal
    ? "mx-auto bg-white text-black"
    : "mx-auto bg-white p-8 text-black shadow-sm";
  const wrapStyle = isThermal
    ? { width: "80mm", maxWidth: "80mm", padding: "4mm", fontFamily: "monospace", fontSize: "11px" }
    : { maxWidth: "210mm", minHeight: "297mm" };

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: ${isThermal ? "80mm auto" : "A4"}; margin: ${isThermal ? "4mm" : "12mm"}; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: none !important; padding: 0 !important; }
          .page-break { page-break-after: always; break-after: page; }
        }
        .print-card { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      `}</style>

      <div className="no-print mx-auto mb-3 flex max-w-3xl items-center justify-between px-4">
        <a
          href={`/servis/${id}`}
          className="text-sm text-neutral-700 hover:underline"
        >
          ← Geri
        </a>
        <div className="flex gap-2 text-sm">
          {!isThermal ? (
            <a
              href={`/servis/${id}/print?format=thermal`}
              className="rounded-md border border-neutral-400 bg-white px-3 py-1.5 text-neutral-800 hover:bg-neutral-100"
            >
              Termal (80mm)
            </a>
          ) : (
            <a
              href={`/servis/${id}/print`}
              className="rounded-md border border-neutral-400 bg-white px-3 py-1.5 text-neutral-800 hover:bg-neutral-100"
            >
              A4
            </a>
          )}
          <PrintTrigger />
        </div>
      </div>

      <div className={`${wrapClass} print-card`} style={wrapStyle as React.CSSProperties}>
        {isThermal ? (
          <ThermalLayout
            s={s}
            status={status}
            balance={balance}
          />
        ) : isAkt ? (
          <>
            <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-700">
              Mağaza nüsxəsi
            </div>
            <A4Layout s={s} status={status} balance={balance} aktMode qrSrc={qrSrc} />
            <div className="page-break my-8 border-t-2 border-dashed border-neutral-400" />
            <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-700">
              Müştəri nüsxəsi
            </div>
            <A4Layout s={s} status={status} balance={balance} aktMode qrSrc={qrSrc} />
          </>
        ) : (
          <A4Layout s={s} status={status} balance={balance} qrSrc={qrSrc} />
        )}
      </div>
    </div>
  );
}

function A4Layout({
  s,
  status,
  balance,
  aktMode = false,
  qrSrc,
}: {
  s: NonNullable<Awaited<ReturnType<typeof getServisDetail>>>;
  status: string;
  balance: number;
  aktMode?: boolean;
  qrSrc?: string;
}) {
  return (
    <div className="space-y-4 text-[12px]">
      <header className="flex items-start justify-between gap-3 border-b border-neutral-300 pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            {aktMode ? "Servis qəbul aktı" : "Servis qəbul qəbzi"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{s.nomre}</h1>
          {aktMode && (
            <div className="text-[10.5px] text-neutral-600">Qaymə №: {s.nomre}</div>
          )}
          {s.yaradildi && (
            <div className="mt-1 text-[11px] text-neutral-600">
              Qəbul tarixi: {new Date(s.yaradildi).toLocaleString("az-AZ")}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Status</div>
          <div className="text-sm font-semibold">{status}</div>
          {s.texmini_tehvil && (
            <div className="mt-1 text-[11px]">
              Vəd: <b>{formatDate(s.texmini_tehvil)}</b>
            </div>
          )}
        </div>
        {qrSrc && (
          <div className="ml-auto flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={qrSrc} alt="Servis QR" width={88} height={88} className="border border-neutral-300" />
            <div className="mt-0.5 font-mono text-[8.5px] text-neutral-500">{s.nomre}</div>
            <div className="text-[8px] text-neutral-500">İzləmə: scan QR</div>
          </div>
        )}
      </header>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded border border-neutral-300 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Müştəri</div>
          <div className="mt-1 font-semibold">{s.musteri_ad}</div>
          <div className="text-[11px] text-neutral-700">{s.musteri_telefon}</div>
        </div>
        <div className="rounded border border-neutral-300 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Məhsul</div>
          <div className="mt-1 font-semibold">{s.mehsul_ad}</div>
          {s.mehsul_seri_nomresi && (
            <div className="font-mono text-[11px] text-neutral-700">Seriya: {s.mehsul_seri_nomresi}</div>
          )}
          {s.satis_tarixi && (
            <div className="text-[11px] text-neutral-700">Satış: {formatDate(s.satis_tarixi)}</div>
          )}
          {s.servis_defekt_kateq && (
            <div className="mt-1 text-[11px] text-neutral-700">
              Defekt: <b>{s.servis_defekt_kateq.ad}</b>
            </div>
          )}
        </div>
      </section>

      <section className="rounded border border-neutral-300 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Problem təsviri</div>
        <p className="mt-1 whitespace-pre-wrap text-[12px]">{s.problem_tesviri}</p>
      </section>

      {s.komplektasiya && (
        <section className="rounded border border-neutral-300 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Komplektasiya</div>
          <p className="mt-1 whitespace-pre-wrap text-[12px]">{s.komplektasiya}</p>
        </section>
      )}

      <section className="grid grid-cols-3 gap-3">
        <Cell label="Təmir xərci" value={formatMoney(Number(s.temir_xerci ?? 0))} />
        <Cell label="Ödənilib" value={formatMoney(Number(s.musteriden_alinan ?? 0))} />
        <Cell
          label="Qalıq borc"
          value={formatMoney(balance > 0 ? balance : 0)}
          tone={balance > 0 ? "danger" : "ok"}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Qəbul edən</div>
          <div className="font-medium">
            {s.istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler?.ad_soyad ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Texniki</div>
          <div className="font-medium">
            {s.istifadeciler_servis_qeydleri_servis_iscisi_idToistifadeciler?.ad_soyad ?? "—"}
          </div>
        </div>
      </section>

      {aktMode && (
        <section className="rounded border border-neutral-300 p-3 text-[10px] leading-relaxed text-neutral-700">
          <div className="mb-1 font-semibold uppercase tracking-wider text-neutral-600">
            Şərtlər və qaydalar
          </div>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>Servis qaymə müştəri tərəfindən imzalanmaqla təsdiq edilir; məhsulun komplektasiyası yuxarıdakı kimidir.</li>
            <li>Müştəri qaymədə qeyd edilmiş vəd tarixi və qiymət təklifi haqqında məlumatlandırıldığını təsdiq edir.</li>
            <li>Mağazaya verilmiş məhsul qaymə nüsxəsi olmadan geri qaytarılmır.</li>
            <li>Müştəri 30 təqvim günü ərzində təmir olunmuş məhsulu götürmədikdə, mağaza onu məsuliyyət altında saxlamır.</li>
            <li>İlkin diaqnostika sonrası dəqiq qiymət təklifi müştəriyə bildirilir; müştərinin razılığı olmadan əlavə xərc çəkilmir.</li>
            <li>Zəmanət müddəti yalnız mağaza tərəfindən aparılan təmirə şamil olunur (3 ay).</li>
          </ol>
        </section>
      )}

      <section className="grid grid-cols-2 gap-8 pt-10 text-[11px]">
        <SignBox label="Müştəri imzası / tarix" />
        <SignBox label="Mağaza nümayəndəsi / möhür" />
      </section>

      <footer className="border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
        {aktMode
          ? "Bu akt müştəri ilə mağaza arasında bağlanmış olub, hər iki nüsxə bərabər hüquqi qüvvəyə malikdir. Sual yarandıqda QR kodu skan edib statusu izləyə bilərsiniz."
          : "Bu qəbz 2 (iki) nüsxədə tərtib edilmişdir. Müştəri qəbzi göstərmədən məhsul geri qaytarılmır."}
      </footer>
    </div>
  );
}

function ThermalLayout({
  s,
  status,
  balance,
}: {
  s: NonNullable<Awaited<ReturnType<typeof getServisDetail>>>;
  status: string;
  balance: number;
}) {
  return (
    <div className="space-y-2">
      <div className="text-center">
        <div className="text-[10px] uppercase">Servis qəbz</div>
        <div className="text-[14px] font-bold">{s.nomre}</div>
        {s.yaradildi && (
          <div className="text-[10px]">{new Date(s.yaradildi).toLocaleString("az-AZ")}</div>
        )}
      </div>
      <Hr />
      <Line label="Müştəri" value={s.musteri_ad} />
      <Line label="Telefon" value={s.musteri_telefon} />
      <Hr />
      <Line label="Məhsul" value={s.mehsul_ad} />
      {s.mehsul_seri_nomresi && <Line label="Seriya" value={s.mehsul_seri_nomresi} />}
      {s.servis_defekt_kateq && <Line label="Defekt" value={s.servis_defekt_kateq.ad} />}
      <Hr />
      <div>
        <div className="text-[10px]">Problem:</div>
        <div className="whitespace-pre-wrap">{s.problem_tesviri}</div>
      </div>
      {s.komplektasiya && (
        <>
          <Hr />
          <div>
            <div className="text-[10px]">Komplektasiya:</div>
            <div className="whitespace-pre-wrap">{s.komplektasiya}</div>
          </div>
        </>
      )}
      <Hr />
      <Line label="Status" value={status} />
      {s.texmini_tehvil && <Line label="Vəd" value={formatDate(s.texmini_tehvil)} />}
      <Hr />
      <Line label="Xərc" value={formatMoney(Number(s.temir_xerci ?? 0))} />
      <Line label="Ödənilib" value={formatMoney(Number(s.musteriden_alinan ?? 0))} />
      <Line label="Qalıq" value={formatMoney(balance > 0 ? balance : 0)} bold />
      <Hr />
      <Line
        label="Qəbul edən"
        value={s.istifadeciler_servis_qeydleri_qebul_eden_idToistifadeciler?.ad_soyad ?? "—"}
      />
      <div className="pt-6">
        <div>İmza müştəri: ____________</div>
        <div className="pt-4">İmza işçi: _______________</div>
      </div>
      <div className="pt-2 text-center text-[9px]">Qəbz iki nüsxə</div>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  const cls = tone === "danger" ? "text-rose-700" : tone === "ok" ? "text-emerald-700" : "";
  return (
    <div className="rounded border border-neutral-300 p-3">
      <div className="text-[10px] uppercase text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-[14px] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function SignBox({ label }: { label: string }) {
  return (
    <div>
      <div className="border-t border-neutral-400 pt-1 text-center text-[10px] text-neutral-600">
        {label}
      </div>
    </div>
  );
}

function Hr() {
  return <div className="border-t border-dashed border-black/40" />;
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span>{label}:</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
