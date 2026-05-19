/**
 * Seed demo data for the admin@360biznes.az test tenant:
 *  - 1 brand + 1 category + 1 unit
 *  - 10 products with stock + barcodes
 *  - 5 customers
 * Run: npx tsx scripts/seed-demo-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS = [
  { ad: "iPhone 15 Pro 256GB Titanium", kod: "IP15P-256-TIT", barkod: "1947123456001", qiymet: 2890, maya: 2350, stok: 8 },
  { ad: "iPhone 15 128GB Black", kod: "IP15-128-BLK", barkod: "1947123456002", qiymet: 2100, maya: 1750, stok: 15 },
  { ad: "Samsung Galaxy S24 Ultra 512GB", kod: "SGS24U-512", barkod: "8806094000123", qiymet: 2650, maya: 2100, stok: 4 },
  { ad: "Samsung Galaxy A55 5G 256GB", kod: "SGA55-256", barkod: "8806094000124", qiymet: 750, maya: 590, stok: 22 },
  { ad: "AirPods Pro 2 (USB-C)", kod: "APP2-USBC", barkod: "1947123456003", qiymet: 480, maya: 380, stok: 18 },
  { ad: "MacBook Air M3 13\" 256GB", kod: "MBA-M3-256", barkod: "1947123456004", qiymet: 2350, maya: 1980, stok: 5 },
  { ad: "iPad Pro 11\" M4 256GB", kod: "IPP-M4-256", barkod: "1947123456005", qiymet: 2100, maya: 1750, stok: 7 },
  { ad: "Apple Watch Series 10 GPS 45mm", kod: "AW10-GPS-45", barkod: "1947123456006", qiymet: 750, maya: 590, stok: 12 },
  { ad: "Sony WH-1000XM5 Headphones", kod: "WH1000XM5", barkod: "4905524000001", qiymet: 620, maya: 480, stok: 6 },
  { ad: "Anker PowerCore 20000mAh", kod: "ANK-PB-20K", barkod: "0194644000123", qiymet: 95, maya: 60, stok: 30 },
];

const CUSTOMERS = [
  { ad: "Əliyev MMC", telefon: "+994501234567", email: "info@aliyev.az", borc: 1250 },
  { ad: "Hüseynov Rəşad", telefon: "+994702345678", email: "rashad@gmail.com", borc: 0 },
  { ad: "Premier Electronics", telefon: "+994552345678", email: "sales@premier.az", borc: 4850 },
  { ad: "Quliyev Ərəstun", telefon: "+994703456789", email: null, borc: 0 },
  { ad: "Tech Plaza", telefon: "+994122223344", email: "info@techplaza.az", borc: 2100 },
];

async function main() {
  const sahibkar = await prisma.sahibkarlar.findUnique({ where: { email: "admin@360biznes.az" } });
  if (!sahibkar) {
    console.error("Demo tenant tapılmadı. Əvvəlcə qeydiyyatdan keçin.");
    process.exit(1);
  }

  const anbar = await prisma.anbarlar.findFirst({
    where: { sahibkar_id: sahibkar.id, aktiv: true },
    orderBy: { id: "asc" },
  });
  if (!anbar) {
    console.error("Aktiv anbar tapılmadı.");
    process.exit(1);
  }

  // Unit (per-tenant scoped)
  let vahid = await prisma.olcu_vahidleri.findFirst({ where: { sahibkar_id: sahibkar.id, ad: "ədəd" } });
  if (!vahid) {
    vahid = await prisma.olcu_vahidleri.create({
      data: { sahibkar_id: sahibkar.id, ad: "ədəd", qisa: "ed", qisa_ad: "ed", asas: true },
    });
  }

  // Category
  let kateqoriya = await prisma.kateqoriyalar.findFirst({
    where: { sahibkar_id: sahibkar.id, ad: "Elektronika" },
  });
  if (!kateqoriya) {
    kateqoriya = await prisma.kateqoriyalar.create({
      data: { sahibkar_id: sahibkar.id, ad: "Elektronika" },
    });
  }

  // Products
  console.log("Məhsullar yaradılır...");
  // Wipe existing demo products to keep idempotent runs clean
  await prisma.mehsullar.deleteMany({ where: { sahibkar_id: sahibkar.id, kod: { in: PRODUCTS.map((p) => p.kod) } } });

  for (const p of PRODUCTS) {
    const mehsul = await prisma.mehsullar.create({
      data: {
        sahibkar_id: sahibkar.id,
        kateqoriya_id: kateqoriya.id,
        olcu_id: vahid.id,
        ad: p.ad,
        kod: p.kod,
        barkod: p.barkod,
        satis_qiymeti: p.qiymet,
        alish_qiymeti: p.maya,
        min_satis_qiymeti: Math.round(p.maya * 1.05 * 100) / 100,
        topdan_qiymeti: Math.round(p.qiymet * 0.9 * 100) / 100,
        partnyor_qiymeti: Math.round(p.qiymet * 0.85 * 100) / 100,
        vip_qiymeti: Math.round(p.qiymet * 0.92 * 100) / 100,
        kritik_stok: 3,
        aktiv: true,
      },
    });
    await prisma.stok.create({
      data: {
        sahibkar_id: sahibkar.id,
        mehsul_id: mehsul.id,
        anbar_id: anbar.id,
        miqdar: p.stok,
        son_qiymet: p.maya,
      },
    });
  }
  console.log(`  ${PRODUCTS.length} məhsul + stok yaradıldı`);

  // Customers
  console.log("Müştərilər yaradılır...");
  await prisma.kontragentler.deleteMany({
    where: { sahibkar_id: sahibkar.id, nov: "musteri", ad: { in: CUSTOMERS.map((c) => c.ad) } },
  });
  for (const c of CUSTOMERS) {
    await prisma.kontragentler.create({
      data: {
        sahibkar_id: sahibkar.id,
        nov: "musteri",
        ad: c.ad,
        telefon: c.telefon,
        email: c.email,
        borc: c.borc,
        aktiv: true,
      },
    });
  }
  console.log(`  ${CUSTOMERS.length} müştəri yaradıldı`);

  console.log("\n✓ Demo data hazırdır. Brauzerdə dashboard, anbar, POS səhifələrini test edə bilərsiniz.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
