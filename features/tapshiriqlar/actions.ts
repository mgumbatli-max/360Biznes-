"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";

/** Sahibkar/admin avtomatik, digərləri üçün icazə yoxlanır. */
async function requireTapshiriqPerm(perm: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Giriş tələb olunur" };
  const rolAd = (session.user.rol_ad ?? "").toLowerCase();
  if (rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin")) {
    return { ok: true };
  }
  const perms = await getRequestPermissions();
  if (!perms.includes(perm)) return { ok: false, error: `Bu əməliyyat üçün «${perm}» icazəsi lazımdır` };
  return { ok: true };
}

// ============================================================
// `qeyd_daxili` struktur-tag helpers
// Format: `[KEY:value] [KEY2:v1,v2]` — bir-birinə qarışmayan teqlər
// Mövcud REMINDER teqi saxlanır.
// ============================================================

function stripTags(text: string | null | undefined, ...keys: string[]): string {
  if (!text) return "";
  let out = text;
  for (const k of keys) {
    const rx = new RegExp(`\\[${k}:[^\\]]*\\]`, "g");
    out = out.replace(rx, "");
  }
  return out.trim();
}

function mergeQeyd(existing: string | null | undefined, ...newTags: string[]): string | null {
  const all = newTags.filter(Boolean);
  const usedKeys: string[] = [];
  for (const t of all) {
    const km = t.match(/^\[([A-Z_]+):/);
    if (km) usedKeys.push(km[1]);
  }
  const clean = stripTags(existing, ...usedKeys);
  const result = [clean, ...all].filter(Boolean).join(" ").trim();
  return result || null;
}

const CreateTaskSchema = z.object({
  basliq: z.string().min(2).max(200),
  tesvir: z.string().max(5000).optional().or(z.literal("")),
  mesul_id: z.string().uuid().optional().or(z.literal("")),
  prioritet: z.enum(["asagi", "normal", "yuksek", "tecili"]).default("normal"),
  tip: z.string().max(40).optional().or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
  xatirlatma: z.string().optional().or(z.literal("")),
  gorunurluk: z.enum(["sexsi", "secilmish", "umumi"]).default("sexsi"),
  icracilar: z.array(z.string().uuid()).optional(),
  reng: z.string().max(40).optional().or(z.literal("")),
  obyekt_nov: z.string().max(40).optional().or(z.literal("")),
  obyekt_id: z.string().max(100).optional().or(z.literal("")),
  obyekt_basliq: z.string().max(300).optional().or(z.literal("")),
  requires_approval: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
  escalation_enabled: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
  /** Hamı aktiv işçiyə paylaş — icracilar avtomatik dolur */
  broadcast_all: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
  /** Telegram bildirişi göndər (sahibkar konfiqurasiyası varsa) */
  send_telegram: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
});

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createTask(input: FormData | z.input<typeof CreateTaskSchema>): Promise<ActionResult> {
  // İcazə: tapshiriq.yarat tələb olunur
  const permCheck = await requireTapshiriqPerm("tapshiriq.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  if (input instanceof FormData) {
    const icr = input.getAll("icracilar").map((v) => String(v)).filter(Boolean);
    (raw as Record<string, unknown>).icracilar = icr;
  }
  const parsed = CreateTaskSchema.safeParse(raw);
  if (!parsed.success) { const i = parsed.error.issues[0]; return { ok: false, error: `Forma yanlışdır: ${i?.path.join(".") || "?"} — ${i?.message || "naməlum"}` }; }
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Başqasına atamağa icazə yoxdursa — mesul_id və icracilar yalnız özü ola bilər
      const assignCheck = await requireTapshiriqPerm("tapshiriq.atayir");
      if (!assignCheck.ok) {
        const myId = istifadeciId;
        if (d.mesul_id && d.mesul_id !== myId) {
          return { ok: false, error: "Başqasına tapşırıq atamaq üçün «tapshiriq.atayir» icazəsi lazımdır" };
        }
        // icracilar siyahısını yalnız özünə məhdudlaşdır
        d.icracilar = (d.icracilar ?? []).filter((id) => id === myId);
        // broadcast_all icazəsizdir
        if (d.broadcast_all === "1" || d.broadcast_all === "on") {
          return { ok: false, error: "Hamıya yayım üçün «tapshiriq.atayir» icazəsi lazımdır" };
        }
      }
      const requiresApproval = d.requires_approval === "1" || d.requires_approval === "on";
      const escalationEnabled = d.escalation_enabled === "1" || d.escalation_enabled === "on";
      const broadcastAll = d.broadcast_all === "1" || d.broadcast_all === "on";
      const sendTelegram = d.send_telegram === "1" || d.send_telegram === "on";

      // Broadcast: bütün aktiv əməkdaşları icracilar siyahısına əlavə et
      const assigneeSet = new Set<string>((d.icracilar ?? []).filter(Boolean));
      if (d.mesul_id) assigneeSet.add(d.mesul_id);
      if (broadcastAll) {
        const allActive = await prisma.istifadeciler.findMany({
          where: { aktiv: true, sahibkar_id: sahibkarId },
          select: { id: true },
        });
        for (const u of allActive) assigneeSet.add(u.id);
      }
      const allAssignees = Array.from(assigneeSet);

      // `qeyd_daxili`-yə struktur teqləri yığ
      const tags: string[] = [];
      if (allAssignees.length > 1) {
        tags.push(`[ASSIGNEES:${allAssignees.join(",")}]`);
      }
      if (d.reng) {
        tags.push(`[COLOR:${d.reng}]`);
      }
      const initialQeyd = mergeQeyd(null, ...tags);

      const task = await prisma.$transaction(async (tx) => {
        const t = await tx.tapshiriqlar.create({
          data: {
            sahibkar_id: sahibkarId,
            basliq: d.basliq,
            tesvir: d.tesvir || null,
            mesul_id: d.mesul_id || null,
            prioritet: d.prioritet,
            tip: d.tip || "adi",
            deadline: d.deadline ? new Date(d.deadline) : null,
            xatirlatma: d.xatirlatma ? new Date(d.xatirlatma) : null,
            yaradan_id: istifadeciId,
            gorunurluk: d.gorunurluk,
            status: "yeni",
            requires_approval: requiresApproval,
            escalation_enabled: escalationEnabled,
            qeyd_daxili: initialQeyd,
          },
        });

        // tapshiriq_iscilier.rol CHECK constraint: yalnız "icraci" və "musahide".
        // Mesul artıq tapshiriqlar.mesul_id-də saxlanır; bu cədvələ də "icraci"
        // kimi yazırıq ki, "mənim tapşırıqlarım" sorğusu hər iki yerdən tapsın.
        const links: Array<{ tapshiriq_id: string; istifadeci_id: string; rol: string }> = [];
        if (d.mesul_id) {
          links.push({ tapshiriq_id: t.id, istifadeci_id: d.mesul_id, rol: "icraci" });
        }
        for (const u of d.icracilar ?? []) {
          if (u && u !== d.mesul_id) {
            links.push({ tapshiriq_id: t.id, istifadeci_id: u, rol: "icraci" });
          }
        }
        if (links.length) {
          await tx.tapshiriq_iscilier.createMany({ data: links, skipDuplicates: true });
        }

        // ERP obyekt bağlanması
        if (d.obyekt_nov && d.obyekt_id) {
          await tx.tapshiriq_obyektleri.create({
            data: {
              tapshiriq_id: t.id,
              sahibkar_id: sahibkarId,
              obyekt_nov: d.obyekt_nov,
              obyekt_id: d.obyekt_id,
              obyekt_basliq: d.obyekt_basliq || null,
            },
          });
        }

        // İlk xatırlatma daxiletmə cədvəlinə yaz
        if (d.xatirlatma) {
          await tx.tapshiriq_xatirlatmalar.create({
            data: {
              tapshiriq_id: t.id,
              sahibkar_id: sahibkarId,
              istifadeci_id: d.mesul_id || istifadeciId,
              xatirlatma_de: new Date(d.xatirlatma),
              kanal: "erp",
            },
          });
        }

        // Bildirişlər — yaradılan tapşırıq haqqında bütün icraçılara xəbər
        const notifyUsers = new Set<string>(allAssignees);
        notifyUsers.delete(istifadeciId);
        const notifiedIds: string[] = [];
        if (notifyUsers.size > 0) {
          await tx.bildirisler.createMany({
            data: Array.from(notifyUsers).map((uid) => ({
              istifadeci_id: uid,
              sahibkar_id: sahibkarId,
              basliq: `Yeni tapşırıq: ${d.basliq}`,
              metn: d.tesvir ?? null,
              nov: "tapshiriq_yeni",
              link: `/tapshiriqlar/${t.id}`,
              resurs_nov: "tapshiriq",
              resurs_id: t.id,
            })),
            skipDuplicates: true,
          });
          notifiedIds.push(...Array.from(notifyUsers));
        }

        return { t, notifiedIds };
      });

      // Hər bildiriş alanın bell-i dərhal yenilənsin
      for (const uid of task.notifiedIds) {
        revalidateTag(`bildirisler:${sahibkarId}:${uid}`, "max");
      }

      // Telegram bildirişi — sahibkar konfiqurasiyası varsa, fire-and-forget
      // (göndərmə uğursuz olsa belə tapşırıq yaradılması pozulmur)
      if (sendTelegram) {
        sendTaskTelegram(sahibkarId, {
          id: task.t.id,
          basliq: d.basliq,
          tesvir: d.tesvir,
          deadline: d.deadline ? new Date(d.deadline) : null,
          prioritet: d.prioritet,
          assigneeCount: task.notifiedIds.length,
        }).catch((e) => console.warn("[sendTaskTelegram]", e));
      }

      revalidatePath("/tapshiriqlar");
      try {
        revalidateTag(`mywork:${requireTenant().sahibkarId}`, "max");
      } catch { /* tenant context missing — TTL will catch */ }
      return { ok: true, id: task.t.id };
    } catch (e) {
      console.error("[createTask]", e);
      return { ok: false, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/**
 * Sahibkar-spesifik Telegram chat-inə tapşırıq haqqında məlumat göndərir.
 * `ayarlar` cədvəlində qrup="telegram", acar="chat_id" gözləyir.
 */
async function sendTaskTelegram(
  sahibkarId: string,
  task: { id: string; basliq: string; tesvir?: string | null; deadline: Date | null; prioritet: string; assigneeCount: number },
): Promise<void> {
  const { sendTelegramMessage, escapeTelegramHtml, isTelegramConfigured } = await import("@/lib/telegram/notifier");
  if (!isTelegramConfigured()) return;
  const cfg = await prisma.ayarlar.findFirst({
    where: { sahibkar_id: sahibkarId, qrup: "telegram", acar: "chat_id" },
    select: { deyer: true },
  }).catch(() => null);
  if (!cfg?.deyer) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3500";
  const priorityEmoji = task.prioritet === "tecili" ? "🔴" : task.prioritet === "yuksek" ? "🟠" : task.prioritet === "asagi" ? "🟢" : "🟡";
  const deadlineStr = task.deadline
    ? `\n🕒 <b>Son tarix:</b> ${task.deadline.toLocaleString("az-AZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
    : "";
  const assigneeStr = task.assigneeCount > 1 ? `\n👥 <b>İcraçı:</b> ${task.assigneeCount} nəfər` : "";
  const text = [
    `${priorityEmoji} <b>Yeni tapşırıq</b>`,
    "",
    `📋 ${escapeTelegramHtml(task.basliq)}`,
    task.tesvir ? `\n${escapeTelegramHtml(task.tesvir.slice(0, 400))}` : "",
    deadlineStr,
    assigneeStr,
  ].filter(Boolean).join("");

  await sendTelegramMessage({
    chatId: cfg.deyer,
    text,
    parseMode: "HTML",
    inlineKeyboard: [[{ text: "Tapşırığı aç", url: `${baseUrl}/tapshiriqlar/${task.id}` }]],
  }).catch(() => null);
}

export async function changeTaskStatus(taskId: string, status: "yeni" | "icrada" | "gozlemede" | "tamamlandi" | "legv"): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: any = { status, yenilendi: new Date() };
      if (status === "tamamlandi") patch.tamamlandi_de = new Date();
      if (status === "icrada") patch.baslandi_de = new Date();

      const existing = await prisma.tapshiriqlar.findFirst({
        where: { id: taskId, sahibkar_id: sahibkarId },
        select: { yaradan_id: true, basliq: true, mesul_id: true },
      });
      if (!existing) return { ok: false, error: "Tapşırıq tapılmadı" };

      await prisma.tapshiriqlar.update({ where: { id: taskId }, data: patch });

      // Status dəyişəndə tapşırığın yaradanını və məsulu xəbərdar et (özüm dəyişən deyiləmsə)
      const STATUS_LABEL: Record<string, string> = {
        yeni: "Yeni",
        icrada: "İcradadır",
        gozlemede: "Yoxlanılır",
        tamamlandi: "Tamamlandı",
        legv: "Ləğv edildi",
      };
      const targets = new Set<string>();
      if (existing.yaradan_id && existing.yaradan_id !== istifadeciId) targets.add(existing.yaradan_id);
      if (existing.mesul_id && existing.mesul_id !== istifadeciId) targets.add(existing.mesul_id);
      if (targets.size > 0) {
        await prisma.bildirisler.createMany({
          data: Array.from(targets).map((uid) => ({
            istifadeci_id: uid,
            sahibkar_id: sahibkarId,
            basliq: `Tapşırıq statusu: ${STATUS_LABEL[status] ?? status}`,
            metn: existing.basliq,
            nov: "tapshiriq_status",
            link: `/tapshiriqlar/${taskId}`,
            resurs_nov: "tapshiriq",
            resurs_id: taskId,
          })),
          skipDuplicates: true,
        });
        for (const uid of targets) {
          revalidateTag(`bildirisler:${sahibkarId}:${uid}`, "max");
        }
      }

      revalidatePath("/tapshiriqlar");
      try {
        revalidateTag(`mywork:${requireTenant().sahibkarId}`, "max");
      } catch { /* tenant context missing — TTL will catch */ }
      return { ok: true };
    } catch (e) {
      console.error("[changeTaskStatus]", e);
      return { ok: false, error: "Status dəyişdirilmədi" };
    }
  });
}

export async function addComment(taskId: string, metn: string): Promise<ActionResult> {
  const text = metn.trim();
  if (!text) return { ok: false, error: "Boş şərh ola bilməz" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      await prisma.tapshiriq_kommentleri.create({
        data: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: taskId,
          istifadeci_id: istifadeciId,
          metn: text,
        },
      });
      revalidatePath("/tapshiriqlar");
      try {
        revalidateTag(`mywork:${requireTenant().sahibkarId}`, "max");
      } catch { /* tenant context missing — TTL will catch */ }
      return { ok: true };
    } catch (e) {
      console.error("[addComment]", e);
      return { ok: false, error: "Şərh əlavə edilmədi" };
    }
  });
}

export async function toggleChecklist(itemId: string, done: boolean): Promise<ActionResult> {
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      await prisma.tapshiriq_checklist.update({
        where: { id: BigInt(itemId) },
        data: {
          tamamlandi: done,
          tamamlandi_de: done ? new Date() : null,
          tamamlanan_id: done ? istifadeciId : null,
        },
      });
      revalidatePath("/tapshiriqlar");
      try {
        revalidateTag(`mywork:${requireTenant().sahibkarId}`, "max");
      } catch { /* tenant context missing — TTL will catch */ }
      return { ok: true };
    } catch (e) {
      console.error("[toggleChecklist]", e);
      return { ok: false, error: "Yeniləmə alınmadı" };
    }
  });
}

// ============================================================
// Tapşırıq rəngi (COLOR teqi)
// ============================================================

export async function setTaskColor(taskId: string, reng: string): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const cleanReng = reng.trim().slice(0, 32);
      const t = await prisma.tapshiriqlar.findFirst({
        where: { id: taskId, sahibkar_id: sahibkarId },
        select: { qeyd_daxili: true },
      });
      if (!t) return { ok: false, error: "Tapşırıq tapılmadı" };
      const newQeyd = cleanReng
        ? mergeQeyd(t.qeyd_daxili, `[COLOR:${cleanReng}]`)
        : mergeQeyd(stripTags(t.qeyd_daxili, "COLOR"));
      await prisma.tapshiriqlar.update({
        where: { id: taskId },
        data: { qeyd_daxili: newQeyd, yenilendi: new Date() },
      });
      revalidatePath("/tapshiriqlar");
      try {
        revalidateTag(`mywork:${requireTenant().sahibkarId}`, "max");
      } catch { /* tenant context missing — TTL will catch */ }
      revalidatePath(`/tapshiriqlar/${taskId}`);
      return { ok: true, id: taskId };
    } catch (e) {
      console.error("[setTaskColor]", e);
      return { ok: false, error: "Rəng qoyulmadı" };
    }
  });
}

// ============================================================
// Reminder actions (genişləndirilib: KIME / GIZLILIK / İNDİ)
// ============================================================

const REPEAT_VALUES = ["yox", "gunluk", "heftelik", "ayliq"] as const;
const GIZLILIK_VALUES = ["yalniz_alan", "paylasilan", "umumi"] as const;

const SetReminderSchema = z.object({
  taskId: z.string().uuid(),
  datetime: z.string().min(1),
  repeat: z.enum(REPEAT_VALUES).optional(),
  message: z.string().max(500).optional(),
  kime_id: z.string().uuid().optional().or(z.literal("")),
  gizlilik: z.enum(GIZLILIK_VALUES).default("yalniz_alan"),
});

function buildReminderTag(repeat: string | undefined, message: string | undefined): string {
  const parts: string[] = [];
  if (repeat && repeat !== "yox") parts.push(`repeat=${repeat}`);
  if (message?.trim()) parts.push(`mesaj=${message.trim().replace(/\|/g, "_").replace(/\n/g, " ")}`);
  if (!parts.length) return "";
  return `[REMINDER:${parts.join("|")}]`;
}

export async function setTaskReminder(input: z.input<typeof SetReminderSchema>): Promise<ActionResult> {
  const parsed = SetReminderSchema.safeParse(input);
  if (!parsed.success) { const i = parsed.error.issues[0]; return { ok: false, error: `Forma yanlışdır: ${i?.path.join(".") || "?"} — ${i?.message || "naməlum"}` }; }
  const { taskId, datetime, repeat, message, kime_id, gizlilik } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const reminderDate = new Date(datetime);
      if (Number.isNaN(reminderDate.getTime())) {
        return { ok: false, error: "Tarix-vaxt yanlışdır" };
      }

      // Effektiv hədəf — kime_id verilibsə həmin istifadəçi, əks halda mesul/yaradan
      const targetUserId = kime_id || null;

      await prisma.$transaction(async (tx) => {
        const existing = await tx.tapshiriqlar.findFirst({
          where: { id: taskId, sahibkar_id: sahibkarId },
          select: { qeyd_daxili: true, mesul_id: true, basliq: true },
        });
        if (!existing) throw new Error("Tapşırıq tapılmadı");

        const remTag = buildReminderTag(repeat, message);
        // VIEWERS teqi: gizlilik + hədəf
        const viewersValue = `${gizlilik}|${targetUserId ?? "mesul"}`;
        const viewersTag = `[VIEWERS:${viewersValue}]`;
        const newQeyd = mergeQeyd(existing.qeyd_daxili, remTag, viewersTag);

        await tx.tapshiriqlar.update({
          where: { id: taskId },
          data: {
            xatirlatma: reminderDate,
            xatirlatma_gonderildi: false,
            qeyd_daxili: newQeyd,
            yenilendi: new Date(),
          },
        });

        await tx.tapshiriq_xatirlatmalar.create({
          data: {
            tapshiriq_id: taskId,
            sahibkar_id: sahibkarId,
            istifadeci_id: targetUserId || existing.mesul_id || istifadeciId,
            xatirlatma_de: reminderDate,
            kanal: "erp",
            qaydaya_gore: repeat && repeat !== "yox" ? `repeat-${repeat}` : null,
          },
        });

        // Əgər xatırlatma "indi" və ya keçmişdədirsə — dərhal bildiriş göndər
        const isNow = reminderDate.getTime() <= Date.now() + 60 * 1000; // 1 dəq tolerantlıq
        if (isNow) {
          const notifyUid = targetUserId || existing.mesul_id || istifadeciId;
          await tx.bildirisler.create({
            data: {
              istifadeci_id: notifyUid,
              sahibkar_id: sahibkarId,
              basliq: `Xatırlatma: ${existing.basliq}`,
              metn: message ?? null,
              nov: "tapshiriq_xatirlatma",
              link: `/tapshiriqlar/${taskId}`,
              resurs_nov: "tapshiriq",
              resurs_id: taskId,
            },
          });
          await tx.tapshiriq_xatirlatmalar.updateMany({
            where: {
              tapshiriq_id: taskId,
              istifadeci_id: notifyUid,
              xatirlatma_de: reminderDate,
            },
            data: { gonderildi: true, gonderildi_de: new Date() },
          });
          revalidateTag(`bildirisler:${sahibkarId}:${notifyUid}`, "max");
        }
      });

      revalidatePath("/tapshiriqlar");
      try {
        revalidateTag(`mywork:${requireTenant().sahibkarId}`, "max");
      } catch { /* tenant context missing — TTL will catch */ }
      revalidatePath(`/tapshiriqlar/${taskId}`);
      return { ok: true, id: taskId };
    } catch (e) {
      console.error("[setTaskReminder]", e);
      return { ok: false, error: "Xatırlatma qoyulmadı" };
    }
  });
}

// ============================================================
// Overdue check — admin-only cron entrypoint
// ============================================================

export async function runOverdueCheck(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { sahibkarId, rolAd } = requireTenant();
    // Yalnız admin və ya sahibkar manual işə sala bilər (digər istifadəçilər
    // üçün cron endpoint istifadə olunur).
    if (rolAd !== "admin" && rolAd !== "sahibkar") {
      return { ok: false, error: "İcazə yoxdur — yalnız admin/sahibkar yoxlama işə sala bilər" };
    }
    try {
      // alert_categories.kod = "tapshiriq" → bu kateqoriyaya yazırıq
      const tapshiriqCat = await prisma.alert_categories.findFirst({
        where: { kod: "tapshiriq" },
        select: { id: true },
      });
      if (!tapshiriqCat) {
        return { ok: false, error: "Sistem konfiqurasiyası: 'tapshiriq' alert kateqoriyası tapılmadı" };
      }

      const now = new Date();
      const overdueTasks = await prisma.tapshiriqlar.findMany({
        where: {
          sahibkar_id: sahibkarId,
          deadline: { lt: now },
          status: { notIn: ["tamamlandi", "legv"] },
          escalation_enabled: true,
        },
        select: { id: true, basliq: true, deadline: true, mesul_id: true, escalation_to: true },
      });

      let created = 0;
      for (const t of overdueTasks) {
        // Bu tapşırıq üçün artıq açıq alert varsa, yenisini yaratma
        const existing = await prisma.alerts.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            tapshiriq_id: t.id,
            kateqoriya_kod: "tapshiriq",
            rule_kod: "task_overdue_auto",
            status: { notIn: ["resolved", "dismissed"] },
          },
          select: { id: true },
        });
        if (existing) continue;

        await prisma.alerts.create({
          data: {
            sahibkar_id: sahibkarId,
            kateqoriya_id: tapshiriqCat.id,
            kateqoriya_kod: "tapshiriq",
            rule_kod: "task_overdue_auto",
            seviyye: "yuxsek",
            status: "yeni",
            basliq: `Gecikən tapşırıq: ${t.basliq}`.slice(0, 255),
            tesvir: `Tapşırıq son tarixi (${t.deadline?.toISOString() ?? "—"}) keçib və hələ tamamlanmayıb.`,
            obyekt_nov: "tapshiriq",
            obyekt_id: t.id,
            obyekt_basliq: t.basliq.slice(0, 255),
            assigned_to: t.escalation_to || t.mesul_id || null,
            due_at: t.deadline,
            tapshiriq_id: t.id,
          },
        });

        // Escalation: rəhbər varsa, ona bildiriş də göndər
        if (t.escalation_to) {
          await prisma.bildirisler.create({
            data: {
              istifadeci_id: t.escalation_to,
              sahibkar_id: sahibkarId,
              basliq: `Gecikən tapşırıq: ${t.basliq}`.slice(0, 200),
              metn: `Bu tapşırıq son tarixi keçib və əməkdaş hələ tamamlamayıb. Diqqətinizə.`,
              nov: "tapshiriq_gecikdi",
              link: `/tapshiriqlar/${t.id}`,
              resurs_nov: "tapshiriq",
              resurs_id: t.id,
            },
          }).catch(() => null);
          revalidateTag(`bildirisler:${sahibkarId}:${t.escalation_to}`, "max");
        }
        created += 1;
      }

      revalidatePath("/tapshiriqlar");
      revalidatePath("/xeberdarliqlar");
      try {
        revalidateTag(`mywork:${requireTenant().sahibkarId}`, "max");
      } catch { /* tenant context missing — TTL will catch */ }
      return { ok: true, created };
    } catch (e) {
      console.error("[runOverdueCheck]", e);
      return { ok: false, error: "Yoxlama uğursuz oldu" };
    }
  });
}
