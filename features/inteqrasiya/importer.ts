import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { withTenant } from "@/lib/db/with-tenant";
import { ParsedRow } from "./excel-parser";
import { audit } from "@/lib/audit/log";
import { nextDocNumber } from "@/lib/db/sened-nomre";

/** Şablon `tip` sütunu (sahib/sirket/fiziki/huquqi/şirkət...) → DB huquqi_fiziki */
function mapHuquqiFiziki(tip: string | number | null | undefined): string | undefined {
  if (tip == null || tip === "") return undefined;
  const s = String(tip).toLowerCase();
  if (s.includes("sir") || s.includes("şir") || s.includes("huq") || s.includes("hüq") || s.includes("mmc") || s.includes("company")) return "huquqi";
  return "fiziki"; // sahib / fiziki / şəxs / fərd
}

export type ImportResult = {
  partiyaId: string;
  cemi: number;
  yarat: number;
  yenile: number;
  xeta: number;
  log: Array<{ sira: number; emeliyyat: "yarat" | "yenile" | "xeta"; mesaj: string }>;
};

type Importer = (rows: ParsedRow[]) => Promise<ImportResult>;

const importers: Record<string, Importer> = {
  mehsul: importMehsul,
  musteri: importMusteri,
  techizatci: importTechizatci,
  "kassa-baslangic": importHesab,
  emekdas: importEmekdas,
  crm: importCrm,
  stok: importStok,
};

export async function importByKey(key: string, rows: ParsedRow[], fileName: string | null): Promise<ImportResult> {
  const fn = importers[key];
  if (!fn) {
    throw new Error(`«${key}» şablonu üçün avtomatik idxal hələ aktiv deyil. Tezliklə əlavə olunacaq.`);
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const validRows = rows.filter((r) => r.errors.length === 0);

    // Create batch
    const partiya = await prisma.import_partiyalari.create({
      data: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId ?? undefined,
        sablon_nov: key,
        fayl_adi: fileName ?? undefined,
        cemi_satir: rows.length,
        xeta_satir: rows.length - validRows.length,
        status: "icra_edilir",
        baslandi_de: new Date(),
      },
    });

    try {
      const r = await fn(validRows);
      r.partiyaId = partiya.id;

      await prisma.import_partiyalari.update({
        where: { id: partiya.id },
        data: {
          status: r.xeta > 0 && r.yarat + r.yenile === 0 ? "ugursuz" : "tamamlandi",
          ugurlu_satir: r.yarat + r.yenile,
          yeni_satir: r.yarat,
          yenilenecek: r.yenile,
          xeta_satir: (partiya.xeta_satir ?? 0) + r.xeta,
          tamamlandi_de: new Date(),
          xeta_log: r.log.filter((l) => l.emeliyyat === "xeta") as never,
        },
      });

      await audit("import", `inteqrasiya:${key}`, partiya.id, {
        yeni_data: {
          fayl_adi: fileName,
          cemi: rows.length,
          yarat: r.yarat,
          yenile: r.yenile,
          xeta: r.xeta,
          status: r.xeta > 0 && r.yarat + r.yenile === 0 ? "ugursuz" : "tamamlandi",
        },
        sebeb: `Inteqrasiya idxalı: ${key}`,
        status: r.xeta > 0 && r.yarat + r.yenile === 0 ? "ugursuz" : (r.xeta > 0 ? "qismen" : "ugur"),
      });

      return r;
    } catch (err) {
      await prisma.import_partiyalari.update({
        where: { id: partiya.id },
        data: {
          status: "ugursuz",
          tamamlandi_de: new Date(),
          xeta_log: [{ sira: 0, emeliyyat: "xeta", mesaj: String(err) }] as never,
        },
      });
      await audit("import", `inteqrasiya:${key}`, partiya.id, {
        yeni_data: { fayl_adi: fileName, error: String(err) },
        sebeb: `Inteqrasiya idxalı uğursuz: ${key}`,
        status: "ugursuz",
      });
      throw err;
    }
  });
}

// === MEHSUL ===
async function importMehsul(rows: ParsedRow[]): Promise<ImportResult> {
  const { sahibkarId } = requireTenant();
  let yarat = 0,
    yenile = 0,
    xeta = 0;
  const log: ImportResult["log"] = [];

  // resolve default anbar
  const defaultAnbar = await prisma.anbarlar.findFirst({
    where: { sahibkar_id: sahibkarId, aktiv: true },
    orderBy: { id: "asc" },
  });

  // FK həlli (kateqoriya/marka adı → id). Əvvəl `kateqoriya`/`tesvir`/`vergi` kimi
  // mövcud OLMAYAN skaler sahələrə yazılırdı → hər sətir "Unknown argument" atırdı (0 məhsul).
  const [allCats, allBrands] = await Promise.all([
    prisma.kateqoriyalar.findMany({ where: { sahibkar_id: sahibkarId }, select: { id: true, ad: true } }),
    prisma.markalar.findMany({ where: { sahibkar_id: sahibkarId }, select: { id: true, ad: true } }),
  ]);
  const catMap = new Map<string, number>(allCats.map((c) => [c.ad.toLowerCase(), c.id]));
  const brandMap = new Map<string, number>(allBrands.map((b) => [b.ad.toLowerCase(), b.id]));
  async function resolveCategory(name: string | null): Promise<number | undefined> {
    if (!name) return undefined;
    const f = catMap.get(name.toLowerCase());
    if (f) return f;
    const created = await prisma.kateqoriyalar.create({ data: { sahibkar_id: sahibkarId, ad: name } });
    catMap.set(name.toLowerCase(), created.id);
    return created.id;
  }
  async function resolveBrand(name: string | null): Promise<number | undefined> {
    if (!name) return undefined;
    const f = brandMap.get(name.toLowerCase());
    if (f) return f;
    const created = await prisma.markalar.create({ data: { sahibkar_id: sahibkarId, ad: name, aktiv: true } });
    brandMap.set(name.toLowerCase(), created.id);
    return created.id;
  }

  for (const r of rows) {
    try {
      const ad = String(r.values.ad);
      const kod = r.values.kod ? String(r.values.kod) : null;
      const barkod = r.values.barkod ? String(r.values.barkod).split("|")[0].trim() : null;

      const existing = await prisma.mehsullar.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          OR: [kod ? { kod } : undefined, barkod ? { barkod } : undefined].filter(
            Boolean
          ) as never,
        },
      });

      const markaAd = r.values.marka ? String(r.values.marka) : null;
      const data = {
        ad,
        kod,
        barkod,
        marka: markaAd,
        marka_id: await resolveBrand(markaAd), // queries.ts marka adını markalar FK-dən oxuyur
        model: r.values.model ? String(r.values.model) : null,
        kateqoriya_id: await resolveCategory(r.values.kateqoriya ? String(r.values.kateqoriya) : null),
        aciqlamaq: r.values.tesvir ? String(r.values.tesvir) : undefined, // model sahəsi `tesvir` deyil `aciqlamaq`
        alish_qiymeti: (r.values.alish_qiymeti as number) ?? 0,
        satis_qiymeti: (r.values.satis_qiymeti as number) ?? 0,
        // topdan/partnyor/vip NOT-NULL @default(0) — `null` ötürmək xəta verir, undefined → default/keep
        topdan_qiymeti: (r.values.topdan_qiymeti as number) ?? undefined,
        partnyor_qiymeti: (r.values.partnyor_qiymeti as number) ?? undefined,
        vip_qiymeti: (r.values.vip_qiymeti as number) ?? undefined,
        kritik_stok: (r.values.kritik_stok as number) ?? undefined,
        aktiv: r.values.aktiv === 0 ? false : true,
      };

      let mehsulId: string;
      if (existing) {
        const upd = await prisma.mehsullar.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        mehsulId = upd.id;
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Mövcud məhsul yeniləndi: ${ad}` });
      } else {
        const cre = await prisma.mehsullar.create({
          data: { ...data, sahibkar_id: sahibkarId },
          select: { id: true },
        });
        mehsulId = cre.id;
        yarat++;
        log.push({ sira: r.sira, emeliyyat: "yarat", mesaj: `Yeni məhsul yaradıldı: ${ad}` });
      }

      // multiple barcodes
      const barcodeStr = r.values.barkod ? String(r.values.barkod) : "";
      const barcodes = barcodeStr.split("|").map((b) => b.trim()).filter(Boolean);
      if (barcodes.length > 1) {
        for (const bk of barcodes.slice(1)) {
          await prisma.mehsul_barkodlar
            .upsert({
              where: { sahibkar_id_barkod: { sahibkar_id: sahibkarId, barkod: bk } },
              create: { mehsul_id: mehsulId, barkod: bk, sahibkar_id: sahibkarId },
              update: {},
            })
            .catch(() => {});
        }
      }

      // initial stock
      const say = r.values.say as number;
      if (defaultAnbar && typeof say === "number" && say > 0) {
        const existingStok = await prisma.stok.findFirst({
          where: { mehsul_id: mehsulId, anbar_id: defaultAnbar.id },
        });
        if (existingStok) {
          await prisma.stok.update({
            where: { id: existingStok.id },
            data: { miqdar: say, son_qiymet: data.alish_qiymeti },
          });
        } else {
          await prisma.stok.create({
            data: {
              mehsul_id: mehsulId,
              anbar_id: defaultAnbar.id,
              sahibkar_id: sahibkarId,
              miqdar: say,
              son_qiymet: data.alish_qiymeti,
            },
          });
        }
      }
    } catch (e) {
      xeta++;
      log.push({ sira: r.sira, emeliyyat: "xeta", mesaj: String(e) });
    }
  }

  return { partiyaId: "", cemi: rows.length, yarat, yenile, xeta, log };
}

// === MUSTERI ===
async function importMusteri(rows: ParsedRow[]): Promise<ImportResult> {
  const { sahibkarId } = requireTenant();
  let yarat = 0,
    yenile = 0,
    xeta = 0;
  const log: ImportResult["log"] = [];

  for (const r of rows) {
    try {
      const ad = String(r.values.ad);
      const telefon = r.values.telefon ? String(r.values.telefon) : null;
      const voen = r.values.voen ? String(r.values.voen) : null;

      const existing = await prisma.kontragentler.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          nov: "musteri",
          OR: [
            telefon ? { telefon } : undefined,
            voen ? { voen } : undefined,
          ].filter(Boolean) as never,
        },
      });

      const data = {
        nov: "musteri",
        ad,
        voen,
        telefon,
        email: r.values.email ? String(r.values.email) : null,
        unvan: r.values.unvan ? String(r.values.unvan) : null,
        // QA: şablonda doldurulan, amma əvvəl DB-yə yazılmayan sahələr (gizli itirdi)
        sheher: r.values.seh_r ? String(r.values.seh_r) : undefined,
        borc_limiti: typeof r.values.borc_limit === "number" ? r.values.borc_limit : undefined,
        huquqi_fiziki: mapHuquqiFiziki(r.values.tip),
        qiymet_tipi: r.values.qiymet_tipi ? String(r.values.qiymet_tipi) : "adi",
        qeyd: r.values.qeyd ? String(r.values.qeyd) : null,
        aktiv: r.values.aktiv === 0 ? false : true,
      };

      if (existing) {
        await prisma.kontragentler.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Müştəri yeniləndi: ${ad}` });
      } else {
        const created = await prisma.kontragentler.create({ data: { ...data, sahibkar_id: sahibkarId } });
        // İlkin borc → açıq nisyə satışı (audit #18: əvvəl kontragentler.borc-a
        // yazılırdı, customer-balance bunu görmürdü). "Açıq qaimə" kimi görünür.
        const openingBorc = (r.values.borc as number) ?? 0;
        if (openingBorc > 0) {
          const nomre = await nextDocNumber(prisma, sahibkarId, "satis");
          await prisma.satis_sifarisleri.create({
            data: {
              nomre,
              sahibkar_id: sahibkarId,
              musteri_id: created.id,
              tarix: new Date(),
              umumi_mebleg: openingBorc,
              son_mebleg: openingBorc,
              odenilmis: 0,
              odenis_nov: "nisye",
              status: "tesdiq",
              qeyd: "İlkin borc (idxal açılış qalığı)",
            },
          });
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(created.id);
        }
        yarat++;
        log.push({ sira: r.sira, emeliyyat: "yarat", mesaj: `Yeni müştəri: ${ad}` });
      }
    } catch (e) {
      xeta++;
      log.push({ sira: r.sira, emeliyyat: "xeta", mesaj: String(e) });
    }
  }

  return { partiyaId: "", cemi: rows.length, yarat, yenile, xeta, log };
}

// === TECHIZATCI ===
async function importTechizatci(rows: ParsedRow[]): Promise<ImportResult> {
  const { sahibkarId } = requireTenant();
  let yarat = 0,
    yenile = 0,
    xeta = 0;
  const log: ImportResult["log"] = [];

  for (const r of rows) {
    try {
      const ad = String(r.values.ad);
      const voen = r.values.voen ? String(r.values.voen) : null;

      // VÖEN varsa onunla, yoxdursa ad ilə dedup et (əks halda hər təkrar yükləmədə dublikat yaranırdı)
      const existing = voen
        ? await prisma.kontragentler.findFirst({
            where: { sahibkar_id: sahibkarId, nov: "techizatci", voen },
          })
        : await prisma.kontragentler.findFirst({
            where: { sahibkar_id: sahibkarId, nov: "techizatci", ad },
          });

      const data = {
        nov: "techizatci",
        ad,
        voen,
        telefon: r.values.telefon ? String(r.values.telefon) : null,
        email: r.values.email ? String(r.values.email) : null,
        unvan: r.values.unvan ? String(r.values.unvan) : null,
        bank_adi: r.values.bank_adi ? String(r.values.bank_adi) : null,
        iban: r.values.iban ? String(r.values.iban) : null,
        // QA: şablonda doldurulan, amma əvvəl yazılmayan sahələr
        direktor: r.values.direktor ? String(r.values.direktor) : undefined,
        odeni__muddet_gun: typeof r.values.odenis_gun === "number" ? r.values.odenis_gun : undefined,
        aktiv: r.values.aktiv === 0 ? false : true,
      };

      if (existing) {
        await prisma.kontragentler.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Təchizatçı yeniləndi: ${ad}` });
      } else {
        const created = await prisma.kontragentler.create({ data: { ...data, sahibkar_id: sahibkarId } });
        // İlkin borc → açıq alış sifarişi (audit #18: əvvəl kontragentler.borc-a
        // yazılırdı, supplier-balance bunu görmürdü).
        const openingBorc = (r.values.borc as number) ?? 0;
        if (openingBorc > 0) {
          const nomre = await nextDocNumber(prisma, sahibkarId, "alis");
          await prisma.alis_sifarisleri.create({
            data: {
              nomre,
              sahibkar_id: sahibkarId,
              techiazatci_id: created.id,
              tarix: new Date(),
              umumi_mebleg: openingBorc,
              odenilmis: 0,
              status: "qebul",
              qeyd: "İlkin borc (idxal açılış qalığı)",
            },
          });
          const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
          await recalculateSupplierBalance(created.id);
        }
        yarat++;
        log.push({ sira: r.sira, emeliyyat: "yarat", mesaj: `Yeni təchizatçı: ${ad}` });
      }
    } catch (e) {
      xeta++;
      log.push({ sira: r.sira, emeliyyat: "xeta", mesaj: String(e) });
    }
  }

  return { partiyaId: "", cemi: rows.length, yarat, yenile, xeta, log };
}

// === HESAB ===
async function importHesab(rows: ParsedRow[]): Promise<ImportResult> {
  const { sahibkarId, istifadeciId } = requireTenant();
  let yarat = 0,
    yenile = 0,
    xeta = 0;
  const log: ImportResult["log"] = [];

  for (const r of rows) {
    try {
      const ad = String(r.values.ad);
      const nov = String(r.values.nov);

      const existing = await prisma.maliye_hesablari.findFirst({
        where: { sahibkar_id: sahibkarId, ad },
      });

      const data = {
        ad,
        nov,
        bank_adi: r.values.bank_adi ? String(r.values.bank_adi) : null,
        iban: r.values.iban ? String(r.values.iban) : null,
        kart_son4: r.values.kart_son4 ? String(r.values.kart_son4) : null,
        valyuta: r.values.valyuta ? String(r.values.valyuta) : "AZN",
        qeyd: r.values.qeyd ? String(r.values.qeyd) : null,
        aktiv: true,
      };

      if (existing) {
        await prisma.maliye_hesablari.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Hesab yeniləndi: ${ad}` });
      } else {
        const created = await prisma.maliye_hesablari.create({ data: { ...data, sahibkar_id: sahibkarId } });
        // İlkin qalıq → finance_operations açılış sətri (audit #18: əvvəl
        // maliye_hesablari.qaliq-a yazılırdı, account-balance bunu görmürdü).
        const openingQaliq = (r.values.qaliq as number) ?? 0;
        if (openingQaliq !== 0) {
          let opType = await prisma.finance_operation_types.findUnique({ where: { kod: "acilis_balans" } }).catch(() => null);
          if (!opType) {
            opType = await prisma.finance_operation_types.create({
              data: { kod: "acilis_balans", ad: "Açılış qalığı", qrup: "acilis", y_n: "daxil" },
            });
          }
          await prisma.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: opType.id,
              type_kod: opType.kod,
              y_n: openingQaliq >= 0 ? "daxil" : "mexaric",
              tarix: new Date(),
              meblegh: Math.abs(openingQaliq),
              valyuta: "AZN",
              mezenne: 1,
              azn_meblegh: Math.abs(openingQaliq),
              hesab_id: created.id,
              qeyd: "İlkin qalıq (idxal açılış balansı)",
              yaradan_id: istifadeciId,
            },
          });
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          await recalculateAccountBalance(created.id);
        }
        yarat++;
        log.push({ sira: r.sira, emeliyyat: "yarat", mesaj: `Yeni hesab: ${ad}` });
      }
    } catch (e) {
      xeta++;
      log.push({ sira: r.sira, emeliyyat: "xeta", mesaj: String(e) });
    }
  }

  return { partiyaId: "", cemi: rows.length, yarat, yenile, xeta, log };
}

// === EMEKDAS ===
async function importEmekdas(rows: ParsedRow[]): Promise<ImportResult> {
  const { sahibkarId } = requireTenant();
  const bcrypt = await import("bcryptjs");
  let yarat = 0,
    yenile = 0,
    xeta = 0;
  const log: ImportResult["log"] = [];

  // get default role (baxan)
  const baxanRol = await prisma.roles.findFirst({
    where: { OR: [{ sahibkar_id: sahibkarId }, { sistem: true }], ad: "baxan" },
  });
  const defaultRolId = baxanRol?.id ?? 3;

  for (const r of rows) {
    try {
      const email = String(r.values.email).toLowerCase();
      const adSoyad = String(r.values.ad_soyad);

      const existing = await prisma.istifadeciler.findFirst({
        where: { sahibkar_id: sahibkarId, email },
      });

      const data = {
        ad_soyad: adSoyad,
        email,
        telefon: r.values.telefon ? String(r.values.telefon) : null,
        vezife: r.values.vezife ? String(r.values.vezife) : null,
        isci_kod: r.values.isci_kod ? String(r.values.isci_kod) : null,
        qohum_telefon: r.values.qohum_tel ? String(r.values.qohum_tel) : null,
        aktiv: r.values.aktiv === 0 ? false : true,
      };

      if (existing) {
        await prisma.istifadeciler.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `İşçi yeniləndi: ${adSoyad}` });
      } else {
        const tempPassword = "temp" + Math.random().toString(36).slice(2, 8);
        const hash = await bcrypt.hash(tempPassword, 10);
        await prisma.istifadeciler.create({
          data: {
            ...data,
            sahibkar_id: sahibkarId,
            sifre_hash: hash,
            rol_id: defaultRolId,
            mecburi_sifre_deyis: true,
          },
        });
        yarat++;
        log.push({
          sira: r.sira,
          emeliyyat: "yarat",
          mesaj: `Yeni işçi: ${adSoyad} — müvəqqəti şifrə: ${tempPassword}`,
        });
      }
    } catch (e) {
      xeta++;
      log.push({ sira: r.sira, emeliyyat: "xeta", mesaj: String(e) });
    }
  }

  return { partiyaId: "", cemi: rows.length, yarat, yenile, xeta, log };
}

// === CRM ===
async function importCrm(rows: ParsedRow[]): Promise<ImportResult> {
  const { sahibkarId } = requireTenant();
  let yarat = 0,
    yenile = 0,
    xeta = 0;
  const log: ImportResult["log"] = [];

  for (const r of rows) {
    try {
      const ad = String(r.values.ad);
      const telefon = r.values.telefon ? String(r.values.telefon) : null;

      const existing = telefon
        ? await prisma.kontragentler.findFirst({
            where: { sahibkar_id: sahibkarId, telefon },
          })
        : null;

      const data = {
        nov: "musteri",
        ad,
        telefon,
        email: r.values.email ? String(r.values.email) : null,
        qaynaq: r.values.qaynaq ? String(r.values.qaynaq) : null,
        funnel_status: r.values.funnel_status ? String(r.values.funnel_status) : "yeni",
        qeyd: r.values.qeyd ? String(r.values.qeyd) : null,
        aktiv: true,
      };

      if (existing) {
        await prisma.kontragentler.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Lead yeniləndi: ${ad}` });
      } else {
        await prisma.kontragentler.create({ data: { ...data, sahibkar_id: sahibkarId } });
        yarat++;
        log.push({ sira: r.sira, emeliyyat: "yarat", mesaj: `Yeni lead: ${ad}` });
      }
    } catch (e) {
      xeta++;
      log.push({ sira: r.sira, emeliyyat: "xeta", mesaj: String(e) });
    }
  }

  return { partiyaId: "", cemi: rows.length, yarat, yenile, xeta, log };
}

// === STOK SAYIM (set-mode: faktiki miqdara dəyişir) ===
async function importStok(rows: ParsedRow[]): Promise<ImportResult> {
  const { sahibkarId, istifadeciId } = requireTenant();
  let yarat = 0,
    yenile = 0,
    xeta = 0;
  const log: ImportResult["log"] = [];

  // Anbar adı → id map
  const anbarlar = await prisma.anbarlar.findMany({
    where: { sahibkar_id: sahibkarId, aktiv: true },
    select: { id: true, ad: true },
  });
  const anbarByName = new Map(anbarlar.map((a) => [a.ad.toLowerCase(), a.id]));
  const defaultAnbar = anbarlar[0];

  for (const r of rows) {
    try {
      const kodOrBarkod = String(r.values.mehsul_kod ?? "").trim();
      if (!kodOrBarkod) throw new Error("Məhsul kodu və ya barkod tələb olunur");

      const mehsul = await prisma.mehsullar.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          OR: [{ kod: kodOrBarkod }, { barkod: kodOrBarkod }],
        },
        select: { id: true, ad: true },
      });
      if (!mehsul) {
        throw new Error(`Məhsul tapılmadı: ${kodOrBarkod}`);
      }

      const anbarName = String(r.values.anbar ?? "").trim().toLowerCase();
      const anbarId = anbarName ? anbarByName.get(anbarName) : defaultAnbar?.id;
      if (!anbarId) {
        throw new Error(anbarName ? `Anbar tapılmadı: ${r.values.anbar}` : "Anbar göstərilməyib və əsas anbar yoxdur");
      }

      const miqdar = Number(r.values.miqdar ?? 0);
      if (!Number.isFinite(miqdar) || miqdar < 0) {
        throw new Error(`Yanlış miqdar: ${r.values.miqdar}`);
      }
      const maya = r.values.maya != null ? Number(r.values.maya) : null;

      // SET mode: mövcud stok bu rəqəmlə əvəzlənir (sayım sonrası tipik istifadə)
      const existing = await prisma.stok.findFirst({
        where: { sahibkar_id: sahibkarId, mehsul_id: mehsul.id, anbar_id: anbarId },
        select: { id: true, miqdar: true },
      });

      if (existing) {
        const oldMiqdar = Number(existing.miqdar);
        const ferq = miqdar - oldMiqdar;
        await prisma.stok.update({
          where: { id: existing.id },
          data: { miqdar, ...(maya != null && maya >= 0 ? { son_qiymet: maya } : {}) },
        });
        // Hərəkət qeydi (inventar correction)
        if (ferq !== 0) {
          await prisma.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId,
              anbar_id: anbarId,
              mehsul_id: mehsul.id,
              nov: "inventar",
              miqdar: Math.abs(ferq),
              qiymet: maya ?? null,
              ref_nov: "excel_import",
              edilen_id: istifadeciId,
              qeyd: `Excel idxal: ${oldMiqdar} → ${miqdar}`,
            },
          }).catch(() => {});
        }
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `${mehsul.ad}: ${oldMiqdar} → ${miqdar}` });
      } else {
        await prisma.stok.create({
          data: {
            sahibkar_id: sahibkarId,
            mehsul_id: mehsul.id,
            anbar_id: anbarId,
            miqdar,
            son_qiymet: maya ?? null,
          },
        });
        await prisma.anbar_hereketleri.create({
          data: {
            sahibkar_id: sahibkarId,
            anbar_id: anbarId,
            mehsul_id: mehsul.id,
            nov: "medaxil",
            miqdar,
            qiymet: maya ?? null,
            ref_nov: "excel_import",
            edilen_id: istifadeciId,
            qeyd: "Excel idxal: ilkin stok",
          },
        }).catch(() => {});
        yarat++;
        log.push({ sira: r.sira, emeliyyat: "yarat", mesaj: `${mehsul.ad}: ${miqdar} vahid əlavə edildi` });
      }
    } catch (e) {
      xeta++;
      log.push({ sira: r.sira, emeliyyat: "xeta", mesaj: e instanceof Error ? e.message : String(e) });
    }
  }

  return { partiyaId: "", cemi: rows.length, yarat, yenile, xeta, log };
}

export function isImporterAvailable(key: string): boolean {
  return key in importers;
}
