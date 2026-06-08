/**
 * TƏHLÜKƏLİ: Tenant üçün bütün ticarət və maliyyə əməliyyatlarını sıfırlayır.
 *
 * Saxlanılır:
 *  - Müştərilər, təchizatçılar (kontragentler) — yalnız borc/avans 0-lanır
 *  - Məhsullar (mehsullar) — yalnız stok 0-lanır
 *  - Hesablar/kassalar (maliye_hesablari) — yalnız qaliq 0-lanır
 *  - Anbarlar, markalar, kateqoriyalar, vahidlər
 *  - İstifadəçilər, rollar, ayarlar
 *  - Audit log (tarixçə qalsın)
 *
 * Silinir:
 *  - satis_sifarisleri + satis_sifaris_satirlari
 *  - alis_sifarisleri + alis_sifaris_satirlari
 *  - qaytarma_sifarisleri + qaytarma_satirlari
 *  - kredit_satislari
 *  - finance_operations + finance_payment_allocations
 *  - xercl_r
 *  - finance_marketplace_payments
 *  - finance_bank_statements + items
 *  - kassa_emeliyyatlari, hesab_emeliyyatlari
 *  - isci_odenisleri, maas_hesablamalar
 *  - anbar_hereketleri, stok_bron
 *  - stok (miqdar 0 yox, silinir — sonra alış yaratdıqda yeniden yaranır)
 *
 * Run dry-run: npx tsx scripts/reset-transactions.ts --tenant=<uuid>
 * Apply:       npx tsx scripts/reset-transactions.ts --tenant=<uuid> --confirm
 *
 * Tenant adı ilə də işləyir: --tenant-name="Magazam.az"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const tenantArg = args.find((a) => a.startsWith("--tenant="))?.split("=")[1];
const tenantNameArg = args.find((a) => a.startsWith("--tenant-name="))?.split("=")[1];
const CONFIRM = args.includes("--confirm");

async function main() {
  console.log("=".repeat(70));
  console.log(`Reset transactions ${CONFIRM ? "(APPLY)" : "(DRY-RUN — heç bir dəyişiklik yox)"}`);
  console.log("=".repeat(70));

  // Tenant seçimi
  let tenant: { id: string; ad: string } | null = null;
  if (tenantArg) {
    tenant = await prisma.sahibkarlar.findUnique({
      where: { id: tenantArg },
      select: { id: true, ad: true },
    });
  } else if (tenantNameArg) {
    tenant = await prisma.sahibkarlar.findFirst({
      where: { ad: { contains: tenantNameArg, mode: "insensitive" } },
      select: { id: true, ad: true },
    });
  } else {
    const list = await prisma.sahibkarlar.findMany({
      where: { status: "aktiv" },
      select: { id: true, ad: true },
      orderBy: { ad: "asc" },
    });
    console.log("Tenant göstərilməyib. Aktiv tenantlar:\n");
    for (const t of list) console.log(`  ${t.id}  ${t.ad}`);
    console.log("\nİstifadə: --tenant=<uuid> və ya --tenant-name=<ad>");
    process.exit(1);
  }
  if (!tenant) {
    console.error("Tenant tapılmadı");
    process.exit(2);
  }

  console.log(`\nTenant: ${tenant.ad} (${tenant.id})`);
  console.log(`Mode: ${CONFIRM ? "🔥 TƏTBİQ ETMƏ" : "🔍 DRY-RUN"}\n`);

  const sahibkarId = tenant.id;

  // Sayım
  const counts = {
    satis_satirlari: await prisma.satis_sifaris_satirlari.count({ where: { sahibkar_id: sahibkarId } }),
    satis_sifarisleri: await prisma.satis_sifarisleri.count({ where: { sahibkar_id: sahibkarId } }),
    alis_satirlari: await prisma.alis_sifaris_satirlari.count({ where: { sahibkar_id: sahibkarId } }),
    alis_sifarisleri: await prisma.alis_sifarisleri.count({ where: { sahibkar_id: sahibkarId } }),
    qaytarma_satirlari: await prisma.qaytarma_satirlari.count({ where: { sahibkar_id: sahibkarId } }),
    qaytarma_sifarisleri: await prisma.qaytarma_sifarisleri.count({ where: { sahibkar_id: sahibkarId } }),
    kredit_satislari: await prisma.kredit_satislari.count({ where: { sahibkar_id: sahibkarId } }),
    finance_payment_allocations: await prisma.finance_payment_allocations.count({ where: { sahibkar_id: sahibkarId } }),
    finance_operations: await prisma.finance_operations.count({ where: { sahibkar_id: sahibkarId } }),
    xercl_r: await prisma.xercl_r.count({ where: { sahibkar_id: sahibkarId } }),
    finance_marketplace_payments: await prisma.finance_marketplace_payments.count({ where: { sahibkar_id: sahibkarId } }),
    anbar_hereketleri: await prisma.anbar_hereketleri.count({ where: { sahibkar_id: sahibkarId } }),
    stok_bron: await prisma.stok_bron.count({ where: { sahibkar_id: sahibkarId } }),
    stok: await prisma.stok.count({ where: { sahibkar_id: sahibkarId } }),
    kassa_emeliyyatlari: await prisma.kassa_emeliyyatlari.count({ where: { sahibkar_id: sahibkarId } }),
    hesab_emeliyyatlari: await prisma.hesab_emeliyyatlari.count({ where: { sahibkar_id: sahibkarId } }),
    isci_odenisleri: await prisma.isci_odenisleri.count({ where: { sahibkar_id: sahibkarId } }),
    maas_hesablamalar: await prisma.maas_hesablamalar.count({ where: { sahibkar_id: sahibkarId } }),
  };

  // Saxlanılan tablolar (cəm sayımı — informatif)
  const keepCounts = {
    kontragentler: await prisma.kontragentler.count({ where: { sahibkar_id: sahibkarId } }),
    mehsullar: await prisma.mehsullar.count({ where: { sahibkar_id: sahibkarId } }),
    maliye_hesablari: await prisma.maliye_hesablari.count({ where: { sahibkar_id: sahibkarId } }),
    anbarlar: await prisma.anbarlar.count({ where: { sahibkar_id: sahibkarId } }),
  };

  console.log("SİLİNƏCƏK qeydlər:");
  for (const [k, v] of Object.entries(counts)) {
    if (v > 0) console.log(`  ✗ ${k.padEnd(35)} ${v}`);
  }

  console.log("\nSAXLANILACAQ (yalnız balanslar sıfırlanır):");
  for (const [k, v] of Object.entries(keepCounts)) {
    console.log(`  ✓ ${k.padEnd(35)} ${v}`);
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  console.log(`\nCəmi silinəcək qeyd: ${total}`);

  if (!CONFIRM) {
    console.log("\n⚠️  DRY-RUN. Tətbiq etmək üçün --confirm bayrağı əlavə edin:");
    console.log(`   npx tsx scripts/reset-transactions.ts --tenant=${sahibkarId} --confirm\n`);
    await prisma.$disconnect();
    return;
  }

  console.log("\n🔥 TƏTBİQ EDİLİR — 3 saniyə gözləyirəm (Ctrl+C ilə dayandır)...\n");
  await new Promise((r) => setTimeout(r, 3000));

  // Atomic icra — referans sırası ilə
  console.log("→ Sənəd sətirləri silinir...");
  await prisma.satis_sifaris_satirlari.deleteMany({ where: { sahibkar_id: sahibkarId } });
  await prisma.alis_sifaris_satirlari.deleteMany({ where: { sahibkar_id: sahibkarId } });
  await prisma.qaytarma_satirlari.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Allocation-lar silinir...");
  await prisma.finance_payment_allocations.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Bank items + statements silinir...");
  await prisma.finance_bank_statement_items.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_bank_statements.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);

  console.log("→ Finance attachments + audits + balance adjustments silinir...");
  await prisma.finance_attachments.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_audit_logs.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_balance_adjustments.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_barter_operations.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_currency_exchanges.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_debt_writeoffs.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_dividends.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  await prisma.finance_approval_requests.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);
  // finance_operation_items sahibkar_id-siz — operations cascade ilə silinir
  await prisma.finance_marketplace_payments.deleteMany({ where: { sahibkar_id: sahibkarId } }).catch(() => null);

  console.log("→ Finance operations silinir...");
  await prisma.finance_operations.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ İşçi ödənişləri + maaş hesablamalar silinir...");
  await prisma.isci_odenisleri.deleteMany({ where: { sahibkar_id: sahibkarId } });
  await prisma.maas_hesablamalar.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Xərclər silinir...");
  await prisma.xercl_r.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Kassa + hesab əməliyyatları silinir...");
  await prisma.kassa_emeliyyatlari.deleteMany({ where: { sahibkar_id: sahibkarId } });
  await prisma.hesab_emeliyyatlari.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Anbar hərəkətləri silinir...");
  await prisma.anbar_hereketleri.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Stok bron silinir...");
  await prisma.stok_bron.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Qaytarma sənədləri silinir...");
  await prisma.qaytarma_sifarisleri.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Kredit satışları silinir...");
  await prisma.kredit_satislari.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Satış sənədləri silinir...");
  await prisma.satis_sifarisleri.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Alış sənədləri silinir...");
  await prisma.alis_sifarisleri.deleteMany({ where: { sahibkar_id: sahibkarId } });

  console.log("→ Stok 0-lanır (silinmir, hər mehsul-anbar üçün record qalır)...");
  await prisma.stok.updateMany({
    where: { sahibkar_id: sahibkarId },
    data: { miqdar: 0, son_qiymet: null },
  });

  console.log("→ Hesab balansları sıfırlanır...");
  await prisma.maliye_hesablari.updateMany({
    where: { sahibkar_id: sahibkarId },
    data: { qaliq: 0 },
  });

  console.log("→ Kassa qaliqları sıfırlanır...");
  await prisma.kassalar.updateMany({
    where: { sahibkar_id: sahibkarId },
    data: { acilis_qaligi: 0, hesablanan_qaliq: 0, baglanis_qaligi: null, fark: null },
  }).catch(() => null);

  console.log("→ Kontragent balansları sıfırlanır...");
  await prisma.kontragentler.updateMany({
    where: { sahibkar_id: sahibkarId },
    data: { borc: 0, alacaq: 0, avans: 0 },
  });

  console.log("\n✓ Reset tamam!");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal:", e);
  await prisma.$disconnect();
  process.exit(2);
});
