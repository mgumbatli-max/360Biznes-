import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Team mesaj göndərmə üçün sadə rate limit.
 *
 * `team_mesaj` cədvəlində son 10 saniyə + son 1 dəqiqədəki mesaj sayını yoxlayır.
 * Spam və yanlışlıqla təkrar göndərmə qarşısını alır.
 *
 * Limitlər:
 *   - 10 saniyə: 5 mesaj
 *   - 1 dəqiqə: 30 mesaj
 */
export type RateLimitResult = { ok: true } | { ok: false; error: string };

const SECOND_LIMIT = 5;
const MINUTE_LIMIT = 30;

export async function checkTeamMessageRate(): Promise<RateLimitResult> {
  try {
    const { istifadeciId } = requireTenant();
    const now = new Date();
    const tenSecAgo = new Date(now.getTime() - 10_000);
    const minuteAgo = new Date(now.getTime() - 60_000);

    const [perSec, perMin] = await Promise.all([
      prisma.team_mesaj.count({
        where: { gonderici_id: istifadeciId, yaradildi: { gte: tenSecAgo } },
      }),
      prisma.team_mesaj.count({
        where: { gonderici_id: istifadeciId, yaradildi: { gte: minuteAgo } },
      }),
    ]);

    if (perSec >= SECOND_LIMIT) {
      return { ok: false, error: "Çox tez mesaj göndərirsiniz — bir az gözləyin" };
    }
    if (perMin >= MINUTE_LIMIT) {
      return { ok: false, error: `1 dəqiqədə ${MINUTE_LIMIT} mesajdan çox göndərə bilməzsiniz` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[checkTeamMessageRate]", e);
    return { ok: true }; // Fail-open — rate limit error mesajı bloklamasın
  }
}
