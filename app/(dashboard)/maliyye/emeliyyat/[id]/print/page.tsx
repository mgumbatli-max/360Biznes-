import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { UniversalPrintControls } from "@/features/shared/print-controls";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Maliyyə əməliyyatı" };

async function getCompany() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.sahibkarlar.findUnique({
      where: { id: sahibkarId },
      select: { ad: true, voen: true, telefon: true, unvan: true, loqo_url: true, email: true },
    });
  });
}

async function getOperation(id: string) {
  return withTenant(async () =>
    prisma.finance_operations.findUnique({
      where: { id },
      include: {
        finance_operation_types: { select: { ad: true, qrup: true, emoji: true } },
        maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: {
          select: { ad: true, nov: true, valyuta: true },
        },
        maliye_hesablari_finance_operations_hesab_id2Tomaliye_hesablari: {
          select: { ad: true, nov: true },
        },
        kontragentler: { select: { ad: true, voen: true, telefon: true, unvan: true } },
        istifadeciler_finance_operations_isci_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_finance_operations_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
        istifadeciler_finance_operations_tesdiq_eden_idToistifadeciler: { select: { ad_soyad: true } },
      },
    }),
  );
}

const YN_LABEL: Record<string, string> = {
  daxil: "Mədaxil (gəlir)",
  xaric: "Məxariç (xərc)",
  neutral: "Neytral",
};

const HESAB_NOV_LABEL: Record<string, string> = {
  negd: "Nağd kassa",
  bank: "Bank hesabı",
  kart: "Kart",
};

export default async function FinanceOpReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [op, company] = await Promise.all([getOperation(id), getCompany()]);
  if (!op) notFound();

  const mebleg = Number(op.meblegh ?? 0);
  const aznMebleg = Number(op.azn_meblegh ?? mebleg);
  const komissiya = Number(op.komissiya ?? 0);

  const hesabAd =
    op.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? "—";
  const hesabNov =
    op.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.nov ?? "negd";
  const hesab2Ad =
    op.maliye_hesablari_finance_operations_hesab_id2Tomaliye_hesablari?.ad ?? null;

  return (
    <div className="min-h-screen bg-secondary/30 print:bg-white">
      <UniversalPrintControls backHref="/maliyye/emeliyyat" backLabel="Əməliyyatlar" />

      <main className="mx-auto print:m-0 print:max-w-none">
        <div
          className="mx-auto max-w-[210mm] bg-white p-10 text-black shadow-lg print:shadow-none"
          style={{ minHeight: "297mm" }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-black/20 pb-4">
            <div className="space-y-0.5">
              {company?.loqo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img loading="lazy" decoding="async" src={company.loqo_url} alt="" className="mb-2 h-12 w-auto object-contain" />
              )}
              <h1 className="text-2xl font-bold">{company?.ad ?? "Şirkət"}</h1>
              {company?.voen && <div className="text-xs text-black/60">VÖEN: {company.voen}</div>}
              {company?.telefon && <div className="text-xs text-black/60">Tel: {company.telefon}</div>}
              {company?.unvan && (
                <div className="max-w-[220px] text-xs text-black/60">{company.unvan}</div>
              )}
            </div>

            <div className="text-right">
              <div className="text-lg font-bold uppercase tracking-wider">
                {op.finance_operation_types?.emoji} {op.finance_operation_types?.ad ?? op.type_kod}
              </div>
              {op.sened_nomresi && (
                <div className="mt-0.5 font-mono text-xs">№ {op.sened_nomresi}</div>
              )}
              <div className="mt-1 text-xs text-black/60">{formatDate(op.tarix)}</div>
              <div className="mt-2 inline-flex rounded-full border border-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {YN_LABEL[op.y_n] ?? op.y_n}
              </div>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-6 py-5 text-xs">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-black/50">Hesab</div>
              <div className="text-base font-semibold">{hesabAd}</div>
              <div className="text-black/60">{HESAB_NOV_LABEL[hesabNov] ?? hesabNov}</div>
              {hesab2Ad && (
                <div className="mt-2 text-[10px] uppercase tracking-wider text-black/50">
                  Hədəf hesab
                  <div className="text-base font-semibold text-black">{hesab2Ad}</div>
                </div>
              )}
            </div>
            <div className="space-y-1 text-right">
              <div className="text-[10px] uppercase tracking-wider text-black/50">Qarşı tərəf</div>
              <div className="text-base font-semibold">
                {op.kontragentler?.ad ?? op.qarsi_teref ?? "—"}
              </div>
              {op.kontragentler?.voen && (
                <div className="text-black/60">VÖEN: {op.kontragentler.voen}</div>
              )}
              {op.kontragentler?.telefon && (
                <div className="text-black/60">{op.kontragentler.telefon}</div>
              )}
            </div>
          </section>

          <section className="rounded-md border border-black/20 bg-black/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/50">Məbləğ</div>
                <div className="text-3xl font-bold tabular-nums">
                  {formatMoney(mebleg)} {op.valyuta}
                </div>
                {op.valyuta !== "AZN" && (
                  <div className="text-xs text-black/60">
                    ≈ {formatMoney(aznMebleg)} ₼ (məz. {Number(op.mezenne ?? 1).toFixed(4)})
                  </div>
                )}
              </div>
              {komissiya > 0 && (
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-black/50">Komissiya</div>
                  <div className="text-lg font-bold tabular-nums">
                    {formatMoney(komissiya)}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="mt-5 space-y-2 text-xs">
            <Row label="Əməliyyat növü" value={op.finance_operation_types?.ad ?? op.type_kod} />
            <Row label="Qrup" value={op.finance_operation_types?.qrup ?? "—"} />
            {op.istifadeciler_finance_operations_isci_idToistifadeciler && (
              <Row
                label="Aid işçi"
                value={op.istifadeciler_finance_operations_isci_idToistifadeciler.ad_soyad}
              />
            )}
            <Row
              label="Yaradan"
              value={
                op.istifadeciler_finance_operations_yaradan_idToistifadeciler?.ad_soyad ?? "—"
              }
            />
            {op.istifadeciler_finance_operations_tesdiq_eden_idToistifadeciler && (
              <Row
                label="Təsdiq edən"
                value={op.istifadeciler_finance_operations_tesdiq_eden_idToistifadeciler.ad_soyad}
              />
            )}
            <Row label="Status" value={op.status === "aktiv" ? "Aktiv" : op.status} />
            {op.icra_tarixi && <Row label="İcra tarixi" value={formatDate(op.icra_tarixi)} />}
          </section>

          {op.qeyd && (
            <p className="mt-4 whitespace-pre-line border-t border-black/10 pt-3 text-[11px] text-black/60">
              {op.qeyd}
            </p>
          )}

          <footer className="mt-12 grid grid-cols-2 gap-8 text-center text-[10px]">
            <div className="border-t border-black/20 pt-2">
              <div className="text-black/50">Təhvil verən</div>
              <div className="mt-8 font-semibold">
                {op.istifadeciler_finance_operations_yaradan_idToistifadeciler?.ad_soyad ?? "—"}
              </div>
            </div>
            <div className="border-t border-black/20 pt-2">
              <div className="text-black/50">Təhvil alan</div>
              <div className="mt-8 font-semibold">{op.kontragentler?.ad ?? "—"}</div>
            </div>
          </footer>

          <div className="mt-6 border-t border-black/20 pt-3 text-center text-[10px] text-black/50">
            {company?.ad ?? "—"} ·{" "}
            {formatDate(new Date(), { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-black/10 py-1">
      <span className="text-black/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
