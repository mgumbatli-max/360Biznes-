"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { auth } from "@/auth";
import { getRequestPermissions } from "@/lib/auth/get-permissions";
import { audit } from "@/lib/audit/log";
import { formatDate } from "@/lib/utils";

/** Sahibkar/admin avtomatik, digərləri üçün icazə yoxlanır. */
export async function requireTapshiriqPerm(perm: string): Promise<{ ok: true } | { ok: false; error: string }> {
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

/** Cari userın task üzərində mutation hüququ var? — mesul/yaradan/icrachi/admin. */
async function assertTaskAccess(taskId: string): Promise<
  | { ok: true; task: { id: string; yaradan_id: string | null; mesul_id: string | null; basliq: string } }
  | { ok: false; error: string }
> {
  const { sahibkarId, istifadeciId } = requireTenant();
  const session = await auth();
  const rolAd = (session?.user?.rol_ad ?? "").toLowerCase();
  const privileged =
    rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin");

  const task = await prisma.tapshiriqlar.findFirst({
    where: { id: taskId, sahibkar_id: sahibkarId },
    select: {
      id: true,
      yaradan_id: true,
      mesul_id: true,
      basliq: true,
      tapshiriq_iscilier: { select: { istifadeci_id: true } },
    },
  });
  if (!task) return { ok: false, error: "Tapşırıq tapılmadı" };
  if (privileged) {
    return { ok: true, task: { id: task.id, yaradan_id: task.yaradan_id, mesul_id: task.mesul_id, basliq: task.basliq } };
  }
  const isOwner = task.yaradan_id === istifadeciId;
  const isMesul = task.mesul_id === istifadeciId;
  const isIcrachi = task.tapshiriq_iscilier.some((x) => x.istifadeci_id === istifadeciId);
  if (!isOwner && !isMesul && !isIcrachi) {
    return { ok: false, error: "Bu tapşırığa müdaxilə icazəniz yoxdur" };
  }
  return { ok: true, task: { id: task.id, yaradan_id: task.yaradan_id, mesul_id: task.mesul_id, basliq: task.basliq } };
}

/** Tapshiriq cache-i təzələ — sidebar/dashboard/nezaret badge-ləri. */
function bustTaskCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`mywork:${sahibkarId}`, "max");
    revalidateTag(`dashboard:${sahibkarId}`, "max");
    revalidateTag(`nezaret:${sahibkarId}`, "max");
  } catch {
    // tenant context yox — TTL onsuz da tutacaq
  }
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
  // QA-orta: eskalasiya hədəfi — əvvəl heç bir forma/action bu sahəni yazmırdı,
  // escalation_to həmişə NULL qalırdı və rəhbərə bildiriş getmirdi
  escalation_to: z.string().uuid().optional().or(z.literal("")),
  /** Hamı aktiv işçiyə paylaş — icracilar avtomatik dolur */
  broadcast_all: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
  /** Telegram bildirişi göndər (sahibkar konfiqurasiyası varsa) */
  send_telegram: z.union([z.literal("1"), z.literal("on"), z.literal("")]).optional(),
});

type ActionResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      error: string;
      blockers?: import("@/lib/blockers/types").Blocker[];
      hint?: string;
    };

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

      // 🔒 Cross-tenant qoruması — mesul_id / icracilar / escalation_to cari
      // sahibkar-a aid AKTİV istifadəçi olmalıdır. Server action birbaşa
      // çağırıla bildiyi üçün UI tenant-scope-una etibar etmirik.
      const candidateUserIds = new Set<string>();
      if (d.mesul_id) candidateUserIds.add(d.mesul_id);
      for (const u of d.icracilar ?? []) if (u) candidateUserIds.add(u);
      const escalationTarget = escalationEnabled && d.escalation_to ? d.escalation_to : null;
      if (escalationTarget) candidateUserIds.add(escalationTarget);
      if (candidateUserIds.size > 0) {
        const validUsers = await prisma.istifadeciler.findMany({
          where: { id: { in: Array.from(candidateUserIds) }, aktiv: true, sahibkar_id: sahibkarId },
          select: { id: true },
        });
        const validSet = new Set(validUsers.map((u) => u.id));
        const invalid = Array.from(candidateUserIds).filter((id) => !validSet.has(id));
        if (invalid.length > 0) {
          return { ok: false, error: "Seçilmiş istifadəçi(lər) bu hesaba aid deyil və ya aktiv deyil" };
        }
      }

      // 🔁 Idempotensiya (qısa pəncərə) — double-submit / double-click eyni
      // tapşırığı təkrar yaratmasın. client_op_id sütunu olmadığı üçün son
      // 10 saniyədə eyni (yaradan + başlıq + status='yeni') qeyd varsa onu qaytarırıq.
      const dupWindow = new Date(Date.now() - 10_000);
      const dup = await prisma.tapshiriqlar.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          basliq: d.basliq,
          status: "yeni",
          yaradildi: { gte: dupWindow },
        },
        select: { id: true },
        orderBy: { yaradildi: "desc" },
      });
      if (dup) {
        return { ok: true, id: dup.id };
      }

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
        let reminderNotifiedUid: string | null = null;
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
            // QA-orta: eskalasiya hədəfini yaz — əvvəl heç vaxt set olunmurdu,
            // overdue check-də t.escalation_to həmişə NULL idi (rəhbər bildirişi ölü kod)
            escalation_to: escalationEnabled && d.escalation_to ? d.escalation_to : null,
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
          const reminderDate = new Date(d.xatirlatma);
          const reminderUid = d.mesul_id || istifadeciId;
          await tx.tapshiriq_xatirlatmalar.create({
            data: {
              tapshiriq_id: t.id,
              sahibkar_id: sahibkarId,
              istifadeci_id: reminderUid,
              xatirlatma_de: reminderDate,
              kanal: "erp",
            },
          });

          // QA: xatırlatma "indi" və ya keçmişdədirsə — dərhal bildiriş göndər
          // (setTaskReminder-dəki isNow məntiqi ilə simmetrik). Əks halda keçmiş
          // tarixli xatırlatma heç vaxt göndərilmir — onu yaradan üçün bildiriş yaranmırdı.
          const isNow = !Number.isNaN(reminderDate.getTime()) && reminderDate.getTime() <= Date.now() + 60 * 1000;
          if (isNow) {
            await tx.bildirisler.create({
              data: {
                istifadeci_id: reminderUid,
                sahibkar_id: sahibkarId,
                basliq: `Xatırlatma: ${d.basliq}`,
                metn: d.tesvir ?? null,
                nov: "tapshiriq_xatirlatma",
                link: `/tapshiriqlar/${t.id}`,
                resurs_nov: "tapshiriq",
                resurs_id: t.id,
              },
            });
            await tx.tapshiriq_xatirlatmalar.updateMany({
              where: { tapshiriq_id: t.id, istifadeci_id: reminderUid, xatirlatma_de: reminderDate },
              data: { gonderildi: true, gonderildi_de: new Date() },
            });
            await tx.tapshiriqlar.update({
              where: { id: t.id },
              data: { xatirlatma_gonderildi: true },
            });
            reminderNotifiedUid = reminderUid;
          }
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

        return { t, notifiedIds, reminderNotifiedUid };
      });

      // Hər bildiriş alanın bell-i dərhal yenilənsin
      for (const uid of task.notifiedIds) {
        revalidateTag(`bildirisler:${sahibkarId}:${uid}`, "max");
      }
      // Dərhal göndərilən xatırlatmanın alanı (yaradanın özü ola bilər) də yenilənsin
      if (task.reminderNotifiedUid && !task.notifiedIds.includes(task.reminderNotifiedUid)) {
        revalidateTag(`bildirisler:${sahibkarId}:${task.reminderNotifiedUid}`, "max");
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
      bustTaskCache();
      await audit("yarat", "tapshiriq", task.t.id, {
        yeni_data: {
          basliq: d.basliq,
          mesul_id: d.mesul_id || null,
          prioritet: d.prioritet,
          deadline: d.deadline ?? null,
          icrachi_sayi: task.notifiedIds.length,
        },
      });
      return { ok: true, id: task.t.id };
    } catch (e) {
      console.error("[createTask]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tapşırıq yaradılmadı: ${msg}` };
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
    ? `\n🕒 <b>Son tarix:</b> ${formatDate(task.deadline, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
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

export async function changeTaskStatus(
  taskId: string,
  status: "yeni" | "icrada" | "gozlemede" | "tamamlandi" | "legv",
  force?: boolean,
): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const access = await assertTaskAccess(taskId);
      if (!access.ok) return access;
      const existing = await prisma.tapshiriqlar.findFirst({
        where: { id: taskId, sahibkar_id: sahibkarId },
        select: { status: true, yaradan_id: true, basliq: true, mesul_id: true, requires_approval: true, approved_by: true },
      });
      if (!existing) return { ok: false, error: "Tapşırıq tapılmadı" };
      // Ləğv edilmiş (legv) tapşırıq terminal-dır — statusu dəyişdirilə bilməz
      // (sərbəst geri-açılışın qarşısını alır).
      if (existing.status === "legv" && status !== "legv") {
        return { ok: false, error: "Ləğv edilmiş tapşırığın statusu dəyişdirilə bilməz" };
      }

      // 🔒 requires_approval gate — rəhbər təsdiqi tələb edən tapşırıq icraçı
      // tərəfindən birbaşa "tamamlandi"-yə keçirilə bilməz. Yalnız yaradan və ya
      // imtiyazlı rol (sahibkar/owner/admin) tamamlaya bilər və eyni anda təsdiqi möhürləyir.
      let approvalStamp: { approved_by: string; approved_at: Date } | null = null;
      if (status === "tamamlandi" && existing.requires_approval && !existing.approved_by) {
        const sess = await auth();
        const rolAd = (sess?.user?.rol_ad ?? "").toLowerCase();
        const canApprove =
          rolAd.includes("sahibkar") || rolAd.includes("owner") || rolAd.includes("admin") ||
          existing.yaradan_id === istifadeciId;
        if (!canApprove) {
          return {
            ok: false,
            error: "Bu tapşırıq rəhbər təsdiqi tələb edir — birbaşa tamamlana bilməz. Status «Yoxlanılır»a keçirilməlidir.",
          };
        }
        approvalStamp = { approved_by: istifadeciId, approved_at: new Date() };
      }

      // 🛑 Ləğv/tamamlandı statusuna keçəndə açıq checklist varsa — blocker
      if ((status === "legv" || status === "tamamlandi") && !force) {
        const { findTaskBlockers } = await import("@/lib/blockers/find-task-blockers");
        const blockers = await findTaskBlockers(taskId, sahibkarId);
        const openChecklist = blockers.filter((b) => b.badge === "açıq punkt");
        if (openChecklist.length > 0) {
          return {
            ok: false,
            error: `${openChecklist.length} açıq punkt var — status dəyişdirilə bilməz.`,
            blockers,
            hint: "Aşağıdakı punktları işarələyin və ya silin, sonra yenidən cəhd edin.",
          };
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: any = { status, yenilendi: new Date() };
      if (status === "tamamlandi") {
        patch.tamamlandi_de = new Date();
        if (approvalStamp) {
          patch.approved_by = approvalStamp.approved_by;
          patch.approved_at = approvalStamp.approved_at;
        }
      } else {
        // Terminal statusdan (tamamlandi/legv) geri açılışda tamamlandi_de sıfırlanır —
        // əks halda hesabat/KPI köhnə tamamlanma vaxtını qalıq saxlayır.
        patch.tamamlandi_de = null;
        // requires_approval tapşırıq yenidən açılırsa təsdiq də sıfırlanır ki,
        // növbəti tamamlanmada gate yenidən işləsin.
        if (existing.requires_approval) {
          patch.approved_by = null;
          patch.approved_at = null;
        }
      }
      if (status === "icrada") patch.baslandi_de = new Date();

      await prisma.tapshiriqlar.update({ where: { id: taskId }, data: patch });

      // QA-orta: tapşırıq bağlananda açıq overdue alert avtomatik həll olunur
      // (stok auto-clear pattern-i ilə simmetrik — features/anbar/alert-helpers.ts)
      if (status === "tamamlandi" || status === "legv") {
        const cleared = await prisma.alerts.updateMany({
          where: {
            sahibkar_id: sahibkarId,
            tapshiriq_id: taskId,
            rule_kod: "task_overdue_auto",
            status: { in: ["yeni", "baxilir", "snoozed"] },
          },
          data: { status: "hell_olundu", resolved_at: new Date(), resolution_note: "Tapşırıq bağlandı" },
        });
        if (cleared.count > 0) revalidateTag(`alerts:${sahibkarId}`, "max");
      }

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
      revalidatePath(`/tapshiriqlar/${taskId}`);
      bustTaskCache();
      await audit("status_deyisdi", "tapshiriq", taskId, {
        evvelki_data: { status: existing.status },
        yeni_data: { status, basliq: existing.basliq },
      });
      return { ok: true };
    } catch (e) {
      console.error("[changeTaskStatus]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Status dəyişdirilmədi: ${msg}` };
    }
  });
}

export async function addComment(taskId: string, metn: string): Promise<ActionResult> {
  const text = metn.trim();
  if (!text) return { ok: false, error: "Boş şərh ola bilməz" };
  if (text.length > 5000) return { ok: false, error: "Şərh 5000 simvoldan uzun ola bilməz" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const access = await assertTaskAccess(taskId);
      if (!access.ok) return access;
      const row = await prisma.tapshiriq_kommentleri.create({
        data: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: taskId,
          istifadeci_id: istifadeciId,
          metn: text,
        },
        select: { id: true },
      });
      revalidatePath("/tapshiriqlar");
      revalidatePath(`/tapshiriqlar/${taskId}`);
      bustTaskCache();
      await audit("yarat", "tapshiriq_kommenti", String(row.id), {
        yeni_data: { tapshiriq_id: taskId, basliq: access.task.basliq, uzunluq: text.length },
      });
      return { ok: true };
    } catch (e) {
      console.error("[addComment]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Şərh əlavə edilmədi: ${msg}` };
    }
  });
}

export async function toggleChecklist(itemId: string, done: boolean): Promise<ActionResult> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 1) Bigint parse — bad input erkən səhv kimi qaytar
      let bid: bigint;
      try { bid = BigInt(itemId); } catch { return { ok: false, error: "Yanlış checklist ID" }; }
      // 2) Parent tapşırığı tapıb access yoxla
      const item = await prisma.tapshiriq_checklist.findFirst({
        where: { id: bid, sahibkar_id: sahibkarId },
        select: { id: true, metn: true, tapshiriq_id: true, tamamlandi: true },
      });
      if (!item) return { ok: false, error: "Checklist tapılmadı" };
      const access = await assertTaskAccess(item.tapshiriq_id);
      if (!access.ok) return access;
      // 3) Update
      await prisma.tapshiriq_checklist.update({
        where: { id: bid },
        data: {
          tamamlandi: done,
          tamamlandi_de: done ? new Date() : null,
          tamamlanan_id: done ? istifadeciId : null,
        },
      });
      revalidatePath("/tapshiriqlar");
      revalidatePath(`/tapshiriqlar/${item.tapshiriq_id}`);
      bustTaskCache();
      await audit("yenile", "tapshiriq_checklist", String(bid), {
        evvelki_data: { tamamlandi: item.tamamlandi },
        yeni_data: { tamamlandi: done, metn: item.metn, tapshiriq_id: item.tapshiriq_id },
      });
      return { ok: true };
    } catch (e) {
      console.error("[toggleChecklist]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yeniləmə alınmadı: ${msg}` };
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
      const access = await assertTaskAccess(taskId);
      if (!access.ok) return access;
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
      bustTaskCache();
      revalidatePath(`/tapshiriqlar/${taskId}`);
      await audit("yenile", "tapshiriq", taskId, {
        yeni_data: { reng: cleanReng || null, basliq: access.task.basliq },
      });
      return { ok: true, id: taskId };
    } catch (e) {
      console.error("[setTaskColor]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Rəng qoyulmadı: ${msg}` };
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
      const access = await assertTaskAccess(taskId);
      if (!access.ok) return access;
      const reminderDate = new Date(datetime);
      if (Number.isNaN(reminderDate.getTime())) {
        return { ok: false, error: "Tarix-vaxt yanlışdır" };
      }

      // Effektiv hədəf — kime_id verilibsə həmin istifadəçi, əks halda mesul/yaradan
      const targetUserId = kime_id || null;

      // 🔒 Cross-tenant qoruması — kime_id verilibsə cari sahibkar-a aid aktiv
      // istifadəçi olmalıdır (action birbaşa çağırıla bilər).
      if (targetUserId) {
        const validTarget = await prisma.istifadeciler.findFirst({
          where: { id: targetUserId, aktiv: true, sahibkar_id: sahibkarId },
          select: { id: true },
        });
        if (!validTarget) {
          return { ok: false, error: "Xatırlatma hədəfi bu hesaba aid deyil və ya aktiv deyil" };
        }
      }

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
      bustTaskCache();
      revalidatePath(`/tapshiriqlar/${taskId}`);
      await audit("xatirlatma_qoy", "tapshiriq", taskId, {
        yeni_data: {
          xatirlatma_de: new Date(datetime).toISOString(),
          repeat: repeat ?? "yox",
          kime_id: kime_id || null,
          gizlilik,
        },
      });
      return { ok: true, id: taskId };
    } catch (e) {
      console.error("[setTaskReminder]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Xatırlatma qoyulmadı: ${msg}` };
    }
  });
}

// ============================================================
// Overdue check — admin-only cron entrypoint
// ============================================================

/**
 * Cari tenant üçün gecikən tapşırıqları aşkar edib alert/bildiriş yaradır.
 * Tenant context daxilində işləyir — auth yoxlamır (kim çağırdığı çağıranın
 * öhdəliyidir). Manual `runOverdueCheck` üçün role check edir, cron isə
 * birbaşa bu helper-i çağırır.
 */
export async function _executeOverdueCheckForTenant(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const { sahibkarId } = requireTenant();
  try {
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
      const existing = await prisma.alerts.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          tapshiriq_id: t.id,
          kateqoriya_kod: "tapshiriq",
          rule_kod: "task_overdue_auto",
          // QA-audit: kanonik alert statusları (yeni|baxilir|snoozed|hell_olundu|legv).
          // "resolved"/"dismissed" bu kod bazasında yoxdur → həqiqi həll/legv alertlər dedup-a
          // düşmür, hər icrada dublikat overdue-alert yaranırdı.
          status: { notIn: ["hell_olundu", "legv"] },
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
          // QA-orta: "yuxsek" typo idi — alert severity kanonik "yuksek"dir
          // (SEVERITY_RANK / severity-badge / qrup kritik sayğacı bu açarı tanıyır)
          seviyye: "yuksek",
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
        try {
          revalidateTag(`bildirisler:${sahibkarId}:${t.escalation_to}`, "max");
        } catch { /* non-fatal */ }
      }
      created += 1;
    }

    if (created > 0) {
      try {
        revalidatePath("/tapshiriqlar");
        revalidatePath("/xeberdarliqlar");
        bustTaskCache();
        revalidateTag(`alerts:${sahibkarId}`, "max");
      } catch { /* non-fatal */ }
    }
    return { ok: true, created };
  } catch (e) {
    console.error("[_executeOverdueCheckForTenant]", e);
    const msg = e instanceof Error ? e.message : "naməlum səhv";
    return { ok: false, error: `Yoxlama uğursuz oldu: ${msg}` };
  }
}

export async function runOverdueCheck(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  return withTenant(async () => {
    const { rolAd } = requireTenant();
    if (rolAd !== "admin" && rolAd !== "sahibkar") {
      return { ok: false, error: "İcazə yoxdur — yalnız admin/sahibkar yoxlama işə sala bilər" };
    }
    const result = await _executeOverdueCheckForTenant();
    if (result.ok && result.created > 0) {
      try {
        await audit("overdue_yoxla", "tapshiriq", null, {
          yeni_data: { yaradilan_alert: result.created, mode: "manual" },
        });
      } catch { /* non-fatal */ }
    }
    return result;
  });
}

