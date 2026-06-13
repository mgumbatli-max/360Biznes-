"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { requireElaqeActionPerm } from "./access-guard";

type Result = { ok: true; data?: { id: string } } | { ok: false; error: string };

/**
 * Borc xatırlatma üçün universal tapşırıq yaradır.
 *
 * İki rejim:
 *  - **Birdəfəlik**: növbəti həftədə həmin gün/saat üçün tək tapşırıq
 *  - **Həftəlik təkrar**: `tapshiriq_tekrar` qaydası — sistem həftəlik yeni
 *    tapşırıq doğurur, son ödəniş edilənə qədər
 *
 * Tapşırıq `tapshiriq_obyektleri` ilə müştəriyə (kontragentlər) bağlanır,
 * beləliklə müştəri kartında və borc siyahısında görünür.
 */
export async function createDebtReminderTask(input: {
  kontragentId: string;
  kontragentAd: string;
  borc: number;
  recurrent: boolean;
  weekday: number; // 0=Bazar, 1=B.E ... 6=Şənbə
  hour: string; // "HH:MM"
  mesulId: string | null;
  mesajMetn: string;
}): Promise<Result> {
  const permCheck = await requireElaqeActionPerm("elaqe.borc");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!/^\d{1,2}:\d{2}$/.test(input.hour)) {
    return { ok: false, error: "Saat formatı yanlışdır (HH:MM)" };
  }
  if (input.weekday < 0 || input.weekday > 6) {
    return { ok: false, error: "Həftə günü 0-6 aralığında olmalıdır" };
  }
  if (!input.mesajMetn?.trim() || input.mesajMetn.length > 2000) {
    return { ok: false, error: "Mesaj boş və ya 2000 simvoldan uzun ola bilməz" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const basliq = `🔔 Borc xatırlatması: ${input.kontragentAd}`;
      const tesvir =
        `Cari borc: ${input.borc.toFixed(2)} ₼\n\n` +
        `Müştəriyə xatırlatma mesajı:\n${input.mesajMetn}\n\n` +
        `Müştəri ID: ${input.kontragentId}`;

      // Növbəti gün/saatın absolut tarixini hesabla
      const next = nextWeekdayDate(input.weekday, input.hour);
      const mesul = input.mesulId ?? istifadeciId;

      if (input.recurrent) {
        // Recurring rule yarat
        const tekrar = await prisma.tapshiriq_tekrar.create({
          data: {
            sahibkar_id: sahibkarId,
            basliq,
            tesvir,
            prioritet: "yuksek",
            mesul_id: mesul,
            tekrar_nov: "herhefte",
            hefte_gunu: input.weekday,
            saat: input.hour,
            baslangic: new Date(),
            aktiv: true,
            yaradan_id: istifadeciId,
            novbeti_isleme: next,
          },
        });
        // İlk instansiyanı dərhal yarat
        const tapshiriq = await prisma.tapshiriqlar.create({
          data: {
            sahibkar_id: sahibkarId,
            basliq,
            tesvir,
            prioritet: "yuksek",
            mesul_id: mesul,
            yaradan_id: istifadeciId,
            deadline: next,
            xatirlatma: next,
            tekrar_id: tekrar.id,
            tip: "borc_xatirlatma",
            kpi_enabled: true,
          },
        });
        // Müştəriyə bağla
        await prisma.tapshiriq_obyektleri.create({
          data: {
            sahibkar_id: sahibkarId,
            tapshiriq_id: tapshiriq.id,
            obyekt_nov: "kontragent",
            obyekt_id: input.kontragentId,
          },
        });
        revalidatePath("/tapshiriqlar");
        revalidatePath("/elaqe/borclar");
        try {
          revalidateTag(`dashboard:${sahibkarId}`, "max");
          revalidateTag(`nezaret:${sahibkarId}`, "max");
          revalidateTag(`elaqe:${sahibkarId}`, "max");
        } catch { /* non-fatal */ }
        await audit("yarat", "borc_xatirlatma", tapshiriq.id, {
          yeni_data: {
            kontragent_id: input.kontragentId,
            borc: input.borc,
            tekrar: true,
            weekday: input.weekday,
            hour: input.hour,
          },
        });
        return { ok: true, data: { id: tapshiriq.id } };
      } else {
        // Birdəfəlik
        const tapshiriq = await prisma.tapshiriqlar.create({
          data: {
            sahibkar_id: sahibkarId,
            basliq,
            tesvir,
            prioritet: "yuksek",
            mesul_id: mesul,
            yaradan_id: istifadeciId,
            deadline: next,
            xatirlatma: next,
            tip: "borc_xatirlatma",
            kpi_enabled: true,
          },
        });
        await prisma.tapshiriq_obyektleri.create({
          data: {
            sahibkar_id: sahibkarId,
            tapshiriq_id: tapshiriq.id,
            obyekt_nov: "kontragent",
            obyekt_id: input.kontragentId,
          },
        });
        revalidatePath("/tapshiriqlar");
        revalidatePath("/elaqe/borclar");
        try {
          revalidateTag(`dashboard:${sahibkarId}`, "max");
          revalidateTag(`nezaret:${sahibkarId}`, "max");
          revalidateTag(`elaqe:${sahibkarId}`, "max");
        } catch { /* non-fatal */ }
        await audit("yarat", "borc_xatirlatma", tapshiriq.id, {
          yeni_data: {
            kontragent_id: input.kontragentId,
            borc: input.borc,
            tekrar: false,
            deadline: next.toISOString(),
          },
        });
        return { ok: true, data: { id: tapshiriq.id } };
      }
    } catch (e) {
      console.error("[createDebtReminderTask]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tapşırıq yaradıla bilmədi: ${msg}` };
    }
  });
}

/** Növbəti həftəlik weekday tarixini hesabla (UTC-da deyil, local). */
function nextWeekdayDate(weekday: number, hourStr: string): Date {
  const [h, m] = hourStr.split(":").map(Number);
  const now = new Date();
  const cur = now.getDay();
  let diff = (weekday - cur + 7) % 7;
  if (diff === 0) {
    // Bu gündürsə və saat keçibsə → növbəti həftə
    const candidate = new Date(now);
    candidate.setHours(h, m, 0, 0);
    if (candidate <= now) diff = 7;
  }
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  next.setHours(h, m, 0, 0);
  return next;
}
