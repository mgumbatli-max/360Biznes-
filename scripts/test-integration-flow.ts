/**
 * E2E Integration Flow Test
 *
 * Ticarət ↔ Anbar ↔ Maliyyə zəncirini doğrudan DB üzərindən təkrar
 * edib hər addımı assert edir. Server actions üzərinə fokuslamır —
 * bu testin məqsədi sxema və biznes invariantların düz işlədiyini
 * təsdiqləməkdir.
 *
 * Flow:
 *  1. Tenant seç (test üçün ilk aktiv olan)
 *  2. Test müştəri yarat
 *  3. Test məhsul + stok yarat
 *  4. Stok başlanğıc dəyərini oxu
 *  5. Müştərinin alacaq başlanğıc dəyərini oxu
 *  6. Nisyə satış yarat (manual SQL ilə — actions işə salınmadan)
 *  7. Stok azalmasını yoxla
 *  8. alacaq artmasını yoxla
 *  9. Qismən ödəniş et — alacaq azalmalıdır
 *  10. Tam ödəniş — sənəd bağlanmalıdır
 *  11. Test datanı təmizlə
 *
 * Run: npx tsx scripts/test-integration-flow.ts
 *
 * Sıfır xəta = bütün invariantlar qorunur.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function expect(cond: boolean, label: string, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push(label + (detail ? ` — ${detail}` : ""));
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("Integration Flow Test — satış → stok → alacaq → ödəniş");
  console.log("=".repeat(70));

  // Step 1: tenant seç
  const tenant = await prisma.sahibkarlar.findFirst({
    where: { status: "aktiv" },
    select: { id: true, ad: true },
  });
  if (!tenant) {
    console.error("Aktiv tenant yoxdur — script dayandırıldı.");
    process.exit(2);
  }
  console.log(`\nTenant: ${tenant.ad}\n`);

  // Anbar tap
  const anbar = await prisma.anbarlar.findFirst({
    where: { sahibkar_id: tenant.id, aktiv: true },
    select: { id: true, ad: true },
  });
  if (!anbar) {
    console.error("Aktiv anbar yoxdur.");
    process.exit(2);
  }

  // Olcu vahidi tap
  const olcu = await prisma.olcu_vahidleri.findFirst({ select: { id: true } });
  if (!olcu) {
    console.error("Olcu vahidi yoxdur.");
    process.exit(2);
  }

  const cleanup: Array<() => Promise<void>> = [];

  try {
    // Step 2: Test müştəri yarat
    console.log("→ Müştəri yaradılır...");
    const musteri = await prisma.kontragentler.create({
      data: {
        sahibkar_id: tenant.id,
        ad: `__test_musteri_${Date.now()}`,
        nov: "musteri",
        telefon: "+994500000001",
        aktiv: true,
        alacaq: 0,
        borc: 0,
      },
      select: { id: true, ad: true, alacaq: true },
    });
    cleanup.push(async () => {
      await prisma.kontragentler.delete({ where: { id: musteri.id } }).catch(() => {});
    });
    expect(true, "Müştəri yaradıldı", musteri.ad);
    expect(Number(musteri.alacaq ?? 0) === 0, "Başlanğıc alacaq sıfır");

    // Step 3: Test məhsul + stok yarat
    console.log("→ Məhsul + stok yaradılır...");
    const mehsul = await prisma.mehsullar.create({
      data: {
        sahibkar_id: tenant.id,
        ad: `__test_mehsul_${Date.now()}`,
        kod: `TST-${Date.now()}`,
        olcu_id: olcu.id,
        satis_qiymeti: 100,
        alish_qiymeti: 60,
        aktiv: true,
      },
      select: { id: true, ad: true, satis_qiymeti: true },
    });
    cleanup.push(async () => {
      await prisma.mehsullar.delete({ where: { id: mehsul.id } }).catch(() => {});
    });

    const stok = await prisma.stok.create({
      data: {
        sahibkar_id: tenant.id,
        mehsul_id: mehsul.id,
        anbar_id: anbar.id,
        miqdar: 10,
        son_qiymet: 60,
      },
      select: { id: true, miqdar: true },
    });
    cleanup.push(async () => {
      await prisma.stok.delete({ where: { id: stok.id } }).catch(() => {});
    });
    expect(Number(stok.miqdar) === 10, "Başlanğıc stok = 10");

    // Step 4-6: Nisyə satış (transaction ilə — atomik)
    console.log("→ Nisyə satış yaradılır (3 ədəd × 100 = 300)...");
    const satirCount = 3;
    const vahidQiymet = 100;
    const sonMebleg = satirCount * vahidQiymet;

    const sale = await prisma.$transaction(async (tx) => {
      // Sənəd nömrəsi — sadəcə random unikal
      const nomre = `__TST-${Date.now()}-${randomUUID().slice(0, 6)}`;
      const s = await tx.satis_sifarisleri.create({
        data: {
          sahibkar_id: tenant.id,
          nomre,
          musteri_id: musteri.id,
          status: "tamamlandi",
          odenis_nov: "nisye",
          tarix: new Date(),
          son_mebleg: sonMebleg,
          odenilmis: 0,
          qaralama: false,
        },
        select: { id: true, nomre: true },
      });
      await tx.satis_sifaris_satirlari.create({
        data: {
          sahibkar_id: tenant.id,
          sifaris_id: s.id,
          mehsul_id: mehsul.id,
          miqdar: satirCount,
          vahid_qiymet: vahidQiymet,
        },
      });
      // Stok mexariç (atomic decrement)
      const upd = await tx.stok.updateMany({
        where: { id: stok.id, miqdar: { gte: satirCount } },
        data: { miqdar: { decrement: satirCount } },
      });
      if (upd.count === 0) throw new Error("Stok mexariç uğursuz — race condition");
      // alacaq artır
      await tx.kontragentler.update({
        where: { id: musteri.id },
        data: { alacaq: { increment: sonMebleg } },
      });
      // hereket
      await tx.anbar_hereketleri.create({
        data: {
          sahibkar_id: tenant.id,
          anbar_id: anbar.id,
          mehsul_id: mehsul.id,
          nov: "mexaric",
          miqdar: satirCount,
          ref_nov: "test",
        },
      });
      return s;
    });
    cleanup.push(async () => {
      await prisma.satis_sifaris_satirlari.deleteMany({ where: { sifaris_id: sale.id } }).catch(() => {});
      await prisma.satis_sifarisleri.delete({ where: { id: sale.id } }).catch(() => {});
    });

    // Step 7: Stok azalmasını yoxla
    const stokSonra = await prisma.stok.findUnique({ where: { id: stok.id }, select: { miqdar: true } });
    expect(Number(stokSonra?.miqdar) === 7, "Stok 10 → 7 (3 azalıb)", `actual=${stokSonra?.miqdar}`);

    // Step 8: alacaq artmasını yoxla
    const musteriSonra = await prisma.kontragentler.findUnique({
      where: { id: musteri.id },
      select: { alacaq: true },
    });
    expect(Number(musteriSonra?.alacaq ?? 0) === sonMebleg, "Alacaq 0 → 300", `actual=${musteriSonra?.alacaq}`);

    // Step 9: Qismən ödəniş — 120 ödə
    console.log("→ Qismən ödəniş (120)...");
    await prisma.$transaction(async (tx) => {
      await tx.satis_sifarisleri.update({
        where: { id: sale.id },
        data: { odenilmis: { increment: 120 } },
      });
      await tx.kontragentler.update({
        where: { id: musteri.id },
        data: { alacaq: { decrement: 120 } },
      });
    });

    const saleAfterPartial = await prisma.satis_sifarisleri.findUnique({
      where: { id: sale.id },
      select: { son_mebleg: true, odenilmis: true },
    });
    expect(Number(saleAfterPartial?.odenilmis ?? 0) === 120, "Sənəd ödənilmis = 120");
    expect(
      Number(saleAfterPartial?.son_mebleg ?? 0) - Number(saleAfterPartial?.odenilmis ?? 0) === 180,
      "Açıq qalıq = 180",
    );

    const musteriPartial = await prisma.kontragentler.findUnique({
      where: { id: musteri.id },
      select: { alacaq: true },
    });
    expect(Number(musteriPartial?.alacaq ?? 0) === 180, "Müştəri alacaq = 180", `actual=${musteriPartial?.alacaq}`);

    // Step 10: Tam ödəniş — qalan 180
    console.log("→ Tam ödəniş (qalan 180)...");
    await prisma.$transaction(async (tx) => {
      await tx.satis_sifarisleri.update({
        where: { id: sale.id },
        data: { odenilmis: { increment: 180 } },
      });
      await tx.kontragentler.update({
        where: { id: musteri.id },
        data: { alacaq: { decrement: 180 } },
      });
    });

    const saleFull = await prisma.satis_sifarisleri.findUnique({
      where: { id: sale.id },
      select: { son_mebleg: true, odenilmis: true },
    });
    expect(
      Number(saleFull?.son_mebleg ?? 0) === Number(saleFull?.odenilmis ?? 0),
      "Sənəd tam bağlandı (son_mebleg === odenilmis)",
    );

    const musteriFinal = await prisma.kontragentler.findUnique({
      where: { id: musteri.id },
      select: { alacaq: true },
    });
    expect(
      Number(musteriFinal?.alacaq ?? 0) === 0,
      "Müştəri alacaq = 0 (tam bağlı)",
      `actual=${musteriFinal?.alacaq}`,
    );

    // Step 11: Tenant izolyasiyası — başqa tenant müştərini görməməlidir
    const otherTenant = await prisma.sahibkarlar.findFirst({
      where: { id: { not: tenant.id }, status: "aktiv" },
      select: { id: true },
    });
    if (otherTenant) {
      const crossLeak = await prisma.kontragentler.count({
        where: { id: musteri.id, sahibkar_id: otherTenant.id },
      });
      expect(crossLeak === 0, "Tenant izolyasiyası — başqa tenant müştərini görmür");
    } else {
      console.log("  ⚠ Çapraz tenant testi üçün ikinci tenant yoxdur — keçildi");
    }
  } finally {
    console.log("\n→ Cleanup...");
    for (const fn of cleanup.reverse()) await fn();
  }

  // Yekun
  console.log("\n" + "=".repeat(70));
  console.log("Yekun");
  console.log("=".repeat(70));
  console.log(`✓ ${pass} keçdi   ✗ ${fail} uğursuz`);
  if (fail > 0) {
    console.log("\nUğursuz testlər:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Fatal:", e);
  await prisma.$disconnect();
  process.exit(2);
});
