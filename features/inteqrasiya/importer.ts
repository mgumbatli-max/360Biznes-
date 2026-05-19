import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { withTenant } from "@/lib/db/with-tenant";
import { ParsedRow } from "./excel-parser";

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

      const data = {
        ad,
        kod,
        barkod,
        marka: r.values.marka ? String(r.values.marka) : null,
        model: r.values.model ? String(r.values.model) : null,
        kateqoriya: r.values.kateqoriya ? String(r.values.kateqoriya) : null,
        tesvir: r.values.tesvir ? String(r.values.tesvir) : null,
        alish_qiymeti: (r.values.alish_qiymeti as number) ?? 0,
        satis_qiymeti: (r.values.satis_qiymeti as number) ?? 0,
        topdan_qiymeti: (r.values.topdan_qiymeti as number) ?? null,
        partnyor_qiymeti: (r.values.partnyor_qiymeti as number) ?? null,
        vip_qiymeti: (r.values.vip_qiymeti as number) ?? null,
        kritik_stok: (r.values.kritik_stok as number) ?? 0,
        vergi: (r.values.vergi as number) ?? null,
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
        qiymet_tipi: r.values.qiymet_tipi ? String(r.values.qiymet_tipi) : "adi",
        borc: (r.values.borc as number) ?? 0,
        qeyd: r.values.qeyd ? String(r.values.qeyd) : null,
        aktiv: r.values.aktiv === 0 ? false : true,
      };

      if (existing) {
        await prisma.kontragentler.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Müştəri yeniləndi: ${ad}` });
      } else {
        await prisma.kontragentler.create({ data: { ...data, sahibkar_id: sahibkarId } });
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

      const existing = voen
        ? await prisma.kontragentler.findFirst({
            where: { sahibkar_id: sahibkarId, nov: "techizatci", voen },
          })
        : null;

      const data = {
        nov: "techizatci",
        ad,
        voen,
        telefon: r.values.telefon ? String(r.values.telefon) : null,
        email: r.values.email ? String(r.values.email) : null,
        unvan: r.values.unvan ? String(r.values.unvan) : null,
        bank_adi: r.values.bank_adi ? String(r.values.bank_adi) : null,
        iban: r.values.iban ? String(r.values.iban) : null,
        borc: (r.values.borc as number) ?? 0,
        aktiv: r.values.aktiv === 0 ? false : true,
      };

      if (existing) {
        await prisma.kontragentler.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Təchizatçı yeniləndi: ${ad}` });
      } else {
        await prisma.kontragentler.create({ data: { ...data, sahibkar_id: sahibkarId } });
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
  const { sahibkarId } = requireTenant();
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
        qaliq: (r.values.qaliq as number) ?? 0,
        qeyd: r.values.qeyd ? String(r.values.qeyd) : null,
        aktiv: true,
      };

      if (existing) {
        await prisma.maliye_hesablari.update({ where: { id: existing.id }, data });
        yenile++;
        log.push({ sira: r.sira, emeliyyat: "yenile", mesaj: `Hesab yeniləndi: ${ad}` });
      } else {
        await prisma.maliye_hesablari.create({ data: { ...data, sahibkar_id: sahibkarId } });
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

export function isImporterAvailable(key: string): boolean {
  return key in importers;
}
