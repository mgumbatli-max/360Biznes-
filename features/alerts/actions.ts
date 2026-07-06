"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { permGate } from "@/lib/auth/role-check";

function bustAlertCache() {
  try {
    const { sahibkarId } = requireTenant();
    revalidateTag(`nezaret:${sahibkarId}`, "max");
    revalidateTag(`alerts:${sahibkarId}`, "max");
  } catch {
    // tenant yox — sessizcə keç
  }
}

export async function acknowledgeAlert(alertId: string) {
  return withTenant(async () => {
    { const _pg = permGate("nezaret.ayarlar", "nezaret.dashboard", "nezaret.oxu", "nezaret.loglar"); if (!_pg.ok) return _pg; }
    await prisma.alerts.update({
      where: { id: alertId },
      data: { status: "baxilir", yenilendi: new Date() },
    });
    revalidatePath("/xeberdarliqlar");
    bustAlertCache();
    return { ok: true };
  });
}

export async function resolveAlert(alertId: string, note?: string) {
  return withTenant(async () => {
    { const _pg = permGate("nezaret.ayarlar", "nezaret.dashboard", "nezaret.oxu", "nezaret.loglar"); if (!_pg.ok) return _pg; }
    const { istifadeciId } = requireTenant();
    await prisma.alerts.update({
      where: { id: alertId },
      data: {
        status: "hell_olundu",
        resolved_at: new Date(),
        resolved_by: istifadeciId,
        resolution_note: note ?? null,
        yenilendi: new Date(),
      },
    });
    revalidatePath("/xeberdarliqlar");
    bustAlertCache();
    return { ok: true };
  });
}

export async function snoozeAlert(alertId: string, untilISO: string) {
  return withTenant(async () => {
    { const _pg = permGate("nezaret.ayarlar", "nezaret.dashboard", "nezaret.oxu", "nezaret.loglar"); if (!_pg.ok) return _pg; }
    await prisma.alerts.update({
      where: { id: alertId },
      data: {
        status: "snoozed",
        snoozed_until: new Date(untilISO),
        yenilendi: new Date(),
      },
    });
    revalidatePath("/xeberdarliqlar");
    bustAlertCache();
    return { ok: true };
  });
}

export async function assignAlert(alertId: string, istifadeciId: string | null) {
  return withTenant(async () => {
    { const _pg = permGate("nezaret.ayarlar", "nezaret.dashboard", "nezaret.oxu", "nezaret.loglar"); if (!_pg.ok) return _pg; }
    await prisma.alerts.update({
      where: { id: alertId },
      data: {
        assigned_to: istifadeciId,
        assigned_at: istifadeciId ? new Date() : null,
        yenilendi: new Date(),
      },
    });
    revalidatePath("/xeberdarliqlar");
    bustAlertCache();
    return { ok: true };
  });
}

/** Assign alert to the current user. */
export async function assignAlertToMe(alertId: string) {
  return withTenant(async () => {
    { const _pg = permGate("nezaret.ayarlar", "nezaret.dashboard", "nezaret.oxu", "nezaret.loglar"); if (!_pg.ok) return _pg; }
    const { istifadeciId } = requireTenant();
    await prisma.alerts.update({
      where: { id: alertId },
      data: { assigned_to: istifadeciId, assigned_at: new Date(), yenilendi: new Date() },
    });
    revalidatePath("/xeberdarliqlar");
    bustAlertCache();
    return { ok: true };
  });
}

/** Escalate alert — bump severity and log escalation row. */
export async function escalateAlert(alertId: string, sebeb?: string) {
  return withTenant(async () => {
    { const _pg = permGate("nezaret.ayarlar", "nezaret.dashboard", "nezaret.oxu", "nezaret.loglar"); if (!_pg.ok) return _pg; }
    const { istifadeciId } = requireTenant();
    const a = await prisma.alerts.findUnique({ where: { id: alertId }, select: { seviyye: true, assigned_to: true } });
    if (!a) return { ok: false as const, error: "Tapılmadı" };
    const SEV_NEXT: Record<string, string> = { info: "risk", risk: "yuksek", yuksek: "kritik", kritik: "kritik" };
    const next = SEV_NEXT[a.seviyye] ?? "yuksek";
    await prisma.$transaction([
      prisma.alerts.update({
        where: { id: alertId },
        data: { seviyye: next, yenilendi: new Date() },
      }),
      prisma.alert_escalations.create({
        data: {
          alert_id: alertId,
          escalated_by: istifadeciId,
          escalated_to: a.assigned_to,
          sebeb: sebeb ?? `Səviyyə ${a.seviyye} → ${next}`,
        },
      }),
    ]);
    revalidatePath("/xeberdarliqlar");
    bustAlertCache();
    return { ok: true as const, severity: next };
  });
}

/**
 * Add a free-form comment to an alert (stored in alert_comments).
 */
export async function addAlertComment(alertId: string, metn: string) {
  if (!metn.trim()) return { ok: false as const, error: "Qeyd boş ola bilməz" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    await prisma.alert_comments.create({
      data: { alert_id: alertId, istifadeci_id: istifadeciId, metn: metn.trim() },
    });
    revalidatePath("/xeberdarliqlar");
    revalidatePath(`/xeberdarliqlar/${alertId}`);
    bustAlertCache();
    return { ok: true as const };
  });
}

/**
 * Convert an alert into a task. Creates a tapshiriqlar row referencing the alert
 * and adds a comment back on the alert with the new task id.
 */
export async function createTaskFromAlert(alertId: string, mesul_id?: string) {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const a = await prisma.alerts.findUnique({
      where: { id: alertId },
      select: { basliq: true, tesvir: true, seviyye: true, obyekt_basliq: true, obyekt_nov: true, kateqoriya_kod: true },
    });
    if (!a) return { ok: false as const, error: "Xəbərdarlıq tapılmadı" };

    const prioritet = a.seviyye === "kritik" ? "kritik" : a.seviyye === "yuksek" ? "yuksek" : "orta";
    const desc = [
      a.tesvir,
      a.obyekt_basliq ? `Obyekt: ${a.obyekt_basliq}` : null,
      `Mənbə: Xəbərdarlıq ${alertId.slice(0, 8)}`,
    ].filter(Boolean).join("\n");

    try {
      const task = await prisma.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          mesul_id: mesul_id ?? istifadeciId,
          basliq: a.basliq,
          tesvir: desc,
          prioritet,
          status: "yeni",
        },
        select: { id: true },
      });
      // Echo back as comment on the alert
      await prisma.alert_comments.create({
        data: {
          alert_id: alertId,
          istifadeci_id: istifadeciId,
          metn: `📋 Tapşırığa çevrildi → ${task.id}`,
        },
      });
      revalidatePath("/xeberdarliqlar");
      revalidatePath(`/xeberdarliqlar/${alertId}`);
      bustAlertCache();
      return { ok: true as const, task_id: task.id };
    } catch (e) {
      console.error("[createTaskFromAlert]", e);
      return { ok: false as const, error: "Tapşırıq yaradılmadı" };
    }
  });
}

/**
 * Forward an alert to the Approval Center. Creates a tesdiq_telep entry.
 */
export async function sendAlertToApproval(alertId: string) {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const a = await prisma.alerts.findUnique({
      where: { id: alertId },
      select: { basliq: true, tesvir: true, seviyye: true, obyekt_nov: true, obyekt_id: true },
    });
    if (!a) return { ok: false as const, error: "Xəbərdarlıq tapılmadı" };

    const prioritet = a.seviyye === "kritik" ? "kritik" : a.seviyye === "yuksek" ? "yuxsek" : "orta";
    try {
      const t = await prisma.tesdiq_telep.create({
        data: {
          sahibkar_id: sahibkarId,
          yaradan_id: istifadeciId,
          emeliyyat_nov: "diger",
          resurs_nov: a.obyekt_nov ?? "xeberdarliq",
          resurs_id: a.obyekt_id ?? alertId,
          basliq: a.basliq,
          risk_sebeb: a.tesvir ?? "Xəbərdarlıqdan yönləndirildi",
          prioritet,
          status: "gozleyir",
          detay_json: { mənbə: "xeberdarliq", alert_id: alertId } as object,
        },
        select: { id: true },
      });
      await prisma.alert_comments.create({
        data: {
          alert_id: alertId,
          istifadeci_id: istifadeciId,
          metn: `🛡 Təsdiq Mərkəzinə göndərildi → #${t.id}`,
        },
      });
      revalidatePath("/xeberdarliqlar");
      revalidatePath(`/xeberdarliqlar/${alertId}`);
      revalidatePath("/tesdiq");
      bustAlertCache();
      return { ok: true as const, telep_id: t.id };
    } catch (e) {
      console.error("[sendAlertToApproval]", e);
      return { ok: false as const, error: "Təsdiq mərkəzinə göndərilmədi" };
    }
  });
}

/**
 * Mark all open alerts as "baxilir" for the current tenant.
 * Mirrors the legacy "Hamısını oxunmuş işarələ" behavior of bildirişlər.
 */
export async function markAllRead() {
  return withTenant(async () => {
    { const _pg = permGate("nezaret.ayarlar", "nezaret.dashboard", "nezaret.oxu", "nezaret.loglar"); if (!_pg.ok) return _pg; }
    const r = await prisma.alerts.updateMany({
      where: { status: "yeni" },
      data: { status: "baxilir", yenilendi: new Date() },
    });
    revalidatePath("/xeberdarliqlar");
    bustAlertCache();
    return { ok: true, count: r.count };
  });
}
