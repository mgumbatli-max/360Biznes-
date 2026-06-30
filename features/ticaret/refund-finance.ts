import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// Genişləndirilmiş Prisma client-in transaction tipi (account-balance.ts ilə eyni).
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Nağd/kart qaytarmada REVERSING finance_operations yazır + hesab balansını
 * yenidən hesablayır.
 *
 * NİYƏ MƏCBURİ: maliye_hesablari.qaliq YALNIZ finance_operations-dan hesablanır
 * (lib/balance/account-balance.ts — kassa_emeliyyatlari oxunmur). Orijinal satış
 * müsbət `daxil` sətri yaradıb hesabı artırır; qaytarma o pulu geri almalıdır,
 * yoxsa hesab balansı şişik (fantom pul) qalır.
 *
 * İŞARƏ: balance = SUM(daxil.azn) − SUM(xaric.azn). Refund üçün yön="xaric" +
 * MÜSBƏT azn_meblegh → mexaric artır → qaliq azalır (düzgün).
 */
export async function recordRefundFinanceOp(
  tx: Tx,
  args: {
    sahibkarId: string;
    saleId: string;
    musteriId?: string | null;
    kassaId?: string | null;
    odenisNov: string | null | undefined; // negd/kart/kecirme
    refund: number; // müsbət məbləğ
    istifadeciId?: string | null;
    qeyd: string;
  },
): Promise<void> {
  const { sahibkarId, saleId, musteriId, kassaId, odenisNov, refund, istifadeciId, qeyd } = args;
  if (!(refund > 0.001)) return;

  // Operation type (xaric — qaytarma); idempotent get-or-create
  let opType = await tx.finance_operation_types
    .findUnique({ where: { kod: "qaytarma_xaric" } })
    .catch(() => null);
  if (!opType) {
    opType = await tx.finance_operation_types.create({
      data: { kod: "qaytarma_xaric", ad: "Qaytarma (geri ödəniş)", qrup: "qaytarma", y_n: "xaric", link_satish: true },
    });
  }
  if (!opType) return;

  // Hesab resolver: kassanın bağlı hesabı → ödəniş növünə default (satış pattern-i ilə eyni)
  let hesabId: string | null = null;
  if (kassaId) {
    const k = await tx.kassalar.findFirst({
      where: { id: kassaId, sahibkar_id: sahibkarId },
      select: { maliye_hesab_id: true },
    });
    hesabId = k?.maliye_hesab_id ?? null;
  }
  if (!hesabId) {
    const nov = odenisNov === "kart" ? "kart" : odenisNov === "kecirme" ? "bank" : "negd";
    const def = await tx.maliye_hesablari.findFirst({
      where: { sahibkar_id: sahibkarId, aktiv: true, nov },
      orderBy: { yaradildi: "asc" },
      select: { id: true },
    });
    hesabId = def?.id ?? null;
  }
  if (!hesabId) return; // hesab yoxdursa yazma (kassa qeydi onsuz da var)

  await tx.finance_operations.create({
    data: {
      sahibkar_id: sahibkarId,
      type_id: opType.id,
      type_kod: opType.kod,
      y_n: "xaric",
      tarix: new Date(),
      meblegh: new Prisma.Decimal(refund),
      valyuta: "AZN",
      mezenne: 1,
      azn_meblegh: new Prisma.Decimal(refund), // MÜSBƏT — xaric balansı azaldır
      hesab_id: hesabId,
      kontragent_id: musteriId ?? null,
      satis_id: saleId,
      qeyd,
      yaradan_id: istifadeciId ?? null,
    },
  });

  const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
  await recalculateAccountBalance(hesabId, tx);
}
