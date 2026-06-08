"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import {
  requireTeamActionPerm,
  requireTeamOrgAdmin,
  requireChannelAdmin,
  requireChannelMember,
  isChannelAdmin,
  isChannelMember,
  bustTeamCache,
  getChannelNotifyTargets,
} from "./access-guard";
import { checkTeamMessageRate } from "./rate-limit";

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string };

const boolFromForm = z.string().transform((s) => s === "true" || s === "1");

// === CREATE CHANNEL ===

const CreateChannelSchema = z.object({
  ad: z.string().min(2).max(150),
  tesvir: z.string().max(500).optional().or(z.literal("")),
  novu: z.enum(["kanal", "direct", "filial"]).default("kanal"),
  qapali: z.string().optional().transform((s) => s === "true" || s === "1"),
  uzv_ids: z.string().optional(),
  filial_id: z.coerce.number().int().positive().optional(),
});

export async function createChannel(input: FormData): Promise<ActionResult> {
  const permCheck = await requireTeamActionPerm("team.kanal_yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CreateChannelSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };

    try {
      const uzvIds = (d.uzv_ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (!uzvIds.includes(istifadeciId)) uzvIds.unshift(istifadeciId);

      // YENİ: uzv_ids — aktiv işçi yoxlanması
      const validMembers = await prisma.istifadeciler.findMany({
        where: { id: { in: uzvIds }, sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true },
      });
      const validIds = validMembers.map((m) => m.id);
      if (validIds.length === 0) return { ok: false, error: "Aktiv üzv tapılmadı" };

      // For direct messages, ensure no duplicate
      if (d.novu === "direct" && validIds.length === 2) {
        const a = validIds[0];
        const b = validIds[1];
        const existing = await prisma.team_kanal.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            novu: "direct",
            AND: [
              { uzvler: { some: { istifadeci_id: a } } },
              { uzvler: { some: { istifadeci_id: b } } },
            ],
          },
        });
        if (existing) return { ok: true, data: { id: existing.id } };
      }

      const kanal = await prisma.team_kanal.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad.trim(),
          tesvir: d.tesvir?.trim() || null,
          novu: d.novu,
          qapali: d.qapali,
          filial_id: d.filial_id ?? null,
          yaradan_id: istifadeciId,
          uzvler: {
            create: validIds.map((id) => ({
              istifadeci_id: id,
              rolu: id === istifadeciId ? "admin" : "uzv",
            })),
          },
        },
      });

      revalidatePath("/team");
      bustTeamCache();
      await audit("yarat", "team_kanal", String(kanal.id), {
        yeni_data: { ad: d.ad, novu: d.novu, qapali: d.qapali, uzv_sayi: validIds.length },
        sebeb: `Yeni kanal: ${d.ad}`,
      });
      return { ok: true, data: { id: kanal.id } };
    } catch (e) {
      console.error("[createChannel]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Kanal yaradılmadı: ${msg}` };
    }
  });
}

// === SEND MESSAGE ===

const SendMessageSchema = z.object({
  kanal_id: z.coerce.number().int().positive(),
  mesaj: z.string().min(1).max(2500),
  parent_id: z.coerce.number().int().positive().optional(),
  mention_ids: z.string().optional(),
  gizli: z.string().optional().transform((s) => s === "true" || s === "1"),
  bir_dafelik: z.string().optional().transform((s) => s === "true" || s === "1"),
  kilid_sifre: z.string().max(100).optional().or(z.literal("")),
  eklenti_url: z.string().max(500).optional().or(z.literal("")),
  eklenti_ad: z.string().max(200).optional().or(z.literal("")),
});

export async function sendTeamMessage(input: FormData): Promise<ActionResult> {
  const parsed = SendMessageSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };

    // YENİ: rate limit
    const rate = await checkTeamMessageRate();
    if (!rate.ok) return { ok: false, error: rate.error };

    try {
      const kanal = await prisma.team_kanal.findFirst({
        where: { id: d.kanal_id, sahibkar_id: sahibkarId },
      });
      if (!kanal) return { ok: false, error: "Kanal tapılmadı" };
      if (kanal.arxivlendi) return { ok: false, error: "Arxivlənmiş kanala mesaj göndərilə bilməz" };

      const member = await prisma.team_uzv.findUnique({
        where: { kanal_id_istifadeci_id: { kanal_id: d.kanal_id, istifadeci_id: istifadeciId } },
      });
      if (!member && kanal.qapali) return { ok: false, error: "Kanala üzv deyilsiniz" };

      // Auto-join public channels
      if (!member && !kanal.qapali) {
        await prisma.team_uzv.create({
          data: { kanal_id: d.kanal_id, istifadeci_id: istifadeciId, rolu: "uzv" },
        });
      }

      const mentionIds = (d.mention_ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let kilidHash: string | null = null;
      if (d.kilid_sifre && d.kilid_sifre.length > 0) {
        const bcrypt = await import("bcryptjs");
        kilidHash = await bcrypt.hash(d.kilid_sifre, 8);
      }

      const created = await prisma.team_mesaj.create({
        data: {
          kanal_id: d.kanal_id,
          gonderici_id: istifadeciId,
          mesaj: d.mesaj.trim(),
          parent_id: d.parent_id ?? null,
          mention_ids: mentionIds,
          gizli: d.gizli,
          bir_dafelik: d.bir_dafelik,
          kilid_sifre_hash: kilidHash,
          eklenti_url: d.eklenti_url || null,
          eklenti_ad: d.eklenti_ad || null,
        },
      });

      await Promise.all([
        prisma.team_kanal.update({
          where: { id: d.kanal_id },
          data: { son_mesaj_de: new Date(), yenilendi: new Date() },
        }),
        prisma.team_uzv.update({
          where: { kanal_id_istifadeci_id: { kanal_id: d.kanal_id, istifadeci_id: istifadeciId } },
          data: { son_oxudu_de: new Date() },
        }).catch(() => null),
        prisma.team_mesaj_log.create({
          data: {
            sahibkar_id: sahibkarId,
            kanal_id: d.kanal_id,
            mesaj_id: created.id,
            gonderici_id: istifadeciId,
            event_user_id: istifadeciId,
            mesaj_metni: d.mesaj.trim(),
            novu: "created",
            metadata: {
              gizli: d.gizli,
              bir_dafelik: d.bir_dafelik,
              kilidli: !!kilidHash,
              eklenti: !!d.eklenti_url,
            },
          },
        }),
      ]);

      // YENİ: @mention bildiriş fanout
      if (mentionIds.length > 0) {
        const { mentions } = await getChannelNotifyTargets(d.kanal_id, istifadeciId, mentionIds);
        if (mentions.length > 0) {
          const link = `/team?k=${d.kanal_id}`;
          await prisma.bildirisler.createMany({
            data: mentions.map((uid) => ({
              istifadeci_id: uid,
              sahibkar_id: sahibkarId,
              basliq: `Söhbətdə qeyd: ${kanal.ad}`,
              metn: d.mesaj.length > 200 ? d.mesaj.slice(0, 200) + "…" : d.mesaj,
              nov: "team_mention",
              link,
              resurs_nov: "team_mesaj",
              resurs_id: String(created.id),
            })),
            skipDuplicates: true,
          });
          // Sidebar badge yenilə
          const { revalidateTag } = await import("next/cache");
          for (const uid of mentions) {
            try { revalidateTag(`bildirisler:${sahibkarId}:${uid}`, "max"); } catch { /* noop */ }
          }
        }
      }

      revalidatePath("/team");
      bustTeamCache();
      return { ok: true, data: { id: created.id } };
    } catch (e) {
      console.error("[sendTeamMessage]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Göndərilmədi: ${msg}` };
    }
  });
}

// === MARK READ ===

export async function markChannelRead(input: FormData): Promise<ActionResult> {
  const kanalId = Number(input.get("kanal_id"));
  if (!kanalId) return { ok: false, error: "Kanal yanlışdır" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const now = new Date();
      await prisma.team_uzv.updateMany({
        where: { kanal_id: kanalId, istifadeci_id: istifadeciId },
        data: { son_oxudu_de: now },
      });
      revalidatePath("/team");
      return { ok: true, data: { tarix: now.toISOString() } };
    } catch (e) {
      console.error("[markChannelRead]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

// === DELETE MESSAGE ===

export async function deleteTeamMessage(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const msg = await prisma.team_mesaj.findUnique({ where: { id } });
      if (!msg) return { ok: false, error: "Tapılmadı" };
      // Göndərici özü, ya da kanal admin silə bilər
      const canDelete = msg.gonderici_id === istifadeciId || (await isChannelAdmin(msg.kanal_id));
      if (!canDelete) return { ok: false, error: "Bu mesajı silmək icazəniz yoxdur" };

      const fullText = msg.mesaj;
      await Promise.all([
        prisma.team_mesaj.update({
          where: { id },
          data: { silindi: true, mesaj: "[silindi]", silen_id: istifadeciId, silinme_tarixi: new Date() },
        }),
        prisma.team_mesaj_log.create({
          data: {
            sahibkar_id: sahibkarId,
            kanal_id: msg.kanal_id,
            mesaj_id: id,
            gonderici_id: msg.gonderici_id,
            event_user_id: istifadeciId,
            mesaj_metni: fullText,
            novu: "deleted",
          },
        }),
      ]);
      revalidatePath("/team");
      bustTeamCache();
      await audit("sil", "team_mesaj", String(id), {
        yeni_data: { kanal_id: msg.kanal_id, gonderici_id: msg.gonderici_id, by_admin: msg.gonderici_id !== istifadeciId },
        sebeb: "Mesaj silindi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[deleteTeamMessage]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Silinmədi: ${msg}` };
    }
  });
}

// === UNLOCK / VIEW SECRET MESSAGE ===

const UnlockSchema = z.object({
  id: z.coerce.number().int().positive(),
  sifre: z.string().min(1).max(100),
});

export async function unlockMessage(input: FormData): Promise<{ ok: true; mesaj: string } | { ok: false; error: string }> {
  const parsed = UnlockSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Şifrə tələb olunur" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    const msg = await prisma.team_mesaj.findUnique({
      where: { id: d.id },
      include: { kanal: { select: { sahibkar_id: true } } },
    });
    if (!msg || msg.kanal.sahibkar_id !== sahibkarId) return { ok: false, error: "Tapılmadı" };
    if (msg.silindi) return { ok: false, error: "Mesaj artıq silinib" };
    if (!msg.kilid_sifre_hash) return { ok: false, error: "Bu mesaj kilidli deyil" };

    // YENİ: kanal üzvü deyilsə oxuya bilməz
    const memberCheck = await requireChannelMember(msg.kanal_id);
    if (!memberCheck.ok) return memberCheck;

    const bcrypt = await import("bcryptjs");
    const ok = await bcrypt.compare(d.sifre, msg.kilid_sifre_hash);
    if (!ok) {
      await prisma.team_mesaj_log.create({
        data: {
          sahibkar_id: sahibkarId,
          kanal_id: msg.kanal_id,
          mesaj_id: msg.id,
          gonderici_id: msg.gonderici_id,
          event_user_id: istifadeciId,
          mesaj_metni: "[şifrə yanlışdır]",
          novu: "unlock_failed",
        },
      });
      return { ok: false, error: "Şifrə yanlışdır" };
    }

    await prisma.team_mesaj_log.create({
      data: {
        sahibkar_id: sahibkarId,
        kanal_id: msg.kanal_id,
        mesaj_id: msg.id,
        gonderici_id: msg.gonderici_id,
        event_user_id: istifadeciId,
        mesaj_metni: msg.mesaj,
        novu: "unlocked",
      },
    });

    if (msg.bir_dafelik && msg.oxuyan_id === null) {
      await prisma.team_mesaj.update({
        where: { id: msg.id },
        data: {
          silindi: true,
          mesaj: "[bir dəfəlik mesaj — oxundu və silindi]",
          oxuyan_id: istifadeciId,
          oxundu_de: new Date(),
          silinme_tarixi: new Date(),
        },
      });
      await prisma.team_mesaj_log.create({
        data: {
          sahibkar_id: sahibkarId,
          kanal_id: msg.kanal_id,
          mesaj_id: msg.id,
          gonderici_id: msg.gonderici_id,
          event_user_id: istifadeciId,
          mesaj_metni: msg.mesaj,
          novu: "self_destruct",
        },
      });
      revalidatePath("/team");
    }

    return { ok: true, mesaj: msg.mesaj };
  });
}

// === MARK ONE-TIME READ (no password) ===

export async function readOneTimeMessage(input: FormData): Promise<{ ok: true; mesaj: string } | { ok: false; error: string }> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    const msg = await prisma.team_mesaj.findUnique({
      where: { id },
      include: { kanal: { select: { sahibkar_id: true } } },
    });
    if (!msg || msg.kanal.sahibkar_id !== sahibkarId) return { ok: false, error: "Tapılmadı" };
    if (msg.silindi) return { ok: false, error: "Artıq silinib" };
    if (!msg.bir_dafelik) return { ok: false, error: "Bu mesaj bir dəfəlik deyil" };
    if (msg.oxuyan_id) return { ok: false, error: "Mesaj artıq oxunub" };

    // YENİ: kanal üzvü olmayan oxuya bilməz
    const memberCheck = await requireChannelMember(msg.kanal_id);
    if (!memberCheck.ok) return memberCheck;

    if (msg.gonderici_id === istifadeciId) {
      return { ok: true, mesaj: msg.mesaj };
    }

    await prisma.$transaction([
      prisma.team_mesaj.update({
        where: { id },
        data: {
          silindi: true,
          mesaj: "[bir dəfəlik mesaj — oxundu və silindi]",
          oxuyan_id: istifadeciId,
          oxundu_de: new Date(),
          silinme_tarixi: new Date(),
        },
      }),
      prisma.team_mesaj_log.create({
        data: {
          sahibkar_id: sahibkarId,
          kanal_id: msg.kanal_id,
          mesaj_id: msg.id,
          gonderici_id: msg.gonderici_id,
          event_user_id: istifadeciId,
          mesaj_metni: msg.mesaj,
          novu: "self_destruct",
        },
      }),
    ]);
    revalidatePath("/team");
    bustTeamCache();
    return { ok: true, mesaj: msg.mesaj };
  });
}

// === ADD/REMOVE MEMBER ===

const MemberSchema = z.object({
  kanal_id: z.coerce.number().int().positive(),
  istifadeci_id: z.string().uuid(),
});

export async function addChannelMember(input: FormData): Promise<ActionResult> {
  const parsed = MemberSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };

    // Channel admin yoxlanması
    const adminCheck = await requireChannelAdmin(d.kanal_id);
    if (!adminCheck.ok) return adminCheck;

    try {
      const kanal = await prisma.team_kanal.findFirst({
        where: { id: d.kanal_id, sahibkar_id: sahibkarId },
      });
      if (!kanal) return { ok: false, error: "Kanal tapılmadı" };

      // Aktiv işçi yoxlanması
      const valid = await prisma.istifadeciler.findFirst({
        where: { id: d.istifadeci_id, sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad_soyad: true },
      });
      if (!valid) return { ok: false, error: "Aktiv işçi tapılmadı" };

      await prisma.team_uzv.upsert({
        where: { kanal_id_istifadeci_id: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id } },
        create: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id, rolu: "uzv" },
        update: {},
      });
      revalidatePath("/team");
      bustTeamCache();
      await audit("uzv_elave", "team_kanal", String(d.kanal_id), {
        yeni_data: { kanal: kanal.ad, istifadeci_id: d.istifadeci_id, ad_soyad: valid.ad_soyad },
        sebeb: `Kanala üzv əlavə: ${valid.ad_soyad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[addChannelMember]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Əlavə olunmadı: ${msg}` };
    }
  });
}

export async function removeChannelMember(input: FormData): Promise<ActionResult> {
  const parsed = MemberSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };

    // YENİ: özünü çıxara bilər, başqasını çıxarmaq üçün admin lazım
    if (d.istifadeci_id !== istifadeciId) {
      const adminCheck = await requireChannelAdmin(d.kanal_id);
      if (!adminCheck.ok) return adminCheck;
    }

    try {
      const before = await prisma.team_uzv.findUnique({
        where: { kanal_id_istifadeci_id: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id } },
        include: { istifadeci: { select: { ad_soyad: true } } },
      });
      if (!before) return { ok: false, error: "Üzv tapılmadı" };

      // YENİ: son admin-i çıxarmaq olmaz
      if (before.rolu === "admin") {
        const adminCount = await prisma.team_uzv.count({
          where: { kanal_id: d.kanal_id, rolu: "admin" },
        });
        if (adminCount <= 1) {
          return { ok: false, error: "Son kanal admin-i çıxarıla bilməz — əvvəl başqa admin təyin edin" };
        }
      }

      await prisma.team_uzv.deleteMany({
        where: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id },
      });
      revalidatePath("/team");
      bustTeamCache();
      await audit("uzv_cixar", "team_kanal", String(d.kanal_id), {
        yeni_data: {
          istifadeci_id: d.istifadeci_id,
          ad_soyad: before.istifadeci?.ad_soyad ?? null,
          self: d.istifadeci_id === istifadeciId,
        },
        sebeb: d.istifadeci_id === istifadeciId ? "Üzv özü kanaldan çıxdı" : "Üzv kanaldan çıxarıldı",
      });
      return { ok: true };
    } catch (e) {
      console.error("[removeChannelMember]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Silinmədi: ${msg}` };
    }
  });
}

// === TOGGLE NOTIFICATION FOR CHANNEL ===

const ToggleNotifSchema = z.object({
  kanal_id: z.coerce.number().int().positive(),
  value: boolFromForm,
});

export async function toggleChannelNotif(input: FormData): Promise<ActionResult> {
  const parsed = ToggleNotifSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      await prisma.team_uzv.updateMany({
        where: { kanal_id: d.kanal_id, istifadeci_id: istifadeciId },
        data: { bildiris: d.value },
      });
      revalidatePath("/team");
      return { ok: true };
    } catch (e) {
      console.error("[toggleChannelNotif]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

// === ARCHIVE CHANNEL ===

export async function archiveChannel(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  // Channel admin yoxlanması
  const adminCheck = await requireChannelAdmin(id);
  if (!adminCheck.ok) return adminCheck;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const before = await prisma.team_kanal.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: { ad: true, arxivlendi: true },
      });
      if (!before) return { ok: false, error: "Kanal tapılmadı" };
      await prisma.team_kanal.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { arxivlendi: true, yenilendi: new Date() },
      });
      revalidatePath("/team");
      bustTeamCache();
      await audit("arxiv", "team_kanal", String(id), {
        evvelki_data: { arxivlendi: before.arxivlendi },
        yeni_data: { arxivlendi: true, ad: before.ad },
        sebeb: `Kanal arxivləndi: ${before.ad}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[archiveChannel]", e);
      return { ok: false, error: "Arxivlənmədi" };
    }
  });
}

// === SETTINGS ===

const TeamAyarSchema = z.object({
  field: z.enum([
    "aktiv",
    "filial_kanal_avto",
    "general_kanal_avto",
    "bildiris_push",
    "bildiris_email",
    "bildiris_inapp",
  ]),
  value: boolFromForm,
});

export async function toggleTeamAyar(input: FormData): Promise<ActionResult> {
  const orgCheck = await requireTeamOrgAdmin();
  if (!orgCheck.ok) return { ok: false, error: orgCheck.error };
  const parsed = TeamAyarSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.team_ayar.upsert({
        where: { sahibkar_id: sahibkarId },
        create: { sahibkar_id: sahibkarId, [d.field]: d.value },
        update: { [d.field]: d.value, yenilendi: new Date() },
      });
      revalidatePath("/team");
      revalidatePath("/ayarlar/team");
      bustTeamCache();
      await audit("yenile", "team_ayar", null, {
        yeni_data: { [d.field]: d.value },
        sebeb: `Team ayarı: ${d.field} = ${d.value}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[toggleTeamAyar]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

const RetentionSchema = z.object({
  retention_gun: z.coerce.number().int().min(7).max(3650),
});

export async function saveTeamRetention(input: FormData): Promise<ActionResult> {
  const orgCheck = await requireTeamOrgAdmin();
  if (!orgCheck.ok) return { ok: false, error: orgCheck.error };
  const parsed = RetentionSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Müddət 7-3650 gün aralığında olmalıdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const before = await prisma.team_ayar.findUnique({
        where: { sahibkar_id: sahibkarId },
        select: { retention_gun: true },
      });
      await prisma.team_ayar.upsert({
        where: { sahibkar_id: sahibkarId },
        create: { sahibkar_id: sahibkarId, retention_gun: d.retention_gun },
        update: { retention_gun: d.retention_gun, yenilendi: new Date() },
      });
      revalidatePath("/ayarlar/team");
      bustTeamCache();
      await audit("yenile", "team_ayar", null, {
        evvelki_data: { retention_gun: before?.retention_gun ?? null },
        yeni_data: { retention_gun: d.retention_gun },
        sebeb: `Saxlanma müddəti: ${d.retention_gun} gün`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveTeamRetention]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function ensureGeneralChannel(): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      // Case-insensitive yoxlama
      const existing = await prisma.team_kanal.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          novu: "kanal",
          ad: { equals: "ümumi", mode: "insensitive" },
        },
      });
      if (existing) {
        await prisma.team_uzv.upsert({
          where: { kanal_id_istifadeci_id: { kanal_id: existing.id, istifadeci_id: istifadeciId } },
          create: { kanal_id: existing.id, istifadeci_id: istifadeciId, rolu: "uzv" },
          update: {},
        });
        return { ok: true, data: { id: existing.id } };
      }

      const users = await prisma.istifadeciler.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true },
      });

      const kanal = await prisma.team_kanal.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: "ümumi",
          tesvir: "Şirkətin ümumi kanalı — bütün aktiv əməkdaşlar avto-üzv",
          novu: "kanal",
          qapali: false,
          yaradan_id: istifadeciId,
          uzvler: {
            create: users.map((u) => ({
              istifadeci_id: u.id,
              rolu: u.id === istifadeciId ? "admin" : "uzv",
            })),
          },
        },
      });
      revalidatePath("/team");
      bustTeamCache();
      await audit("yarat", "team_kanal", String(kanal.id), {
        yeni_data: { ad: "ümumi", novu: "kanal", uzv_sayi: users.length, auto: true },
        sebeb: "Ümumi kanal avtomatik yaradıldı",
      });
      return { ok: true, data: { id: kanal.id } };
    } catch (e) {
      console.error("[ensureGeneralChannel]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

// 1) Mesaj redaktə (5 dəqiqə pəncərə + tarixçə)
const EditSchema = z.object({
  id: z.coerce.number().int().positive(),
  mesaj: z.string().min(1).max(2500),
});

export async function editTeamMessage(input: FormData): Promise<ActionResult> {
  const parsed = EditSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const msg = await prisma.team_mesaj.findUnique({ where: { id: d.id } });
      if (!msg) return { ok: false, error: "Tapılmadı" };
      if (msg.silindi) return { ok: false, error: "Silinmiş mesaj redaktə oluna bilməz" };
      if (msg.gonderici_id !== istifadeciId) return { ok: false, error: "Yalnız öz mesajınızı redaktə edə bilərsiniz" };

      // 5 dəqiqə pəncərə
      const EDIT_WINDOW_MIN = 5;
      const elapsedMin = (Date.now() - msg.yaradildi.getTime()) / 60000;
      if (elapsedMin > EDIT_WINDOW_MIN) {
        return { ok: false, error: `Mesaj yalnız ilk ${EDIT_WINDOW_MIN} dəqiqə ərzində redaktə oluna bilər` };
      }

      const originalText = msg.mesaj;
      await Promise.all([
        prisma.team_mesaj.update({
          where: { id: d.id },
          data: { mesaj: d.mesaj.trim(), edit_de: new Date() },
        }),
        prisma.team_mesaj_log.create({
          data: {
            sahibkar_id: sahibkarId,
            kanal_id: msg.kanal_id,
            mesaj_id: d.id,
            gonderici_id: msg.gonderici_id,
            event_user_id: istifadeciId,
            mesaj_metni: originalText,
            novu: "edited",
            metadata: { yeni_mesaj: d.mesaj.trim() },
          },
        }),
      ]);
      revalidatePath("/team");
      bustTeamCache();
      return { ok: true };
    } catch (e) {
      console.error("[editTeamMessage]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Redaktə alınmadı: ${msg}` };
    }
  });
}

// 2) Emoji reaction-lar
const ReactSchema = z.object({
  id: z.coerce.number().int().positive(),
  emoji: z.string().min(1).max(8),
});

export async function toggleReaction(input: FormData): Promise<ActionResult> {
  const parsed = ReactSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const msg = await prisma.team_mesaj.findUnique({ where: { id: d.id } });
      if (!msg) return { ok: false, error: "Tapılmadı" };
      if (msg.silindi) return { ok: false, error: "Silinmiş mesaj" };

      // YENİ: kanal üzvü olmayan reaksiya verə bilməz
      const memberCheck = await requireChannelMember(msg.kanal_id);
      if (!memberCheck.ok) return memberCheck;

      // reaksiyalar: { "👍": ["uid1", "uid2"], "❤️": ["uid3"] }
      const current = ((msg.reaksiyalar as Record<string, string[]> | null) ?? {});
      const list = Array.isArray(current[d.emoji]) ? [...current[d.emoji]] : [];
      const idx = list.indexOf(istifadeciId);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(istifadeciId);
      }
      const next = { ...current };
      if (list.length > 0) next[d.emoji] = list;
      else delete next[d.emoji];

      await prisma.team_mesaj.update({
        where: { id: d.id },
        data: { reaksiyalar: next },
      });
      revalidatePath("/team");
      return { ok: true, data: { reactions: next } };
    } catch (e) {
      console.error("[toggleReaction]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

// 3) Kanal admin promote / demote
const RoleChangeSchema = z.object({
  kanal_id: z.coerce.number().int().positive(),
  istifadeci_id: z.string().uuid(),
  rolu: z.enum(["admin", "uzv"]),
});

export async function changeChannelMemberRole(input: FormData): Promise<ActionResult> {
  const parsed = RoleChangeSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  const adminCheck = await requireChannelAdmin(d.kanal_id);
  if (!adminCheck.ok) return adminCheck;
  return withTenant(async () => {
    try {
      const before = await prisma.team_uzv.findUnique({
        where: { kanal_id_istifadeci_id: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id } },
        include: { istifadeci: { select: { ad_soyad: true } } },
      });
      if (!before) return { ok: false, error: "Üzv tapılmadı" };

      // Son admin-i demote etmək olmaz
      if (before.rolu === "admin" && d.rolu === "uzv") {
        const adminCount = await prisma.team_uzv.count({
          where: { kanal_id: d.kanal_id, rolu: "admin" },
        });
        if (adminCount <= 1) {
          return { ok: false, error: "Son kanal admin-i adi üzv ola bilməz" };
        }
      }

      await prisma.team_uzv.update({
        where: { kanal_id_istifadeci_id: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id } },
        data: { rolu: d.rolu },
      });
      revalidatePath("/team");
      bustTeamCache();
      await audit("rol_deyis", "team_uzv", String(d.kanal_id), {
        evvelki_data: { rolu: before.rolu },
        yeni_data: { rolu: d.rolu, istifadeci_id: d.istifadeci_id, ad_soyad: before.istifadeci?.ad_soyad ?? null },
        sebeb: `Üzv rolu dəyişdi: ${before.rolu} → ${d.rolu}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[changeChannelMemberRole]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

// 4) Bulk üzv əlavə (multi-select)
const BulkAddSchema = z.object({
  kanal_id: z.coerce.number().int().positive(),
  istifadeci_ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function bulkAddChannelMembers(
  kanalId: number,
  istifadeciIds: string[],
): Promise<{ ok: true; added: number; skipped: number } | { ok: false; error: string }> {
  const parsed = BulkAddSchema.safeParse({ kanal_id: kanalId, istifadeci_ids: istifadeciIds });
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const adminCheck = await requireChannelAdmin(kanalId);
  if (!adminCheck.ok) return adminCheck;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Yalnız aktiv işçilər
      const valid = await prisma.istifadeciler.findMany({
        where: { id: { in: parsed.data.istifadeci_ids }, sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true },
      });
      let added = 0;
      let skipped = 0;
      for (const u of valid) {
        try {
          await prisma.team_uzv.create({
            data: { kanal_id: kanalId, istifadeci_id: u.id, rolu: "uzv" },
          });
          added++;
        } catch {
          skipped++; // Artıq üzv
        }
      }
      revalidatePath("/team");
      bustTeamCache();
      await audit("bulk_uzv_elave", "team_kanal", String(kanalId), {
        yeni_data: { added, skipped, isteklen: parsed.data.istifadeci_ids.length },
        sebeb: `Bulk üzv əlavə: ${added}`,
      });
      return { ok: true, added, skipped };
    } catch (e) {
      console.error("[bulkAddChannelMembers]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

// 5) Mesaj axtarış
export type SearchMessageResult = {
  id: number;
  kanal_id: number;
  kanal_ad: string;
  gonderici_id: string | null;
  gonderici_ad: string | null;
  mesaj: string;
  yaradildi: Date;
};

export async function searchTeamMessages(
  query: string,
  kanalId?: number,
  limit = 50,
): Promise<{ ok: true; results: SearchMessageResult[] } | { ok: false; error: string }> {
  const q = query.trim();
  if (q.length < 2) return { ok: false, error: "Axtarış mətni 2 simvoldan qısa ola bilməz" };
  if (q.length > 100) return { ok: false, error: "Axtarış mətni 100 simvoldan uzun ola bilməz" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      // İstifadəçinin üzv olduğu kanalları çək
      const memberChannels = await prisma.team_uzv.findMany({
        where: { istifadeci_id: istifadeciId },
        select: { kanal_id: true },
      });
      const allowedIds = memberChannels.map((m) => m.kanal_id);
      if (kanalId && !allowedIds.includes(kanalId)) {
        return { ok: false, error: "Bu kanala giriş icazəniz yoxdur" };
      }
      const finalIds = kanalId ? [kanalId] : allowedIds;
      if (finalIds.length === 0) return { ok: true, results: [] };

      const rows = await prisma.team_mesaj.findMany({
        where: {
          kanal_id: { in: finalIds },
          silindi: false,
          kilid_sifre_hash: null, // Kilidli mesajları axtarış nəticəsində göstərmə
          mesaj: { contains: q, mode: "insensitive" },
        },
        include: {
          gonderici: { select: { id: true, ad_soyad: true } },
          kanal: { select: { id: true, ad: true } },
        },
        orderBy: { yaradildi: "desc" },
        take: Math.min(Math.max(1, limit), 100),
      });

      return {
        ok: true,
        results: rows.map((r) => ({
          id: r.id,
          kanal_id: r.kanal_id,
          kanal_ad: r.kanal.ad,
          gonderici_id: r.gonderici_id,
          gonderici_ad: r.gonderici?.ad_soyad ?? null,
          mesaj: r.mesaj,
          yaradildi: r.yaradildi,
        })),
      };
    } catch (e) {
      console.error("[searchTeamMessages]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Axtarış alınmadı: ${msg}` };
    }
  });
}

// 6) Kanal statistikası
export type ChannelStats = {
  kanal_id: number;
  ad: string;
  uzv_sayi: number;
  admin_sayi: number;
  cemi_mesaj: number;
  bu_gun_mesaj: number;
  ehtiv_aktiv_uzv: { istifadeci_id: string; ad_soyad: string | null; mesaj_sayi: number }[];
  son_aktivlik: Date | null;
};

export async function getChannelStats(kanalId: number): Promise<
  { ok: true; data: ChannelStats } | { ok: false; error: string }
> {
  const memberCheck = await requireChannelMember(kanalId);
  if (!memberCheck.ok) return memberCheck;
  return withTenant(async () => {
    try {
      const kanal = await prisma.team_kanal.findUnique({
        where: { id: kanalId },
        select: { id: true, ad: true, son_mesaj_de: true },
      });
      if (!kanal) return { ok: false, error: "Kanal tapılmadı" };

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      const [uzvler, adminSay, cemi, buGun, topRows] = await Promise.all([
        prisma.team_uzv.count({ where: { kanal_id: kanalId } }),
        prisma.team_uzv.count({ where: { kanal_id: kanalId, rolu: "admin" } }),
        prisma.team_mesaj.count({ where: { kanal_id: kanalId, silindi: false } }),
        prisma.team_mesaj.count({
          where: { kanal_id: kanalId, silindi: false, yaradildi: { gte: dayStart } },
        }),
        prisma.team_mesaj.groupBy({
          by: ["gonderici_id"],
          where: { kanal_id: kanalId, silindi: false, gonderici_id: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { gonderici_id: "desc" } },
          take: 5,
        }),
      ]);

      const senderIds = topRows.map((r) => r.gonderici_id).filter((id): id is string => !!id);
      const users = await prisma.istifadeciler.findMany({
        where: { id: { in: senderIds } },
        select: { id: true, ad_soyad: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.ad_soyad]));

      return {
        ok: true,
        data: {
          kanal_id: kanal.id,
          ad: kanal.ad,
          uzv_sayi: uzvler,
          admin_sayi: adminSay,
          cemi_mesaj: cemi,
          bu_gun_mesaj: buGun,
          ehtiv_aktiv_uzv: topRows.map((r) => ({
            istifadeci_id: r.gonderici_id!,
            ad_soyad: userMap.get(r.gonderici_id!) ?? null,
            mesaj_sayi: r._count._all,
          })),
          son_aktivlik: kanal.son_mesaj_de,
        },
      };
    } catch (e) {
      console.error("[getChannelStats]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Statistika alınmadı: ${msg}` };
    }
  });
}

// 7) Kanal unread sayğacı
export async function getUnreadCounts(): Promise<
  { ok: true; counts: { kanal_id: number; unread: number; mention: boolean }[] } | { ok: false; error: string }
> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const memberships = await prisma.team_uzv.findMany({
        where: { istifadeci_id: istifadeciId },
        select: { kanal_id: true, son_oxudu_de: true },
      });
      if (memberships.length === 0) return { ok: true, counts: [] };

      const counts: { kanal_id: number; unread: number; mention: boolean }[] = [];
      for (const m of memberships) {
        const after = m.son_oxudu_de ?? new Date(0);
        const [unread, mentioned] = await Promise.all([
          prisma.team_mesaj.count({
            where: {
              kanal_id: m.kanal_id,
              silindi: false,
              yaradildi: { gt: after },
              gonderici_id: { not: istifadeciId },
            },
          }),
          prisma.team_mesaj.findFirst({
            where: {
              kanal_id: m.kanal_id,
              silindi: false,
              yaradildi: { gt: after },
              mention_ids: { has: istifadeciId },
            },
            select: { id: true },
          }),
        ]);
        if (unread > 0) {
          counts.push({ kanal_id: m.kanal_id, unread, mention: !!mentioned });
        }
      }
      return { ok: true, counts };
    } catch (e) {
      console.error("[getUnreadCounts]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

// 8) Kanal-dan çıxış (leave)
export async function leaveChannel(input: FormData): Promise<ActionResult> {
  const kanalId = Number(input.get("kanal_id"));
  if (!kanalId) return { ok: false, error: "Kanal yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };
    try {
      const isMember = await isChannelMember(kanalId, istifadeciId);
      if (!isMember) return { ok: false, error: "Bu kanala üzv deyilsiniz" };

      // Son admin-əmsə qoy əvvəl başqasını promote etsin
      const meAdmin = await isChannelAdmin(kanalId, istifadeciId);
      if (meAdmin) {
        const adminCount = await prisma.team_uzv.count({
          where: { kanal_id: kanalId, rolu: "admin" },
        });
        if (adminCount <= 1) {
          return { ok: false, error: "Tək admin olduğunuz üçün çıxa bilməzsiniz — əvvəl başqa admin təyin edin" };
        }
      }

      await prisma.team_uzv.deleteMany({
        where: { kanal_id: kanalId, istifadeci_id: istifadeciId },
      });
      revalidatePath("/team");
      bustTeamCache();
      await audit("cixis", "team_kanal", String(kanalId), {
        yeni_data: { sahibkar_id: sahibkarId },
        sebeb: "Üzv kanaldan çıxdı (self leave)",
      });
      return { ok: true };
    } catch (e) {
      console.error("[leaveChannel]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}
