import "server-only";
import type { prisma } from "./prisma";

// Project-genişləndirilmiş Prisma client-in $transaction callback tipi.
// `Prisma.TransactionClient` (vanilla) ilə uyumlu deyil — buna görə custom.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Race-safe stok decrement.
 *
 * Prisma-nın `upsert + decrement`-i parametr şəklində miqdarı yoxlamır →
 * paralel iki satış stoku mənfiyə apara bilir. Burada `UPDATE ... WHERE
 * miqdar >= $miqdar` ilə atomic decrement edirik — yoxsa nəticə 0 sətir
 * olur və xəta qaytarırıq.
 *
 * Hər satış/POS/market/transfer action-u client-side validateCartStock
 * etsə də, server-side bu helper son müdafiə xəttidir.
 *
 * @returns ok:true → uğur; ok:false + error → mövcud miqdar göstərilir.
 */
export async function safeStockDecrement(
  tx: Tx,
  args: {
    mehsulId: string;
    anbarId: number;
    miqdar: number; // azalmalı miqdar (pozitiv)
    mehsulAd?: string; // UI mesajı üçün opsional
  }
): Promise<{ ok: true } | { ok: false; error: string; current: number }> {
  const updated = await tx.$executeRaw`
    UPDATE stok
       SET miqdar = miqdar - ${args.miqdar}::numeric
     WHERE mehsul_id = ${args.mehsulId}::uuid
       AND anbar_id = ${args.anbarId}
       AND miqdar >= ${args.miqdar}::numeric
  `;
  if (updated > 0) return { ok: true };

  // Yoxla — stok ya yoxdur ya da kifayət etmir
  const row = await tx.stok.findUnique({
    where: { mehsul_id_anbar_id: { mehsul_id: args.mehsulId, anbar_id: args.anbarId } },
    select: { miqdar: true },
  });
  const current = Number(row?.miqdar ?? 0);
  const label = args.mehsulAd ?? `Məhsul ${args.mehsulId.slice(0, 8)}`;
  return {
    ok: false,
    error: row
      ? `${label} üçün stok kifayət etmir (mövcud: ${current}, tələb: ${args.miqdar})`
      : `${label} bu anbarda stokda yoxdur`,
    current,
  };
}

/**
 * Stok artırma (mədaxil) üçün upsert wrapper.
 * Bu yer race-safedir, çünki additive əməliyyat heç bir invariant pozmur.
 */
export async function stockIncrement(
  tx: Tx,
  args: {
    sahibkarId: string;
    mehsulId: string;
    anbarId: number;
    miqdar: number;
    sonQiymet?: number;
  }
): Promise<void> {
  await tx.stok.upsert({
    where: { mehsul_id_anbar_id: { mehsul_id: args.mehsulId, anbar_id: args.anbarId } },
    update: {
      miqdar: { increment: args.miqdar },
      ...(args.sonQiymet !== undefined ? { son_qiymet: args.sonQiymet } : {}),
    },
    create: {
      sahibkar_id: args.sahibkarId,
      mehsul_id: args.mehsulId,
      anbar_id: args.anbarId,
      miqdar: args.miqdar,
      ...(args.sonQiymet !== undefined ? { son_qiymet: args.sonQiymet } : {}),
    },
  });
}
