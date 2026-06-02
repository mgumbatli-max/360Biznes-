import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type MyBildiris = {
  id: string;
  basliq: string;
  metn: string | null;
  nov: string;
  link: string | null;
  oxundu: boolean;
  yaradildi: Date | null;
};

export type MyNotificationsResult = {
  items: MyBildiris[];
  unreadCount: number;
};

/**
 * Cari istifadəçinin şəxsi bildirişləri (tapşırıq, status dəyişikliyi, xatırlatma).
 * `bildirisler` cədvəlindən oxuyur — alert-lərdən ayrı sistem.
 */
async function fetchMyBildirisler(
  sahibkarId: string,
  istifadeciId: string,
  limit: number,
): Promise<MyNotificationsResult> {
  const [items, unreadCount] = await Promise.all([
    prismaUnscoped.bildirisler.findMany({
      where: { sahibkar_id: sahibkarId, istifadeci_id: istifadeciId },
      orderBy: { yaradildi: "desc" },
      take: limit,
    }),
    prismaUnscoped.bildirisler.count({
      where: { sahibkar_id: sahibkarId, istifadeci_id: istifadeciId, oxundu: false },
    }),
  ]);
  return {
    items: items.map((b) => ({
      id: b.id,
      basliq: b.basliq,
      metn: b.metn,
      nov: b.nov ?? "info",
      link: b.link,
      oxundu: b.oxundu ?? false,
      yaradildi: b.yaradildi,
    })),
    unreadCount,
  };
}

/**
 * 30s cross-request cache — hər navigation-da DB sorğu azalır.
 * Yeni bildiriş yarananda `revalidateTag(`bildirisler:${sahibkarId}:${istifadeciId}`)`
 * çağırılır ki, dərhal yenilənsin.
 */
export const getMyNotifications = cache(async (limit = 10): Promise<MyNotificationsResult> => {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const cached = unstable_cache(
      () => fetchMyBildirisler(sahibkarId, istifadeciId, limit),
      ["my-bildirisler", sahibkarId, istifadeciId, String(limit)],
      { revalidate: 30, tags: [`bildirisler:${sahibkarId}:${istifadeciId}`] },
    );
    return cached();
  });
});
