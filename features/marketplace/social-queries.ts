import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import type { SocialAccount, SocialChannel, SocialPost, PostStatus } from "./social-types";

// Re-export tiplərini client komponentlərin asanlıqla əldə etməsi üçün
export type { SocialAccount, SocialChannel, SocialPost, PostStatus } from "./social-types";
export { SOCIAL_CHANNELS } from "./social-types";

/**
 * Post-lar `sosial_hesablar` table-də saxlanmır, lakin onlar dataq əldə oluna bilər.
 * Saxlama strukturu: hər sahibkar üçün bir "ana" hesab (sahibkar_id, kanal="__posts__")
 * onun `ayarlar.posts` field-i array kimi saxlayır. Bu əməliyyat global posts list-idir.
 */
const POSTS_CHANNEL = "__posts__" as const;

async function ensurePostsContainer(sahibkarId: string): Promise<string> {
  const existing = await prisma.sosial_hesablar.findFirst({
    where: { sahibkar_id: sahibkarId, kanal: POSTS_CHANNEL },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.sosial_hesablar.create({
    data: {
      sahibkar_id: sahibkarId,
      kanal: POSTS_CHANNEL,
      ad: "Avto-Poster anbarı",
      aktiv: false,
      ayarlar: { posts: [] },
    },
  });
  return created.id;
}

/* ──────────────────────────────────────────────────────────────────────────
 * HESABLAR
 * ────────────────────────────────────────────────────────────────────────── */

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  return withTenant(async () => {
    const rows = await prisma.sosial_hesablar.findMany({
      where: { kanal: { not: POSTS_CHANNEL } },
      orderBy: { yaradildi: "desc" },
      select: {
        id: true,
        kanal: true,
        ad: true,
        hesab_id: true,
        webhook_url: true,
        aktiv: true,
        son_sync: true,
        yaradildi: true,
      },
    });

    // Hər hesab üçün post sayı hesabla
    const posts = await getAllPosts();
    const postCountByAccount = new Map<string, number>();
    for (const p of posts) {
      for (const id of p.hesab_ids) {
        postCountByAccount.set(id, (postCountByAccount.get(id) ?? 0) + 1);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      kanal: r.kanal as SocialChannel,
      ad: r.ad,
      hesab_id: r.hesab_id,
      webhook_url: r.webhook_url,
      aktiv: r.aktiv ?? true,
      son_sync: r.son_sync,
      yaradildi: r.yaradildi,
      post_sayi: postCountByAccount.get(r.id) ?? 0,
    }));
  });
}

export async function getSocialAccountById(id: string): Promise<SocialAccount | null> {
  return withTenant(async () => {
    const r = await prisma.sosial_hesablar.findUnique({
      where: { id },
      select: {
        id: true, kanal: true, ad: true, hesab_id: true, webhook_url: true,
        aktiv: true, son_sync: true, yaradildi: true,
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      kanal: r.kanal as SocialChannel,
      ad: r.ad,
      hesab_id: r.hesab_id,
      webhook_url: r.webhook_url,
      aktiv: r.aktiv ?? true,
      son_sync: r.son_sync,
      yaradildi: r.yaradildi,
      post_sayi: 0,
    };
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * POSTS
 * ────────────────────────────────────────────────────────────────────────── */

export async function getAllPosts(): Promise<SocialPost[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const container = await prisma.sosial_hesablar.findFirst({
      where: { sahibkar_id: sahibkarId, kanal: POSTS_CHANNEL },
      select: { ayarlar: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (container?.ayarlar as any)?.posts;
    if (!Array.isArray(raw)) return [];
    return raw as SocialPost[];
  });
}

export async function getPostsByStatus(status?: PostStatus): Promise<SocialPost[]> {
  const all = await getAllPosts();
  if (!status) return all;
  return all.filter((p) => p.status === status);
}

export async function getPostById(id: string): Promise<SocialPost | null> {
  const all = await getAllPosts();
  return all.find((p) => p.id === id) ?? null;
}

export async function getSocialStats(): Promise<{
  hesab_sayi: number;
  aktiv_hesab: number;
  cem_post: number;
  qaralama: number;
  planlasdirilmis: number;
  gonderildi_30g: number;
  xeta: number;
}> {
  return withTenant(async () => {
    const [accounts, posts] = await Promise.all([
      prisma.sosial_hesablar.findMany({
        where: { kanal: { not: POSTS_CHANNEL } },
        select: { aktiv: true },
      }),
      getAllPosts(),
    ]);
    const aktiv_hesab = accounts.filter((a) => a.aktiv).length;
    const thirtyDaysAgo = Date.now() - 30 * 86400_000;
    return {
      hesab_sayi: accounts.length,
      aktiv_hesab,
      cem_post: posts.length,
      qaralama: posts.filter((p) => p.status === "qaralama").length,
      planlasdirilmis: posts.filter((p) => p.status === "planlasdirilmis").length,
      gonderildi_30g: posts.filter(
        (p) => p.status === "gonderildi" && p.gonderildi && new Date(p.gonderildi).getTime() > thirtyDaysAgo,
      ).length,
      xeta: posts.filter((p) => p.status === "xeta").length,
    };
  });
}

export { ensurePostsContainer, POSTS_CHANNEL };
