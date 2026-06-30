import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// Genişləndirilmiş Prisma client-in transaction tipi (account-balance.ts ilə eyni).
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Ödəniş növünə görə maliyə hesabını həll et: kassanın bağlı hesabı →
 * ödəniş növünün default hesabı (negd/kart/bank). satış pattern-i ilə eyni.
 */
async function resolveAccountId(
  tx: Tx,
  sahibkarId: string,
  kassaId: string | null | undefined,
  odenisNov: string | null | undefined,
): Promise<string | null> {
  if (kassaId) {
    const k = await tx.kassalar.findFirst({
      where: { id: kassaId, sahibkar_id: sahibkarId },
      select: { maliye_hesab_id: true },
    });
    if (k?.maliye_hesab_id) return k.maliye_hesab_id;
  }
  const nov = odenisNov === "kart" ? "kart" : odenisNov === "kecirme" ? "bank" : "negd";
  const def = await tx.maliye_hesablari.findFirst({
    where: { sahibkar_id: sahibkarId, aktiv: true, nov },
    orderBy: { yaradildi: "asc" },
    select: { id: true },
  });
  return def?.id ?? null;
}

async function getOrCreateOpType(tx: Tx, kod: string, ad: string, yn: "daxil" | "xaric") {
  let t = await tx.finance_operation_types.findUnique({ where: { kod } }).catch(() => null);
  if (!t) {
    t = await tx.finance_operation_types.create({
      data: { kod, ad, qrup: kod, y_n: yn, link_satish: true },
    });
  }
  return t;
}

async function recalc(tx: Tx, hesabId: string) {
  const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
  await recalculateAccountBalance(hesabId, tx);
}

type CommonArgs = {
  sahibkarId: string;
  saleId: string;
  musteriId?: string | null;
  kassaId?: string | null;
  odenisNov: string | null | undefined;
  istifadeciId?: string | null;
  qeyd: string;
};

/**
 * Nağd/kart qaytarmada REVERSING finance_operations + balans recalc.
 * NİYƏ: maliye_hesablari.qaliq YALNIZ finance_operations-dan hesablanır.
 * İŞARƏ: balance = SUM(daxil) − SUM(xaric); refund üçün yön="xaric" + MÜSBƏT azn.
 */
export async function recordRefundFinanceOp(tx: Tx, args: CommonArgs & { refund: number }): Promise<void> {
  if (!(args.refund > 0.001)) return;
  const opType = await getOrCreateOpType(tx, "qaytarma_xaric", "Qaytarma (geri ödəniş)", "xaric");
  if (!opType) return;
  const hesabId = await resolveAccountId(tx, args.sahibkarId, args.kassaId, args.odenisNov);
  if (!hesabId) return;
  await tx.finance_operations.create({
    data: {
      sahibkar_id: args.sahibkarId, type_id: opType.id, type_kod: opType.kod,
      y_n: "xaric", tarix: new Date(),
      meblegh: new Prisma.Decimal(args.refund), valyuta: "AZN", mezenne: 1,
      azn_meblegh: new Prisma.Decimal(args.refund),
      hesab_id: hesabId, kontragent_id: args.musteriId ?? null, satis_id: args.saleId,
      qeyd: args.qeyd, yaradan_id: args.istifadeciId ?? null,
    },
  });
  await recalc(tx, hesabId);
}

/**
 * Satışa nağd/kart ödəniş daxil olanda INFLOW finance_operations + balans recalc.
 * (recordSalePayment pattern-i; split-payment kimi yalnız kassa yazan yerlər üçün.)
 * İŞARƏ: yön="daxil" + MÜSBƏT azn → daxil artır → qaliq artır.
 */
export async function recordSaleInflowFinanceOp(tx: Tx, args: CommonArgs & { mebleg: number }): Promise<void> {
  if (!(args.mebleg > 0.001)) return;
  const opType = await getOrCreateOpType(tx, "qaime", "Qaimə", "daxil");
  if (!opType) return;
  const hesabId = await resolveAccountId(tx, args.sahibkarId, args.kassaId, args.odenisNov);
  if (!hesabId) return;
  await tx.finance_operations.create({
    data: {
      sahibkar_id: args.sahibkarId, type_id: opType.id, type_kod: opType.kod,
      y_n: "daxil", tarix: new Date(),
      meblegh: new Prisma.Decimal(args.mebleg), valyuta: "AZN", mezenne: 1,
      azn_meblegh: new Prisma.Decimal(args.mebleg),
      hesab_id: hesabId, kontragent_id: args.musteriId ?? null, satis_id: args.saleId,
      qeyd: args.qeyd, yaradan_id: args.istifadeciId ?? null,
    },
  });
  await recalc(tx, hesabId);
}
