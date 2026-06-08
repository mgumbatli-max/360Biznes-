/**
 * One-time fix: müştəri `alacaq` field-ini açıq satışların cəminə uyğunlaşdırır.
 *
 * Qaydalar (spec):
 *  1. alacaq = bütün açıq nisye satışların qaliq cəmi
 *  2. Negativ alacaq yoxdur — manual track-də artıq decrement edildiyi üçün
 *     yaranan müsbət fərq avans-a köçürülür
 *  3. Drift halları (alacaq != açıq cəm) düzəldilir
 *
 * Run: npx tsx scripts/fix-customer-balances.ts
 * Run with `--dry-run` to preview without applying changes.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type Fix = {
  tenant: string;
  musteri_id: string;
  ad: string;
  old_alacaq: number;
  old_avans: number;
  new_alacaq: number;
  new_avans: number;
  reason: string;
};

async function main() {
  console.log("=".repeat(70));
  console.log(`Customer balance fix ${DRY_RUN ? "(DRY-RUN — heç bir dəyişiklik tətbiq edilmir)" : "(APPLY)"}`);
  console.log("=".repeat(70));

  const tenants = await prisma.sahibkarlar.findMany({
    where: { status: "aktiv" },
    select: { id: true, ad: true },
  });

  const fixes: Fix[] = [];

  for (const t of tenants) {
    // Bütün müştərilər (alacaq > 0, alacaq < 0, ya da açıq sənədi olan)
    const customers = await prisma.kontragentler.findMany({
      where: {
        sahibkar_id: t.id,
        nov: { in: ["musteri", "her_ikisi"] },
      },
      select: { id: true, ad: true, alacaq: true, avans: true },
    });

    for (const c of customers) {
      // Bu müştərinin bütün açıq nisye satışları
      const openAgg = await prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: t.id,
          musteri_id: c.id,
          status: { not: "legv" },
          qaralama: { not: true },
          odenis_nov: { in: ["nisye", "borc"] },
        },
        _sum: { son_mebleg: true, odenilmis: true },
      });
      const openTotal = Math.max(
        0,
        +(Number(openAgg._sum.son_mebleg ?? 0) - Number(openAgg._sum.odenilmis ?? 0)).toFixed(2),
      );

      const oldAlacaq = Number(c.alacaq ?? 0);
      const oldAvans = Number(c.avans ?? 0);

      let newAlacaq = openTotal;
      let newAvans = oldAvans;
      let reason: string | null = null;

      // 1. Negativ alacaq — müştəri artıq daha çox ödəyib
      if (oldAlacaq < -0.01) {
        // |oldAlacaq| qədər avansa
        newAvans = +(oldAvans + Math.abs(oldAlacaq)).toFixed(2);
        reason = `negativ alacaq (${oldAlacaq.toFixed(2)}) avansa köçürüldü`;
      }

      // 2. Drift — açıq cəmlə uyğun deyil
      if (Math.abs(oldAlacaq - openTotal) > 0.01) {
        if (!reason) reason = `alacaq ${oldAlacaq.toFixed(2)} → ${openTotal.toFixed(2)} (açıq cəm)`;
      }

      if (reason) {
        fixes.push({
          tenant: t.ad,
          musteri_id: c.id,
          ad: c.ad,
          old_alacaq: oldAlacaq,
          old_avans: oldAvans,
          new_alacaq: newAlacaq,
          new_avans: newAvans,
          reason,
        });

        if (!DRY_RUN) {
          await prisma.kontragentler.update({
            where: { id: c.id },
            data: { alacaq: newAlacaq, avans: newAvans },
          });
        }
      }
    }
  }

  // Hesabat
  console.log(`\nYoxlanılan tenant sayı: ${tenants.length}`);
  console.log(`Düzəliş tələb edən müştəri sayı: ${fixes.length}\n`);

  if (fixes.length === 0) {
    console.log("✓ Bütün balanslar düzgündür");
  } else {
    for (const f of fixes) {
      console.log(`[${f.tenant}] ${f.ad}`);
      console.log(`  Alacaq: ${f.old_alacaq.toFixed(2)} → ${f.new_alacaq.toFixed(2)}`);
      if (f.new_avans !== f.old_avans) {
        console.log(`  Avans:  ${f.old_avans.toFixed(2)} → ${f.new_avans.toFixed(2)}`);
      }
      console.log(`  Səbəb: ${f.reason}`);
      console.log();
    }
    console.log(DRY_RUN
      ? "DRY-RUN — `npx tsx scripts/fix-customer-balances.ts` ilə tətbiq edin."
      : `✓ ${fixes.length} müştəri balansı yeniləndi.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal:", e);
  await prisma.$disconnect();
  process.exit(2);
});
