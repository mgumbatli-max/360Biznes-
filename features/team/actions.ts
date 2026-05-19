"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

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

      // Always include the creator
      if (!uzvIds.includes(istifadeciId)) uzvIds.unshift(istifadeciId);

      // For direct messages, ensure no duplicate
      if (d.novu === "direct" && uzvIds.length === 2) {
        const a = uzvIds[0];
        const b = uzvIds[1];
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
        if (existing) {
          return { ok: true, data: { id: existing.id } };
        }
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
            create: uzvIds.map((id) => ({
              istifadeci_id: id,
              rolu: id === istifadeciId ? "admin" : "uzv",
            })),
          },
        },
      });

      revalidatePath("/team");
      return { ok: true, data: { id: kanal.id } };
    } catch (e) {
      console.error("[createChannel]", e);
      return { ok: false, error: "Kanal yaradılmadı" };
    }
  });
}

// === SEND MESSAGE ===

const SendMessageSchema = z.object({
  kanal_id: z.coerce.number().int().positive(),
  mesaj: z.string().min(1).max(5000),
  parent_id: z.coerce.number().int().positive().optional(),
  mention_ids: z.string().optional(),
  gizli: z.string().optional().transform((s) => s === "true" || s === "1"),
  bir_dafelik: z.string().optional().transform((s) => s === "true" || s === "1"),
  kilid_sifre: z.string().max(100).optional().or(z.literal("")),
});

export async function sendTeamMessage(input: FormData): Promise<ActionResult> {
  const parsed = SendMessageSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return { ok: false, error: "Giriş tələb olunur" };

    try {
      const kanal = await prisma.team_kanal.findFirst({
        where: { id: d.kanal_id, sahibkar_id: sahibkarId },
      });
      if (!kanal) return { ok: false, error: "Kanal tapılmadı" };

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
        }),
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
            },
          },
        }),
      ]);

      revalidatePath("/team");
      return { ok: true };
    } catch (e) {
      console.error("[sendTeamMessage]", e);
      return { ok: false, error: "Göndərilmədi" };
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
      await prisma.team_uzv.updateMany({
        where: { kanal_id: kanalId, istifadeci_id: istifadeciId },
        data: { son_oxudu_de: new Date() },
      });
      revalidatePath("/team");
      return { ok: true };
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
      if (msg.gonderici_id !== istifadeciId) return { ok: false, error: "Yalnız öz mesajınızı silə bilərsiniz" };

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
      return { ok: true };
    } catch (e) {
      console.error("[deleteTeamMessage]", e);
      return { ok: false, error: "Silinmədi" };
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

    // log success
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

    // self-destruct after read if applicable
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
    try {
      const kanal = await prisma.team_kanal.findFirst({
        where: { id: d.kanal_id, sahibkar_id: sahibkarId },
      });
      if (!kanal) return { ok: false, error: "Kanal tapılmadı" };
      await prisma.team_uzv.upsert({
        where: { kanal_id_istifadeci_id: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id } },
        create: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id, rolu: "uzv" },
        update: {},
      });
      revalidatePath("/team");
      return { ok: true };
    } catch (e) {
      console.error("[addChannelMember]", e);
      return { ok: false, error: "Əlavə olunmadı" };
    }
  });
}

export async function removeChannelMember(input: FormData): Promise<ActionResult> {
  const parsed = MemberSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    try {
      await prisma.team_uzv.deleteMany({
        where: { kanal_id: d.kanal_id, istifadeci_id: d.istifadeci_id },
      });
      revalidatePath("/team");
      return { ok: true };
    } catch (e) {
      console.error("[removeChannelMember]", e);
      return { ok: false, error: "Silinmədi" };
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
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.team_kanal.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { arxivlendi: true, yenilendi: new Date() },
      });
      revalidatePath("/team");
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
  const parsed = RetentionSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Müddət 7-3650 gün aralığında olmalıdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.team_ayar.upsert({
        where: { sahibkar_id: sahibkarId },
        create: { sahibkar_id: sahibkarId, retention_gun: d.retention_gun },
        update: { retention_gun: d.retention_gun, yenilendi: new Date() },
      });
      revalidatePath("/ayarlar/team");
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
      const existing = await prisma.team_kanal.findFirst({
        where: { sahibkar_id: sahibkarId, novu: "kanal", ad: "ümumi" },
      });
      if (existing) {
        // Ensure current user is member
        await prisma.team_uzv.upsert({
          where: { kanal_id_istifadeci_id: { kanal_id: existing.id, istifadeci_id: istifadeciId } },
          create: { kanal_id: existing.id, istifadeci_id: istifadeciId, rolu: "uzv" },
          update: {},
        });
        return { ok: true, data: { id: existing.id } };
      }

      // Add all active users
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
      return { ok: true, data: { id: kanal.id } };
    } catch (e) {
      console.error("[ensureGeneralChannel]", e);
      return { ok: false, error: "Yaradılmadı" };
    }
  });
}
