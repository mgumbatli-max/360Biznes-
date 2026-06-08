import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { UniversalPrintControls } from "@/features/shared/print-controls";
import { formatMoney, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Xərc qəbzi" };

async function getCompany() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.sahibkarlar.findUnique({
      where: { id: sahibkarId },
      select: { ad: true, voen: true, telefon: true, unvan: true, loqo_url: true, email: true },
    });
  });
}

async function getExpense(id: string) {
  return withTenant(async () =>
    prisma.xercl_r.findUnique({
      where: { id },
      include: {
        xerc_kateqoriyalari: { select: { ad: true, qrup: true } },
        filiallar: { select: { ad: true } },
        istifadeciler: { select: { ad_soyad: true } },
      },
    }),
  );
}

const ODENIS: Record<string, string> = {
  negd: "Nağd",
  kart: "Kart",
  bank: "Bank",
  kecirme: "Köçürmə",
};

export default async function ExpenseReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [expense, company] = await Promise.all([getExpense(id), getCompany()]);
  if (!expense) notFound();

  const mebleg = Number(expense.mebleg ?? 0);
  const mebAzn = Number(expense.mebleg_azn ?? mebleg);

  return (
    <div className="min-h-screen bg-secondary/30 print:bg-white">
      <UniversalPrintControls backHref="/maliyye/xercler" backLabel="Xərclər" />

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
              <div className="text-lg font-bold uppercase tracking-wider">Xərc qəbzi</div>
              {expense.qebz_nomresi && (
                <div className="mt-0.5 font-mono text-xs">№ {expense.qebz_nomresi}</div>
              )}
              <div className="mt-1 text-xs text-black/60">{formatDate(expense.tarix)}</div>
            </div>
          </header>

          <section className="py-5">
            <div className="text-[10px] uppercase tracking-wider text-black/50">Təsvir</div>
            <h2 className="mt-1 text-xl font-semibold">{expense.tesvir}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-black/60">
              {expense.xerc_kateqoriyalari?.ad && (
                <span>Kateqoriya: {expense.xerc_kateqoriyalari.ad}</span>
              )}
              {expense.xerc_kateqoriyalari?.qrup && <span>· {expense.xerc_kateqoriyalari.qrup}</span>}
              {expense.filiallar?.ad && <span>· Filial: {expense.filiallar.ad}</span>}
            </div>
          </section>

          <section className="rounded-md border border-black/20 bg-black/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/50">Məbləğ</div>
                <div className="text-3xl font-bold tabular-nums">
                  {formatMoney(mebleg)} {expense.valyuta ?? "AZN"}
                </div>
                {(expense.valyuta ?? "AZN") !== "AZN" && (
                  <div className="text-xs text-black/60">
                    ≈ {formatMoney(mebAzn)} ₼ (məz. {Number(expense.mezenne ?? 1).toFixed(4)})
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-black/50">Ödəniş növü</div>
                <div className="text-lg font-bold">
                  {ODENIS[expense.odenis_nov ?? "negd"] ?? expense.odenis_nov}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 space-y-1 text-xs">
            <Row label="Yaradan" value={expense.istifadeciler?.ad_soyad ?? "—"} />
            <Row
              label="Yaradılma"
              value={
                expense.yaradildi
                  ? formatDate(expense.yaradildi, {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"
              }
            />
            {expense.legv_de && (
              <Row
                label="Silinmə"
                value={`${formatDate(expense.legv_de)} — ${expense.legv_sebeb ?? "—"}`}
              />
            )}
          </section>

          {expense.qeyd && (
            <p className="mt-4 whitespace-pre-line border-t border-black/10 pt-3 text-[11px] text-black/60">
              {expense.qeyd}
            </p>
          )}

          {expense.fayl_url && (
            <p className="mt-3 text-[10px] text-black/40">
              Əlavə sənəd / qəbz: {expense.fayl_url}
            </p>
          )}

          <footer className="mt-12 grid grid-cols-2 gap-8 text-center text-[10px]">
            <div className="border-t border-black/20 pt-2">
              <div className="text-black/50">Təhvil verən (kassir)</div>
              <div className="mt-8 font-semibold">{expense.istifadeciler?.ad_soyad ?? "—"}</div>
            </div>
            <div className="border-t border-black/20 pt-2">
              <div className="text-black/50">Qəbul edən</div>
              <div className="mt-8 font-semibold">—</div>
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
