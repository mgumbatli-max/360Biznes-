"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireCrmActionPerm, bustCrmCache, getCrmScopeFilter } from "./access-guard";

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string };

const ReplySchema = z.object({
  sohbet_id: z.string().uuid(),
  metn: z.string().min(1).max(4000),
  ai_yaradilan: z.coerce.boolean().default(false),
});

export async function sendReply(input: FormData): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm("mesaj.cevab");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ReplySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Söhbətin cari user-ə aid olduğunu yoxla (privileged xaric)
      const scope = await getCrmScopeFilter();
      const chat = await prisma.inbox_sohbetler.findFirst({
        where: { id: d.sohbet_id },
        select: { id: true, cavabdeh_id: true, kanal: true, oxunmamis_say: true },
      });
      if (!chat) return { ok: false, error: "Söhbət tapılmadı" };
      if (!scope.privileged && chat.cavabdeh_id && chat.cavabdeh_id !== istifadeciId) {
        return { ok: false, error: "Bu söhbət başqa istifadəçiyə təyin olunub" };
      }

      const created = await prisma.inbox_mesajlari.create({
        data: {
          sahibkar_id: sahibkarId,
          sohbet_id: d.sohbet_id,
          istiqamet: "out",
          metn: d.metn.trim(),
          status: "gonderildi",
          ai_yaradilan: d.ai_yaradilan,
          istifadeci_id: istifadeciId,
        },
      });
      await prisma.inbox_sohbetler.update({
        where: { id: d.sohbet_id },
        data: {
          son_mesaj: d.metn.trim().slice(0, 200),
          son_mesaj_zamani: new Date(),
          oxunmamis_say: 0,
          // İlk cavabdırsa cavabdeh_id təyin et (SLA tracking)
          cavabdeh_id: chat.cavabdeh_id ?? istifadeciId,
          yenilendi: new Date(),
        },
      });
      revalidatePath(`/crm/inbox/${d.sohbet_id}`);
      revalidatePath("/crm/inbox");
      revalidatePath("/crm");
      bustCrmCache();
      await audit("gonder", "inbox_mesaj", String(created.id), {
        yeni_data: { sohbet_id: d.sohbet_id, kanal: chat.kanal, ai_yaradilan: d.ai_yaradilan, uzunluq: d.metn.length },
        sebeb: "İnbox cavabı göndərildi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[sendReply]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Göndərilmədi: ${msg}` };
    }
  });
}

export async function markChatRead(sohbet_id: string): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm("crm.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    try {
      await prisma.inbox_sohbetler.update({
        where: { id: sohbet_id },
        data: { oxunmamis_say: 0 },
      });
      revalidatePath("/crm/inbox");
      revalidatePath("/crm");
      bustCrmCache();
      return { ok: true };
    } catch (e) {
      console.error("[markChatRead]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

const ConvertSchema = z.object({
  sohbet_id: z.string().uuid(),
});

export async function convertChatToMusteri(input: FormData): Promise<ActionResult> {
  const permCheck = await requireCrmActionPerm(["lead.idare", "crm.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ConvertSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Sohbət tapılmadı" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const c = await prisma.inbox_sohbetler.findFirst({ where: { id: parsed.data.sohbet_id } });
      if (!c) return { ok: false, error: "Söhbət tapılmadı" };
      if (c.musteri_id) return { ok: true, data: { id: c.musteri_id, existed: true } };

      // Telefon/ad ən azı biri tələb olunur
      if (!c.display_ad && !c.telefon) {
        return { ok: false, error: "Söhbətdə müştəri adı və ya telefon yoxdur" };
      }

      // Eyni telefonla müştəri varsa onu istifadə et (duplikat qarşısı)
      let kontragent: { id: string } | null = null;
      if (c.telefon) {
        const existing = await prisma.kontragentler.findFirst({
          where: { telefon: c.telefon, aktiv: true },
          select: { id: true },
        });
        if (existing) kontragent = existing;
      }
      if (!kontragent) {
        kontragent = await prisma.kontragentler.create({
          data: {
            sahibkar_id: sahibkarId,
            getirdi_id: istifadeciId,
            nov: "musteri",
            ad: c.display_ad ?? "Müştəri",
            telefon: c.telefon,
            qaynaq: c.kanal,
            qiymet_tipi: "adi",
          },
          select: { id: true },
        });
      }
      await prisma.inbox_sohbetler.update({
        where: { id: c.id },
        data: { musteri_id: kontragent.id, yenilendi: new Date() },
      });
      revalidatePath("/crm/inbox");
      bustCrmCache();
      await audit("konvert", "inbox_sohbet", c.id, {
        yeni_data: { kontragent_id: kontragent.id, kanal: c.kanal, ad: c.display_ad },
        sebeb: "Söhbət müştəriyə çevrildi",
      });
      return { ok: true, data: { id: kontragent.id } };
    } catch (e) {
      console.error("[convertChat]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

/**
 * 1) Bulk söhbət təyini — eyni anda bir neçə söhbəti istifadəçiyə təyin et.
 */
export async function bulkAssignChats(
  sohbetIds: string[],
  istifadeciId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm("mesaj.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!sohbetIds.length) return { ok: false, error: "Seçim yoxdur" };
  if (sohbetIds.length > 200) return { ok: false, error: "Bir dəfəyə 200-dən çox söhbət ola bilməz" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const u = await prisma.istifadeciler.findFirst({
        where: { id: istifadeciId, sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad_soyad: true },
      });
      if (!u) return { ok: false, error: "Aktiv işçi tapılmadı" };
      const res = await prisma.inbox_sohbetler.updateMany({
        where: { id: { in: sohbetIds } },
        data: { cavabdeh_id: u.id, yenilendi: new Date() },
      });
      revalidatePath("/crm/inbox");
      revalidatePath("/crm");
      bustCrmCache();
      await audit("teyin", "inbox_sohbet", null, {
        yeni_data: { sohbet_say: res.count, istifadeci_id: u.id, ad_soyad: u.ad_soyad },
        sebeb: `Bulk söhbət təyini: ${res.count} söhbət → ${u.ad_soyad}`,
      });
      return { ok: true, count: res.count };
    } catch (e) {
      console.error("[bulkAssignChats]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 2) İnbox mesaj axtarış — yalnız user-ə icazəli söhbətlərdə.
 */
export type InboxSearchResult = {
  sohbet_id: string;
  mesaj_id: bigint;
  metn: string;
  kanal: string | null;
  display_ad: string | null;
  yaradildi: Date | null;
};

export async function searchInboxMessages(
  query: string,
  limit = 50,
): Promise<{ ok: true; results: InboxSearchResult[] } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm("crm.oxu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const q = query.trim();
  if (q.length < 2) return { ok: false, error: "Axtarış mətni 2 simvoldan qısa ola bilməz" };
  if (q.length > 100) return { ok: false, error: "Axtarış mətni 100 simvoldan uzun ola bilməz" };
  return withTenant(async () => {
    const scope = await getCrmScopeFilter();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { metn: { contains: q, mode: "insensitive" } };
      if (!scope.privileged && scope.istifadeciId) {
        where.inbox_sohbetler = { cavabdeh_id: scope.istifadeciId };
      }
      const rows = await prisma.inbox_mesajlari.findMany({
        where,
        include: {
          inbox_sohbetler: { select: { id: true, kanal: true, display_ad: true } },
        },
        orderBy: { yaradildi: "desc" },
        take: Math.min(Math.max(1, limit), 100),
      });
      return {
        ok: true,
        results: rows.map((r) => ({
          sohbet_id: r.sohbet_id ?? "",
          mesaj_id: r.id,
          metn: r.metn ?? "",
          kanal: r.inbox_sohbetler?.kanal ?? null,
          display_ad: r.inbox_sohbetler?.display_ad ?? null,
          yaradildi: r.yaradildi,
        })),
      };
    } catch (e) {
      console.error("[searchInboxMessages]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Axtarış alınmadı: ${msg}` };
    }
  });
}

/**
 * 3) Söhbət birləşdirmə — eyni telefonlu söhbətlər bir kontekst-ə.
 * Mesajlar birinci söhbətə köçürülür, qalanlar arxivlənir.
 */
export async function mergeChats(
  ids: string[],
): Promise<{ ok: true; primary: string; merged: number } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm("mesaj.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (ids.length < 2) return { ok: false, error: "Ən azı 2 söhbət seçilməlidir" };
  if (ids.length > 20) return { ok: false, error: "Bir dəfəyə 20 söhbətdən çox ola bilməz" };
  return withTenant(async () => {
    try {
      const chats = await prisma.inbox_sohbetler.findMany({
        where: { id: { in: ids } },
        orderBy: { yaradildi: "asc" },
      });
      if (chats.length < 2) return { ok: false, error: "Söhbətlər tapılmadı" };
      const primary = chats[0];
      const others = chats.slice(1);
      // Bütün mesajları primary-ə köçür
      for (const c of others) {
        await prisma.inbox_mesajlari.updateMany({
          where: { sohbet_id: c.id },
          data: { sohbet_id: primary.id },
        });
        await prisma.inbox_sohbetler.update({
          where: { id: c.id },
          data: { status: "arxiv", qeyd: `MERGED INTO ${primary.id}`, yenilendi: new Date() },
        });
      }
      revalidatePath("/crm/inbox");
      bustCrmCache();
      await audit("birlesdir", "inbox_sohbet", primary.id, {
        yeni_data: { merged_say: others.length, silinen_idler: others.map((c) => c.id) },
        sebeb: `Söhbətlər birləşdirildi: ${ids.length} → 1`,
      });
      return { ok: true, primary: primary.id, merged: others.length };
    } catch (e) {
      console.error("[mergeChats]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}
