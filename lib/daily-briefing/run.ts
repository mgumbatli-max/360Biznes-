import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { getUpcomingBirthdays } from "@/features/elaqe/birthday-queries";
import { getInaktivMusteriler } from "@/features/elaqe/inaktiv-queries";
import { generateBorcTasks } from "./borc-tasks";

/**
 * Səhər brifinq — gündə bir dəfə tetiklenen avto-bildiriş generatoru.
 *
 * Necə işləyir:
 *  - Hər dəfə dashboard və ya sahibkar səhifəsi açılanda çağırılır
 *  - `ayarlar` cədvəlində `son_briefing_tarix` açarı yoxlanır
 *  - Bu gün artıq edilibsə, no-op
 *  - Edilməyibsə: sahibkar (rol_id=9) üçün bildirişlər yaradılır + tarix yazılır
 *
 * Bildiriş növləri:
 *  - 🎂 Bu gün doğum günü olanlar
 *  - ⚠ VIP itirilməkdə olan müştərilər
 *  - 💸 1000+ ₼ borcu olan müştəri sayı
 *  - 📦 Kritik stok altında məhsul sayı
 *  - 🛡 Gözləyən təsdiq sayı
 *
 * Cron əvəzedicisi — xarici scheduler tələb etmir, istifadəçi açanda işləyir.
 */
export async function runDailyBriefing(): Promise<void> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      // Bu gün artıq icra olunubmu?
      const flag = await prisma.ayarlar.findFirst({
        where: { sahibkar_id: sahibkarId, qrup: "daily_briefing", acar: "son_tarix" },
        select: { deyer: true },
      });
      if (flag?.deyer === todayStr) return; // artıq edilib

      // Sahibkar və adminləri tap
      const recipients = await prisma.istifadeciler.findMany({
        where: {
          sahibkar_id: sahibkarId,
          aktiv: true,
          rol_id: { in: [1, 9] },
        },
        select: { id: true },
        take: 5,
      });
      if (recipients.length === 0) return;

      // Məlumatları topla
      const [bdays, inaktiv, highDebt, lowStock, pendingTesdiq] = await Promise.all([
        getUpcomingBirthdays(0).catch(() => []),
        getInaktivMusteriler(60).catch(() => []),
        prisma.kontragentler.count({
          where: { sahibkar_id: sahibkarId, aktiv: true, borc: { gte: 1000 } },
        }).catch(() => 0),
        prisma.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*)::bigint AS c
            FROM stok s
            JOIN mehsullar m ON m.id = s.mehsul_id
           WHERE s.sahibkar_id = ${sahibkarId}::uuid
             AND m.kritik_stok IS NOT NULL AND m.kritik_stok > 0
             AND COALESCE(s.miqdar, 0) <= m.kritik_stok
        `.catch(() => [{ c: BigInt(0) }]),
        prisma.tesdiq_telep.count({ where: { sahibkar_id: sahibkarId, status: "gozleyir" } }).catch(() => 0),
      ]);

      const vipItirilen = inaktiv.filter((r) => r.rfm_seviyye === "vip").length;
      const lowStockCount = Number(lowStock[0]?.c ?? 0);

      const messages: Array<{ basliq: string; metn: string; link: string; nov: string }> = [];

      if (bdays.length > 0) {
        messages.push({
          basliq: `🎂 Bu gün ${bdays.length} doğum günü`,
          metn: bdays.map((b) => b.ad).slice(0, 3).join(", "),
          link: "/elaqe/dogum-gunu",
          nov: "info",
        });
      }
      if (vipItirilen > 0) {
        messages.push({
          basliq: `⚠ ${vipItirilen} VIP müştəri itirilməkdə`,
          metn: "60 günə qədər almayıb — təcili qaytar mesajı göndər",
          link: "/elaqe/inaktiv?min=60",
          nov: "warning",
        });
      }
      if (highDebt > 0) {
        messages.push({
          basliq: `💸 ${highDebt} müştəridə yüksək borc`,
          metn: "1000+ ₼ borc — xatırlatma göndər",
          link: "/elaqe/borclar",
          nov: "warning",
        });
      }
      if (lowStockCount > 0) {
        messages.push({
          basliq: `📦 ${lowStockCount} məhsul kritik stokda`,
          metn: "Sifariş ver ki anbar boşalmasın",
          link: "/anbar/mehsullar?stock=low",
          nov: lowStockCount > 10 ? "warning" : "info",
        });
      }
      if (pendingTesdiq > 0) {
        messages.push({
          basliq: `🛡 ${pendingTesdiq} təsdiq gözləyir`,
          metn: "Sənin baxışını gözləyən sorğular",
          link: "/tesdiq",
          nov: "info",
        });
      }

      // Heç bir mesaj yoxdursa yalnız tarix qeyd et
      if (messages.length === 0) {
        await markDone(sahibkarId, todayStr);
        return;
      }

      // Bildirişləri yarat — hər recipient üçün hər mesaj
      const rows: {
        sahibkar_id: string;
        istifadeci_id: string;
        basliq: string;
        metn: string;
        nov: string;
        link: string;
        oxundu: boolean;
      }[] = [];
      for (const r of recipients) {
        for (const m of messages) {
          rows.push({
            sahibkar_id: sahibkarId,
            istifadeci_id: r.id,
            basliq: m.basliq,
            metn: m.metn,
            nov: m.nov,
            link: m.link,
            oxundu: false,
          });
        }
      }

      if (rows.length > 0) {
        await prisma.bildirisler.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }

      // Borc avto-tapşırıq generator — eyni gündəlik proses daxilində
      const borcResult = await generateBorcTasks().catch(() => ({ yaradilan: 0, atlanılan: 0 }));
      if (borcResult.yaradilan > 0) {
        const followups: typeof rows = recipients.map((r) => ({
          sahibkar_id: sahibkarId,
          istifadeci_id: r.id,
          basliq: `🔔 ${borcResult.yaradilan} borc tapşırığı yaradıldı`,
          metn: "Borc 30+ gün olan müştərilərə avtomatik xatırlatma tapşırıqları əməkdaşlara göndərildi",
          nov: "info",
          link: "/tapshiriqlar?tip=borc_xatirlatma",
          oxundu: false,
        }));
        await prisma.bildirisler.createMany({ data: followups, skipDuplicates: true });
      }

      await markDone(sahibkarId, todayStr);
    } catch (e) {
      console.warn("[runDailyBriefing] skipped:", e);
    }
  });
}

async function markDone(sahibkarId: string, todayStr: string): Promise<void> {
  await prisma.ayarlar.upsert({
    where: {
      sahibkar_id_qrup_acar: {
        sahibkar_id: sahibkarId,
        qrup: "daily_briefing",
        acar: "son_tarix",
      },
    },
    create: {
      sahibkar_id: sahibkarId,
      qrup: "daily_briefing",
      acar: "son_tarix",
      deyer: todayStr,
      nov: "string",
    },
    update: { deyer: todayStr, yenilendi: new Date() },
  });
}
