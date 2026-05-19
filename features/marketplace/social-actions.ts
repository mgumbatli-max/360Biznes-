"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import {
  ensurePostsContainer,
  POSTS_CHANNEL,
  type SocialPost,
  type SocialChannel,
} from "./social-queries";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const ALLOWED_CHANNELS: SocialChannel[] = [
  "instagram", "facebook", "tiktok", "telegram", "whatsapp", "linkedin", "x",
];

/* ──────────────────────────────────────────────────────────────────────────
 * HESAB
 * ────────────────────────────────────────────────────────────────────────── */

const ConnectSchema = z.object({
  kanal: z.enum(["instagram", "facebook", "tiktok", "telegram", "whatsapp", "linkedin", "x"]),
  ad: z.string().min(2).max(100),
  hesab_id: z.string().max(200).optional().or(z.literal("")),
  api_token: z.string().max(2000).optional().or(z.literal("")),
  webhook_url: z.string().url().optional().or(z.literal("")),
  send_url: z.string().url().optional().or(z.literal("")),
});

export async function connectSocialAccount(input: FormData): Promise<ActionResult> {
  const parsed = ConnectSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.sosial_hesablar.create({
        data: {
          sahibkar_id: sahibkarId,
          kanal: d.kanal,
          ad: d.ad.trim(),
          hesab_id: d.hesab_id?.trim() || null,
          api_token: d.api_token?.trim() || null,
          webhook_url: d.webhook_url?.trim() || null,
          send_url: d.send_url?.trim() || null,
          aktiv: true,
        },
      });
      revalidatePath("/marketplace/sosial");
      revalidatePath("/marketplace/avto-poster");
      return { ok: true };
    } catch (e) {
      console.error("[connectSocialAccount]", e);
      return { ok: false, error: "Qoşulmadı" };
    }
  });
}

export async function toggleSocialAccount(id: string, aktiv: boolean): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.sosial_hesablar.update({ where: { id }, data: { aktiv } });
      revalidatePath("/marketplace/sosial");
      return { ok: true };
    } catch (e) {
      console.error("[toggleSocialAccount]", e);
      return { ok: false, error: "Dəyişdirilmədi" };
    }
  });
}

export async function deleteSocialAccount(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      const r = await prisma.sosial_hesablar.findUnique({
        where: { id },
        select: { kanal: true },
      });
      if (!r) return { ok: false, error: "Tapılmadı" };
      if (r.kanal === POSTS_CHANNEL) {
        return { ok: false, error: "Post anbarı silinə bilməz" };
      }
      await prisma.sosial_hesablar.delete({ where: { id } });
      revalidatePath("/marketplace/sosial");
      revalidatePath("/marketplace/avto-poster");
      return { ok: true };
    } catch (e) {
      console.error("[deleteSocialAccount]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

/**
 * Test bağlantı: webhook URL-ə test sorğusu göndər. Real production-da hər platforma
 * üçün spesifik API çağrısı olur. Burada send_url varsa POST göndərib status status
 * qaytarır, son_sync yenilənir.
 */
export async function testSocialAccount(id: string): Promise<ActionResult<{ status: number; ok: boolean }>> {
  return withTenant(async () => {
    try {
      const r = await prisma.sosial_hesablar.findUnique({
        where: { id },
        select: { send_url: true, webhook_url: true, kanal: true, ad: true },
      });
      if (!r) return { ok: false, error: "Hesab tapılmadı" };
      const url = r.send_url || r.webhook_url;
      if (!url) {
        // URL yoxdursa mock olaraq uğurlu qəbul et
        await prisma.sosial_hesablar.update({
          where: { id },
          data: { son_sync: new Date() },
        });
        revalidatePath("/marketplace/sosial");
        return { ok: true, data: { status: 200, ok: true } };
      }
      let status = 0;
      let success = false;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true, channel: r.kanal, account: r.ad }),
          signal: AbortSignal.timeout(5_000),
        });
        status = res.status;
        success = res.ok;
      } catch {
        status = 0;
        success = false;
      }
      await prisma.sosial_hesablar.update({
        where: { id },
        data: { son_sync: new Date() },
      });
      revalidatePath("/marketplace/sosial");
      return { ok: true, data: { status, ok: success } };
    } catch (e) {
      console.error("[testSocialAccount]", e);
      return { ok: false, error: "Test alınmadı" };
    }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * POST
 * ────────────────────────────────────────────────────────────────────────── */

const PostSchema = z.object({
  basliq: z.string().min(1).max(200),
  metn: z.string().min(1).max(2000),
  sekil_url: z.string().url().optional().or(z.literal("")),
  mehsul_id: z.string().uuid().optional().or(z.literal("")),
  planlasdirilan: z.string().optional().or(z.literal("")),
  hesab_ids: z.string(), // comma-separated UUIDs
});

async function readPosts(sahibkarId: string): Promise<SocialPost[]> {
  const container = await prisma.sosial_hesablar.findFirst({
    where: { sahibkar_id: sahibkarId, kanal: POSTS_CHANNEL },
    select: { ayarlar: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (container?.ayarlar as any)?.posts;
  return Array.isArray(raw) ? (raw as SocialPost[]) : [];
}

async function writePosts(sahibkarId: string, posts: SocialPost[]): Promise<void> {
  const containerId = await ensurePostsContainer(sahibkarId);
  await prisma.sosial_hesablar.update({
    where: { id: containerId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { ayarlar: { posts } as any },
  });
}

export async function createPost(
  input: FormData,
  saveAs: "qaralama" | "planlasdirilmis" | "indi" = "qaralama",
): Promise<ActionResult<{ id: string }>> {
  const parsed = PostSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  const hesab_ids = d.hesab_ids.split(",").map((s) => s.trim()).filter(Boolean);
  if (hesab_ids.length === 0) return { ok: false, error: "Ən azı 1 hesab seçilməlidir" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const posts = await readPosts(sahibkarId);
      const now = new Date().toISOString();
      const post: SocialPost = {
        id: randomUUID(),
        basliq: d.basliq.trim(),
        metn: d.metn.trim(),
        sekil_url: d.sekil_url?.trim() || null,
        mehsul_id: d.mehsul_id?.trim() || null,
        planlasdirilan: d.planlasdirilan?.trim() || null,
        hesab_ids,
        status: saveAs === "indi" ? "qaralama" : saveAs,
        yaradildi: now,
        gonderildi: null,
        xeta: null,
      };
      posts.unshift(post);
      await writePosts(sahibkarId, posts);

      // "İndi göndər" — dərhal dərc
      if (saveAs === "indi") {
        const publishRes = await publishPostInternal(sahibkarId, post.id);
        if (!publishRes.ok) {
          return { ok: false, error: publishRes.error };
        }
      }

      revalidatePath("/marketplace/avto-poster");
      return { ok: true, data: { id: post.id } };
    } catch (e) {
      console.error("[createPost]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

export async function updatePost(id: string, input: FormData): Promise<ActionResult> {
  const parsed = PostSchema.partial().safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Yanlış" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const posts = await readPosts(sahibkarId);
      const idx = posts.findIndex((p) => p.id === id);
      if (idx < 0) return { ok: false, error: "Tapılmadı" };
      const cur = posts[idx];
      const hesab_ids = d.hesab_ids
        ? d.hesab_ids.split(",").map((s) => s.trim()).filter(Boolean)
        : cur.hesab_ids;
      posts[idx] = {
        ...cur,
        basliq: d.basliq?.trim() || cur.basliq,
        metn: d.metn?.trim() || cur.metn,
        sekil_url: d.sekil_url !== undefined ? (d.sekil_url || null) : cur.sekil_url,
        mehsul_id: d.mehsul_id !== undefined ? (d.mehsul_id || null) : cur.mehsul_id,
        planlasdirilan: d.planlasdirilan !== undefined ? (d.planlasdirilan || null) : cur.planlasdirilan,
        hesab_ids,
      };
      await writePosts(sahibkarId, posts);
      revalidatePath("/marketplace/avto-poster");
      return { ok: true };
    } catch (e) {
      console.error("[updatePost]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

export async function deletePost(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const posts = await readPosts(sahibkarId);
      const next = posts.filter((p) => p.id !== id);
      if (next.length === posts.length) return { ok: false, error: "Tapılmadı" };
      await writePosts(sahibkarId, next);
      revalidatePath("/marketplace/avto-poster");
      return { ok: true };
    } catch (e) {
      console.error("[deletePost]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

async function publishPostInternal(sahibkarId: string, postId: string): Promise<ActionResult> {
  const posts = await readPosts(sahibkarId);
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx < 0) return { ok: false, error: "Tapılmadı" };
  const post = posts[idx];

  // Hər hesab üçün send_url-ə POST göndər. Real production-da hər platforma üçün
  // spesifik API call lazımdır (Facebook Graph API, Instagram Graph API, və s.).
  // Burada universal webhook-relay yanaşması istifadə olunur.
  const accounts = await prisma.sosial_hesablar.findMany({
    where: { id: { in: post.hesab_ids }, sahibkar_id: sahibkarId, aktiv: true },
    select: { id: true, kanal: true, send_url: true, webhook_url: true, ad: true, api_token: true },
  });

  if (accounts.length === 0) {
    posts[idx] = {
      ...post,
      status: "xeta",
      xeta: "Aktiv hesab tapılmadı",
    };
    await writePosts(sahibkarId, posts);
    return { ok: false, error: "Aktiv hesab tapılmadı" };
  }

  const errors: string[] = [];
  for (const acc of accounts) {
    const url = acc.send_url || acc.webhook_url;
    if (!url) {
      // URL yoxdursa "mock göndərmə" — yalnız local olaraq qeyd
      continue;
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(acc.api_token ? { Authorization: `Bearer ${acc.api_token}` } : {}),
        },
        body: JSON.stringify({
          channel: acc.kanal,
          account: acc.ad,
          title: post.basliq,
          text: post.metn,
          image_url: post.sekil_url,
          metadata: { mehsul_id: post.mehsul_id, post_id: post.id },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) errors.push(`${acc.kanal}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${acc.kanal}: ${e instanceof Error ? e.message : "naməlum xəta"}`);
    }
  }

  const now = new Date().toISOString();
  posts[idx] = {
    ...post,
    status: errors.length === accounts.length ? "xeta" : "gonderildi",
    gonderildi: now,
    xeta: errors.length > 0 ? errors.join("; ") : null,
  };
  await writePosts(sahibkarId, posts);
  return errors.length === accounts.length
    ? { ok: false, error: errors.join("; ") }
    : { ok: true };
}

export async function publishPost(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const r = await publishPostInternal(sahibkarId, id);
    revalidatePath("/marketplace/avto-poster");
    return r;
  });
}

export async function schedulePost(id: string, when: string): Promise<ActionResult> {
  if (!when) return { ok: false, error: "Tarix lazımdır" };
  const dt = new Date(when);
  if (isNaN(dt.getTime())) return { ok: false, error: "Tarix yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const posts = await readPosts(sahibkarId);
      const idx = posts.findIndex((p) => p.id === id);
      if (idx < 0) return { ok: false, error: "Tapılmadı" };
      posts[idx] = {
        ...posts[idx],
        planlasdirilan: dt.toISOString(),
        status: "planlasdirilmis",
      };
      await writePosts(sahibkarId, posts);
      revalidatePath("/marketplace/avto-poster");
      return { ok: true };
    } catch (e) {
      console.error("[schedulePost]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

/**
 * Cron / page-load ilə çağırılır: planlaşdırılma vaxtı gələnləri dərc et.
 */
export async function publishDuePosts(): Promise<ActionResult<{ published: number }>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const posts = await readPosts(sahibkarId);
      const now = Date.now();
      const dueIds = posts
        .filter(
          (p) =>
            p.status === "planlasdirilmis" &&
            p.planlasdirilan &&
            new Date(p.planlasdirilan).getTime() <= now,
        )
        .map((p) => p.id);

      let published = 0;
      for (const id of dueIds) {
        const r = await publishPostInternal(sahibkarId, id);
        if (r.ok) published += 1;
      }
      if (published > 0) revalidatePath("/marketplace/avto-poster");
      return { ok: true, data: { published } };
    } catch (e) {
      console.error("[publishDuePosts]", e);
      return { ok: false, error: "Sıra işlədilmədi" };
    }
  });
}

export { ALLOWED_CHANNELS };
