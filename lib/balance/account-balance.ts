import "server-only";
import { Prisma, prisma } from "@/lib/db/prisma";

/**
 * Maliyə hesabı / kassa qaliqı üçün VAHID HƏQİQƏT MƏNBƏYİ.
 *
 * Müştəri (`customer-balance.ts`) və təchizatçı (`supplier-balance.ts`)
 * patterninə uyğun.
 *
 * MƏNTİQ:
 *   qaliq = SUM(yön='daxil' azn_meblegh)
 *         - SUM(yön='mexaric' azn_meblegh)
 *         + SUM(transfer hədəfi olarsa: meblegh2)
 *         - SUM(transfer mənbəyidirsa: meblegh)
 *
 *   Yalnız aktiv əməliyyatlar:
 *   - deleted_at IS NULL
 *   - status = 'aktiv' (legv/gozleyen_tesdiq xaric)
 *
 * Transfer əməliyyatları schema-da bir sətirdir:
 *   - hesab_id (mənbə) → mexaric (`azn_meblegh` qədər)
 *   - hesab_id2 (hədəf) → daxil (`meblegh2` AZN əqdrqərvariltl varsa, yoxsa `azn_meblegh`)
 *
 * Beləliklə hər hesab üçün ikitərəfli formula tətbiq olunur.
 */

export type AccountBalanceBreakdown = {
  /** Hesabın cari qaliqı (AZN, mənfi ola bilər) */
  qaliq: number;
  /** Bütün aktiv mədaxillər cəmi */
  daxil_cemi: number;
  /** Bütün aktiv məxariclər cəmi */
  mexaric_cemi: number;
  /** Aktiv əməliyyat sayı */
  emeliyyat_sayi: number;
};

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Hesab balansını real-time finance_operations cədvəlindən hesabla.
 * Yan təsir yox — yalnız hesablayır.
 */
export async function calculateAccountBalance(
  hesabId: string,
  tx: TxClient = prisma,
): Promise<AccountBalanceBreakdown> {
  const rows = await tx.$queryRaw<
    Array<{
      daxil_cemi: number;
      mexaric_cemi: number;
      transfer_daxil: number;
      transfer_mexaric: number;
      emeliyyat_sayi: bigint;
    }>
  >`
    SELECT
      -- Hesab mənbə kimi: yön bütöv əməliyyat (qaime, xerc, alis_odenis, və s.)
      COALESCE(SUM(CASE
        WHEN hesab_id = ${hesabId}::uuid
          AND deleted_at IS NULL
          AND status = 'aktiv'
          AND yön = 'daxil'
        THEN azn_meblegh ELSE 0
      END), 0)::float AS daxil_cemi,

      COALESCE(SUM(CASE
        WHEN hesab_id = ${hesabId}::uuid
          AND deleted_at IS NULL
          AND status = 'aktiv'
          AND yön = 'mexaric'
        THEN azn_meblegh ELSE 0
      END), 0)::float AS mexaric_cemi,

      -- Hesab transfer hədəfi kimi: hesab_id2-də olarsa daxil
      COALESCE(SUM(CASE
        WHEN hesab_id2 = ${hesabId}::uuid
          AND deleted_at IS NULL
          AND status = 'aktiv'
        THEN COALESCE(meblegh2, azn_meblegh)
        ELSE 0
      END), 0)::float AS transfer_daxil,

      -- "Transfer" tipli əməliyyatda hesab_id MƏNBƏ kimi (yön səhv yazıla bilər)
      -- yön='transfer' xüsusi nov: hesab_id-dən çıxış, hesab_id2-yə giriş
      COALESCE(SUM(CASE
        WHEN hesab_id = ${hesabId}::uuid
          AND hesab_id2 IS NOT NULL
          AND deleted_at IS NULL
          AND status = 'aktiv'
          AND yön = 'transfer'
        THEN azn_meblegh ELSE 0
      END), 0)::float AS transfer_mexaric,

      COUNT(*) FILTER (
        WHERE (hesab_id = ${hesabId}::uuid OR hesab_id2 = ${hesabId}::uuid)
          AND deleted_at IS NULL
          AND status = 'aktiv'
      )::bigint AS emeliyyat_sayi
    FROM finance_operations
    WHERE hesab_id = ${hesabId}::uuid OR hesab_id2 = ${hesabId}::uuid
  `;

  const r = rows[0] ?? {
    daxil_cemi: 0,
    mexaric_cemi: 0,
    transfer_daxil: 0,
    transfer_mexaric: 0,
    emeliyyat_sayi: 0n,
  };

  const daxil = Number(r.daxil_cemi ?? 0) + Number(r.transfer_daxil ?? 0);
  const mexaric = Number(r.mexaric_cemi ?? 0) + Number(r.transfer_mexaric ?? 0);
  const qaliq = daxil - mexaric;

  return {
    qaliq: Math.round(qaliq * 100) / 100,
    daxil_cemi: Math.round(daxil * 100) / 100,
    mexaric_cemi: Math.round(mexaric * 100) / 100,
    emeliyyat_sayi: Number(r.emeliyyat_sayi ?? 0),
  };
}

/**
 * Hesab qaliqı yenidən hesabla VƏ `maliye_hesablari.qaliq` cache-ə yaz.
 * Hər `finance_operations` mutate-dan sonra çağırılmalıdır.
 */
export async function recalculateAccountBalance(
  hesabId: string,
  tx: TxClient = prisma,
): Promise<
  | { ok: true; balance: AccountBalanceBreakdown; drift: number }
  | { ok: false; error: string }
> {
  if (!hesabId) return { ok: false, error: "hesabId boşdur" };

  try {
    const before = await tx.maliye_hesablari.findUnique({
      where: { id: hesabId },
      select: { qaliq: true },
    });
    if (!before) return { ok: false, error: "Hesab tapılmadı" };

    const balance = await calculateAccountBalance(hesabId, tx);
    const prevQaliq = Number(before.qaliq ?? 0);
    const drift = balance.qaliq - prevQaliq;

    await tx.maliye_hesablari.update({
      where: { id: hesabId },
      data: {
        qaliq: new Prisma.Decimal(balance.qaliq.toFixed(2)),
        yenilendi: new Date(),
      },
    });

    return { ok: true, balance, drift };
  } catch (e) {
    console.error("[recalculateAccountBalance]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Hesablama alınmadı" };
  }
}

/**
 * Toplu recalc — sahibkar daxilindəki bütün hesabların qaliqını yenilə.
 * Admin/cron üçün.
 */
export async function recalculateAllAccountBalances(
  sahibkarId: string,
): Promise<
  | { ok: true; updated: number; drift_total: number; max_drift: number }
  | { ok: false; error: string }
> {
  try {
    const hesablar = await prisma.maliye_hesablari.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      select: { id: true },
    });
    let updated = 0;
    let driftTotal = 0;
    let maxDrift = 0;
    for (const h of hesablar) {
      const res = await recalculateAccountBalance(h.id);
      if (res.ok && Math.abs(res.drift) > 0.01) {
        updated++;
        driftTotal += Math.abs(res.drift);
        if (Math.abs(res.drift) > maxDrift) maxDrift = Math.abs(res.drift);
      }
    }
    return { ok: true, updated, drift_total: driftTotal, max_drift: maxDrift };
  } catch (e) {
    console.error("[recalculateAllAccountBalances]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Toplu hesablama alınmadı" };
  }
}

/**
 * Negative-balance qoruyucu: hesab azalmadan əvvəl yoxla.
 * `maas-actions`, `paySupplier*`, və digər mexaric əməliyyatları bunu istifadə edir.
 *
 * Real qaliq source-of-truth-dan götürülür (cache deyil).
 */
export async function checkAccountSufficient(
  hesabId: string,
  mebleg: number,
  tx: TxClient = prisma,
): Promise<{ ok: true } | { ok: false; error: string; mevcud: number }> {
  const balance = await calculateAccountBalance(hesabId, tx);
  if (balance.qaliq < mebleg - 0.001) {
    return {
      ok: false,
      mevcud: balance.qaliq,
      error: `Hesabda kifayət qədər pul yoxdur (qaliq: ${balance.qaliq.toFixed(2)} ₼, lazım: ${mebleg.toFixed(2)} ₼)`,
    };
  }
  return { ok: true };
}
