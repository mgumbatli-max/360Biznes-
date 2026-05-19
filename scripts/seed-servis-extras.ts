/**
 * Seed default defekt kategoriyaları and a default akt sablon for every active sahibkar.
 * Idempotent — uses upsert and existence checks.
 * Run: npx tsx scripts/seed-servis-extras.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFEKT_KATEQ_DEFAULTS = [
  { kod: "ekran", ad: "Ekran (LCD/Touch)", qrup: "Telefon", zemanete_dushur: true },
  { kod: "batareya", ad: "Batareya", qrup: "Telefon", zemanete_dushur: true },
  { kod: "motherboard", ad: "Motherboard", qrup: "Telefon", zemanete_dushur: true },
  { kod: "korpus", ad: "Korpus / Çərçivə", qrup: "Telefon", zemanete_dushur: false },
  { kod: "su_zedesi", ad: "Su zədəsi", qrup: "Telefon", zemanete_dushur: false },
  { kod: "kamera", ad: "Kamera", qrup: "Telefon", zemanete_dushur: true },
  { kod: "sokuldu", ad: "Söküldü / qızdı", qrup: "Notbuk", zemanete_dushur: false },
  { kod: "klaviatura", ad: "Klaviatura", qrup: "Notbuk", zemanete_dushur: true },
  { kod: "ssd_hdd", ad: "SSD / HDD", qrup: "Notbuk", zemanete_dushur: true },
  { kod: "yumshaq_xeta", ad: "Proqram xətası", qrup: "Digər", zemanete_dushur: false },
];

const AKT_SABLON_DEFAULT = {
  ad: "Standart servis aktı",
  nov: "qebul",
  format: "a4",
  html: "<h1>Servis qəbul aktı</h1><p>Bu standart şablondur.</p>",
  default_sablon: true,
};

async function main() {
  const sahibkarlar = await prisma.sahibkarlar.findMany({
    where: { status: "aktiv" },
    select: { id: true, ad: true },
  });

  for (const s of sahibkarlar) {
    let inserted = 0;
    for (const k of DEFEKT_KATEQ_DEFAULTS) {
      const exists = await prisma.servis_defekt_kateq.findFirst({
        where: { sahibkar_id: s.id, kod: k.kod },
        select: { id: true },
      });
      if (!exists) {
        await prisma.servis_defekt_kateq.create({
          data: { sahibkar_id: s.id, ...k, aktiv: true },
        });
        inserted++;
      }
    }

    const aktExists = await prisma.servis_akt_sablonlari.findFirst({
      where: { sahibkar_id: s.id, default_sablon: true },
      select: { id: true },
    });
    let aktInserted = 0;
    if (!aktExists) {
      await prisma.servis_akt_sablonlari.create({
        data: { sahibkar_id: s.id, ...AKT_SABLON_DEFAULT, aktiv: true },
      });
      aktInserted = 1;
    }

    console.log(`[${s.ad}] defekt+${inserted}, akt+${aktInserted}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
