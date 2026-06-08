"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { PRODUCT_TEMPLATE_COLUMNS } from "./template";
import { audit } from "@/lib/audit/log";

type RawRow = Record<string, string | number | null | undefined>;
type ParsedRow = {
  sira: number;
  raw: RawRow;
  ad?: string;
  kod?: string;
  barkod?: string;
  kateqoriya?: string;
  marka?: string;
  vahid?: string;
  say?: number;
  alish_qiymeti?: number;
  satis_qiymeti?: number;
  min_satis_qiymeti?: number;
  topdan_qiymeti?: number;
  kritik_stok?: number;
  tesvir?: string;
  error?: string;
};

type ImportPreview = {
  partiya_id: string;
  cemi: number;
  yeni: number;
  yenilenecek: number;
  duplicate: number;
  xeta: number;
  preview: Array<{
    sira: number;
    emeliyyat: "yarat" | "yenile" | "xeta";
    ad: string;
    kod?: string;
    say?: number;
    satis_qiymeti?: number;
    error?: string;
  }>;
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function toNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
function toStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

const HEADER_MAP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of PRODUCT_TEMPLATE_COLUMNS) {
    m[c.header.toLowerCase()] = c.key;
    m[(c.header + " *").toLowerCase()] = c.key;
    m[c.key] = c.key;
  }
  // common aliases
  m["məhsul adı"] = "ad";
  m["məhsulun adı"] = "ad";
  m["məhsul"] = "ad";
  m["sku"] = "kod";
  m["kod (sku)"] = "kod";
  m["qiymet"] = "satis_qiymeti";
  m["qiymət"] = "satis_qiymeti";
  m["satış qiymət"] = "satis_qiymeti";
  m["stok"] = "say";
  m["miqdar"] = "say";
  m["müktiyət"] = "say";
  m["maya"] = "alish_qiymeti";
  m["maya qiyməti"] = "alish_qiymeti";
  return m;
})();

function detectColumnMap(headerRow: ExcelJS.Row): Map<number, string> {
  const map = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const text = String(cell.text ?? "").trim().toLowerCase();
    const key = HEADER_MAP[text];
    if (key) map.set(col, key);
  });
  return map;
}

async function parseWorkbookAsync(buffer: ArrayBuffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const colMap = detectColumnMap(sheet.getRow(1));
  if (colMap.size === 0) return [];

  const out: ParsedRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: RawRow = {};
    colMap.forEach((key, col) => {
      const cell = row.getCell(col);
      // ExcelJS stores result for formulas; fall back to value/text
      const v = (cell.result ?? cell.value ?? cell.text) as string | number | null;
      raw[key] = v as never;
    });

    const ad = toStr(raw.ad);
    const satis = toNum(raw.satis_qiymeti);
    const say = toNum(raw.say);

    const parsed: ParsedRow = {
      sira: rowNumber,
      raw,
      ad,
      kod: toStr(raw.kod),
      barkod: toStr(raw.barkod),
      kateqoriya: toStr(raw.kateqoriya),
      marka: toStr(raw.marka),
      vahid: toStr(raw.vahid),
      say,
      alish_qiymeti: toNum(raw.alish_qiymeti),
      satis_qiymeti: satis,
      min_satis_qiymeti: toNum(raw.min_satis_qiymeti),
      topdan_qiymeti: toNum(raw.topdan_qiymeti),
      kritik_stok: toNum(raw.kritik_stok),
      tesvir: toStr(raw.tesvir),
    };

    if (!ad) parsed.error = "Məhsul adı boşdur";
    else if (say == null) parsed.error = "Say (stok) boşdur";
    else if (satis == null) parsed.error = "Satış qiyməti boşdur";
    else if (satis < 0) parsed.error = "Satış qiyməti mənfi ola bilməz";
    else if (say < 0) parsed.error = "Say mənfi ola bilməz";

    out.push(parsed);
  });

  return out;
}

export async function analyzeImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  const file = formData.get("fayl");
  if (!(file instanceof Blob)) return { ok: false, error: "Fayl seçilməyib" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Fayl 10 MB-dan böyükdür" };

  const filename = "originalname" in file && typeof (file as { name?: string }).name === "string"
    ? (file as { name: string }).name
    : "import.xlsx";

  const arrayBuf = await file.arrayBuffer();
  let rows: ParsedRow[];
  try {
    rows = await parseWorkbookAsync(arrayBuf);
  } catch (e) {
    console.error("[analyzeImport parse]", e);
    return { ok: false, error: "Excel faylı oxuna bilmədi" };
  }

  if (rows.length === 0) return { ok: false, error: "Faylda məlumat yoxdur" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    // Resolve existing products by kod or barkod (lower-cased)
    const codes = rows.map((r) => r.kod).filter(Boolean) as string[];
    const barcodes = rows.map((r) => r.barkod).filter(Boolean) as string[];

    const existing = codes.length || barcodes.length
      ? await prisma.mehsullar.findMany({
          where: {
            OR: [
              codes.length ? { kod: { in: codes } } : undefined,
              barcodes.length ? { barkod: { in: barcodes } } : undefined,
            ].filter(Boolean) as never,
          },
          select: { id: true, kod: true, barkod: true, ad: true },
        })
      : [];

    const byKod = new Map<string, (typeof existing)[number]>();
    const byBar = new Map<string, (typeof existing)[number]>();
    for (const m of existing) {
      if (m.kod) byKod.set(m.kod, m);
      if (m.barkod) byBar.set(m.barkod, m);
    }

    let yeni = 0,
      yenilenecek = 0,
      duplicate = 0,
      xeta = 0;
    const seenKey = new Map<string, number>();
    const preview: ImportPreview["preview"] = [];

    for (const r of rows) {
      if (r.error) {
        xeta++;
        preview.push({
          sira: r.sira,
          emeliyyat: "xeta",
          ad: r.ad ?? "",
          error: r.error,
        });
        continue;
      }
      const key = (r.kod ?? r.barkod ?? r.ad ?? "").toLowerCase();
      if (seenKey.has(key)) duplicate++;
      seenKey.set(key, r.sira);

      const found = (r.kod && byKod.get(r.kod)) || (r.barkod && byBar.get(r.barkod));
      const op: "yarat" | "yenile" = found ? "yenile" : "yarat";
      if (found) yenilenecek++;
      else yeni++;

      preview.push({
        sira: r.sira,
        emeliyyat: op,
        ad: r.ad!,
        kod: r.kod,
        say: r.say,
        satis_qiymeti: r.satis_qiymeti,
      });
    }

    // Create import batch
    const partiya = await prisma.import_partiyalari.create({
      data: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        sablon_nov: "mehsul_standart",
        fayl_adi: filename.slice(0, 250),
        fayl_olcu: BigInt(file.size),
        status: "preview",
        cemi_satir: rows.length,
        yeni_satir: yeni,
        yenilenecek,
        duplicate_satir: duplicate,
        xeta_satir: xeta,
        preview_data: rows.map((r) => ({
          sira: r.sira,
          ad: r.ad ?? null,
          kod: r.kod ?? null,
          barkod: r.barkod ?? null,
          kateqoriya: r.kateqoriya ?? null,
          marka: r.marka ?? null,
          vahid: r.vahid ?? null,
          say: r.say ?? null,
          alish_qiymeti: r.alish_qiymeti ?? null,
          satis_qiymeti: r.satis_qiymeti ?? null,
          min_satis_qiymeti: r.min_satis_qiymeti ?? null,
          topdan_qiymeti: r.topdan_qiymeti ?? null,
          kritik_stok: r.kritik_stok ?? null,
          tesvir: r.tesvir ?? null,
          error: r.error ?? null,
        })) as never,
      },
    });

    await audit("import", "mehsul_import_preview", partiya.id, {
      yeni_data: {
        fayl_adi: filename.slice(0, 250),
        cemi: rows.length,
        yeni, yenilenecek, duplicate, xeta,
      },
      sebeb: "İdxal preview yaradıldı",
    });

    return {
      ok: true,
      data: {
        partiya_id: partiya.id,
        cemi: rows.length,
        yeni,
        yenilenecek,
        duplicate,
        xeta,
        preview: preview.slice(0, 50),
      },
    };
  });
}

type ExecuteResult = {
  partiya_id: string;
  yaradildi: number;
  yenilendi: number;
  xeta: number;
};

export async function executeImport(partiyaId: string): Promise<ActionResult<ExecuteResult>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const partiya = await prisma.import_partiyalari.findFirst({
      where: { id: partiyaId, sahibkar_id: sahibkarId },
    });
    if (!partiya) return { ok: false, error: "Partiya tapılmadı" };
    if (partiya.status === "tamamlandi") return { ok: false, error: "Artıq icra olunub" };
    if (!partiya.preview_data) return { ok: false, error: "Preview məlumatı yoxdur" };

    const rows = partiya.preview_data as unknown as Array<{
      sira: number;
      ad: string | null;
      kod: string | null;
      barkod: string | null;
      kateqoriya: string | null;
      marka: string | null;
      vahid: string | null;
      say: number | null;
      alish_qiymeti: number | null;
      satis_qiymeti: number | null;
      min_satis_qiymeti: number | null;
      topdan_qiymeti: number | null;
      kritik_stok: number | null;
      tesvir: string | null;
      error: string | null;
    }>;

    // Default anbar for stock writes
    const defaultAnbar = await prisma.anbarlar.findFirst({
      where: { aktiv: true },
      orderBy: { yaradildi: "asc" },
    });

    // Cache categories, brands, and units lookup (case-insensitive)
    const categoryNames = [...new Set(rows.map((r) => r.kateqoriya).filter(Boolean) as string[])];
    const brandNames = [...new Set(rows.map((r) => r.marka).filter(Boolean) as string[])];
    const unitNames = [...new Set(rows.map((r) => r.vahid).filter(Boolean) as string[])];

    const [cats, brands, units] = await Promise.all([
      categoryNames.length
        ? prisma.kateqoriyalar.findMany({ where: { ad: { in: categoryNames, mode: "insensitive" } } })
        : Promise.resolve([]),
      brandNames.length
        ? prisma.markalar.findMany({ where: { ad: { in: brandNames, mode: "insensitive" } } })
        : Promise.resolve([]),
      unitNames.length
        ? prisma.olcu_vahidleri.findMany({ where: { ad: { in: unitNames, mode: "insensitive" } } })
        : Promise.resolve([]),
    ]);

    const catMap = new Map<string, number>(cats.map((c) => [c.ad.toLowerCase(), c.id]));
    const brandMap = new Map<string, number>(brands.map((b) => [b.ad.toLowerCase(), b.id]));
    const unitMap = new Map<string, number>(units.map((u) => [u.ad.toLowerCase(), u.id]));

    async function resolveCategory(name: string | null): Promise<number | null> {
      if (!name) return null;
      const found = catMap.get(name.toLowerCase());
      if (found) return found;
      const created = await prisma.kateqoriyalar.create({
        data: { sahibkar_id: sahibkarId, ad: name },
      });
      catMap.set(name.toLowerCase(), created.id);
      return created.id;
    }

    async function resolveBrand(name: string | null): Promise<number | null> {
      if (!name) return null;
      const found = brandMap.get(name.toLowerCase());
      if (found) return found;
      const created = await prisma.markalar.create({
        data: { sahibkar_id: sahibkarId, ad: name, aktiv: true },
      });
      brandMap.set(name.toLowerCase(), created.id);
      return created.id;
    }

    async function resolveUnit(name: string | null): Promise<number | null> {
      if (!name) return null;
      const found = unitMap.get(name.toLowerCase());
      if (found) return found;
      try {
        const created = await prisma.olcu_vahidleri.create({
          data: { sahibkar_id: sahibkarId, ad: name },
        });
        unitMap.set(name.toLowerCase(), created.id);
        return created.id;
      } catch {
        return null;
      }
    }

    let yaradildi = 0,
      yenilendi = 0,
      xeta = 0;

    for (const r of rows) {
      if (r.error || !r.ad || r.satis_qiymeti == null || r.say == null) {
        xeta++;
        continue;
      }
      try {
        const kateqoriya_id = await resolveCategory(r.kateqoriya);
        const marka_id = await resolveBrand(r.marka);
        const olcu_id = await resolveUnit(r.vahid);

        // Match existing by kod or barkod
        const found = (r.kod || r.barkod)
          ? await prisma.mehsullar.findFirst({
              where: {
                OR: [
                  r.kod ? { kod: r.kod } : undefined,
                  r.barkod ? { barkod: r.barkod } : undefined,
                ].filter(Boolean) as never,
              },
            })
          : null;

        let mehsulId: string;
        if (found) {
          await prisma.mehsullar.update({
            where: { id: found.id },
            data: {
              ad: r.ad,
              kod: r.kod,
              barkod: r.barkod,
              kateqoriya_id,
              marka_id,
              olcu_id: olcu_id ?? undefined,
              alish_qiymeti: r.alish_qiymeti ?? undefined,
              satis_qiymeti: r.satis_qiymeti,
              min_satis_qiymeti: r.min_satis_qiymeti ?? undefined,
              topdan_qiymeti: r.topdan_qiymeti ?? undefined,
              kritik_stok: r.kritik_stok ?? undefined,
              aciqlamaq: r.tesvir ?? undefined,
            },
          });
          mehsulId = found.id;
          yenilendi++;
        } else {
          const created = await prisma.mehsullar.create({
            data: {
              sahibkar_id: sahibkarId,
              ad: r.ad,
              kod: r.kod,
              barkod: r.barkod,
              kateqoriya_id,
              marka_id,
              olcu_id: olcu_id ?? undefined,
              alish_qiymeti: r.alish_qiymeti ?? 0,
              satis_qiymeti: r.satis_qiymeti,
              min_satis_qiymeti: r.min_satis_qiymeti ?? 0,
              topdan_qiymeti: r.topdan_qiymeti ?? 0,
              kritik_stok: r.kritik_stok ?? null,
              aciqlamaq: r.tesvir ?? null,
              aktiv: true,
            },
          });
          mehsulId = created.id;
          yaradildi++;
        }

        // Stok seedi (default anbar) — ATOMIC upsert + anbar_hereketleri audit qeydi
        if (defaultAnbar && r.say != null) {
          // Əvvəlki miqdarı al (audit üçün)
          const existingStok = await prisma.stok.findFirst({
            where: { mehsul_id: mehsulId, anbar_id: defaultAnbar.id },
            select: { miqdar: true },
          });
          const evvelkiMiqdar = Number(existingStok?.miqdar ?? 0);
          const yeniMiqdar = Number(r.say);
          const ferq = yeniMiqdar - evvelkiMiqdar;

          // ATOMIC upsert — race-safe (findFirst/update vs create race-i önləyir)
          await prisma.stok.upsert({
            where: {
              mehsul_id_anbar_id: { mehsul_id: mehsulId, anbar_id: defaultAnbar.id },
            },
            update: {
              miqdar: yeniMiqdar,
              son_qiymet: r.alish_qiymeti ?? undefined,
            },
            create: {
              sahibkar_id: sahibkarId,
              mehsul_id: mehsulId,
              anbar_id: defaultAnbar.id,
              miqdar: yeniMiqdar,
              son_qiymet: r.alish_qiymeti ?? null,
            },
          });

          // Audit — anbar_hereketleri yaz ki, ilkin idxal source-of-truth-da görünsün
          if (Math.abs(ferq) > 0.001) {
            try {
              await prisma.anbar_hereketleri.create({
                data: {
                  sahibkar_id: sahibkarId,
                  anbar_id: defaultAnbar.id,
                  mehsul_id: mehsulId,
                  nov: ferq > 0 ? "medaxil" : "mexaric",
                  miqdar: Math.abs(ferq),
                  qiymet: r.alish_qiymeti ?? null,
                  ref_nov: "excel_idxal",
                  qeyd: `Excel idxal — Sıra ${r.sira} (${evvelkiMiqdar} → ${yeniMiqdar})`,
                },
              });
            } catch { /* non-fatal */ }
          }
        }
      } catch (e) {
        console.error("[executeImport row]", r.sira, e);
        xeta++;
      }
    }

    await prisma.import_partiyalari.update({
      where: { id: partiyaId },
      data: {
        status: "tamamlandi",
        ugurlu_satir: yaradildi + yenilendi,
        xeta_satir: xeta,
        tamamlandi_de: new Date(),
      },
    });

    revalidatePath("/anbar");
    revalidatePath("/anbar/mehsullar");
    revalidatePath("/ayarlar/inteqrasiya");

    await audit("import", "mehsul_import_execute", partiyaId, {
      yeni_data: { yaradildi, yenilendi, xeta },
      sebeb: "İdxal partiyası icra edildi",
    });

    return { ok: true, data: { partiya_id: partiyaId, yaradildi, yenilendi, xeta } };
  });
}

export async function cancelImport(partiyaId: string): Promise<ActionResult<undefined>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const found = await prisma.import_partiyalari.findFirst({
      where: { id: partiyaId, sahibkar_id: sahibkarId },
    });
    if (!found) return { ok: false, error: "Tapılmadı" };
    if (found.status === "tamamlandi") return { ok: false, error: "Tamamlanmış silinmir" };
    await prisma.import_partiyalari.delete({ where: { id: partiyaId } });
    await audit("legv", "mehsul_import_partiya", partiyaId, {
      sebeb: "İdxal partiyası ləğv edildi",
    });
    revalidatePath("/ayarlar/inteqrasiya");
    return { ok: true, data: undefined };
  });
}
