import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getProducts, type ProductFilter } from "@/features/anbar/queries";
import { withTenant } from "@/lib/db/with-tenant";
import { audit } from "@/lib/audit/log";
import { canViewCost } from "@/lib/auth/finance-permissions";

function asArray(v: string | string[] | null): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const withImages = sp.get("sekil") === "1";
  const filter: ProductFilter = {
    search: sp.get("q") ?? undefined,
    kateqoriya_id: sp.getAll("kateq").map(Number).filter(Number.isFinite),
    marka_id: sp.getAll("marka").map(Number).filter(Number.isFinite),
    stok_status: asArray(sp.getAll("stok_status")) as ProductFilter["stok_status"],
  };

  // İcazə yoxlaması: maya/marja yalnız sahibkar/admin/maya.gor olanlara
  const canSeeCost = await canViewCost();

  // Fetch ALL pages (capped at 10k for safety)
  const { items } = await getProducts(filter, 1, 10000);
  await withTenant(async () => {
    await audit("export", "mehsul_export", null, {
      yeni_data: { count: items.length, filter, can_see_cost: canSeeCost, with_images: withImages },
      sebeb: "Məhsul siyahısı Excel-ə ixrac edildi",
    });
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "360Biznes";
  wb.created = new Date();
  const ws = wb.addWorksheet("Məhsullar");

  // Dinamik sütunlar — maya/marja yalnız icazəsi olana göstərilir
  const baseColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Ad", key: "ad", width: 40 },
    { header: "Kod", key: "kod", width: 16 },
    { header: "Barkod", key: "barkod", width: 18 },
    { header: "Kateqoriya", key: "kateqoriya", width: 20 },
    { header: "Marka", key: "marka", width: 16 },
  ];
  const costColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Maya (AZN)", key: "maya", width: 14 },
  ];
  const tailColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Satış (AZN)", key: "satis", width: 14 },
  ];
  const marginColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Margin %", key: "margin", width: 12 },
  ];
  const stokColumns: Array<{ header: string; key: string; width: number }> = [
    { header: "Stok", key: "stok", width: 10 },
    { header: "Kritik stok", key: "kritik", width: 12 },
    { header: "Aktiv", key: "aktiv", width: 8 },
  ];

  const imageColumn: Array<{ header: string; key: string; width: number }> = [
    { header: "Şəkil", key: "sekil", width: 9 },
  ];

  ws.columns = [
    ...(withImages ? imageColumn : []),
    ...baseColumns,
    ...(canSeeCost ? costColumns : []),
    ...tailColumns,
    ...(canSeeCost ? marginColumns : []),
    ...stokColumns,
  ];

  // Style header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2950" } };
  ws.getRow(1).font = { color: { argb: "FFF1F5FB" }, bold: true };

  for (const p of items) {
    const margin = p.alish_qiymeti > 0 ? ((p.satis_qiymeti - p.alish_qiymeti) / p.alish_qiymeti) * 100 : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {
      ad: p.ad,
      kod: p.kod ?? "",
      barkod: p.barkod ?? "",
      kateqoriya: p.kateqoriya_ad ?? "",
      marka: p.marka_ad ?? "",
      satis: p.satis_qiymeti,
      stok: p.stok_miqdari,
      kritik: p.kritik_stok ?? "",
      aktiv: p.aktiv ? "Bəli" : "Xeyr",
    };
    if (canSeeCost) {
      row.maya = p.alish_qiymeti;
      row.margin = p.alish_qiymeti > 0 ? margin / 100 : null;
    }
    ws.addRow(row);
  }

  // Number formats — yalnız mövcud sütunlar üçün
  if (canSeeCost) {
    ws.getColumn("maya").numFmt = "#,##0.00";
    ws.getColumn("margin").numFmt = "0.0%";
  }
  ws.getColumn("satis").numFmt = "#,##0.00";
  ws.getColumn("stok").numFmt = "#,##0";
  ws.getColumn("kritik").numFmt = "#,##0";

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // === Şəkil gömmə (opt-in: ?sekil=1) ===
  // Performans/fayl ölçüsü üçün: sharp ilə kiçik PNG thumbnail-a çevirilir,
  // concurrency-limitli yüklənir və IMG_CAP ilə məhdudlaşır.
  if (withImages) {
    const IMG_CAP = 2000;
    const CONCURRENCY = 12;
    const THUMB = 56;

    // Data sətirlərinin hündürlüyü — thumbnail sığsın
    for (let i = 0; i < items.length; i++) {
      ws.getRow(i + 2).height = 44;
    }

    // sharp Next.js-in transitive asılılığıdır; yoxdursa şəkilsiz davam edirik
    let sharpLib: ((input: Buffer) => import("sharp").Sharp) | null = null;
    try {
      const mod = await import("sharp");
      sharpLib = (mod.default ?? mod) as unknown as (input: Buffer) => import("sharp").Sharp;
    } catch {
      sharpLib = null;
    }

    if (sharpLib) {
      const make = sharpLib;
      const targets = items
        .map((p, i) => ({ url: p.sekil_url, rowIdx: i + 1 }))
        .filter((t): t is { url: string; rowIdx: number } => !!t.url)
        .slice(0, IMG_CAP);

      async function embedOne(t: { url: string; rowIdx: number }): Promise<void> {
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 6000);
          const resp = await fetch(t.url, { signal: ctrl.signal }).finally(() => clearTimeout(to));
          if (!resp.ok) return;
          const input = Buffer.from(await resp.arrayBuffer());
          const png = await make(input)
            .resize(THUMB, THUMB, { fit: "inside", withoutEnlargement: true })
            .png()
            .toBuffer();
          // wb.addImage → ws.addImage arasında await YOXDUR (id təhlükəsiz)
          const imageId = wb.addImage({ buffer: png as unknown as ExcelJS.Buffer, extension: "png" });
          ws.addImage(imageId, {
            tl: { col: 0, row: t.rowIdx },
            ext: { width: THUMB, height: THUMB },
            editAs: "oneCell",
          });
        } catch {
          /* tək şəkilin uğursuzluğu ixracı dayandırmasın */
        }
      }

      let next = 0;
      async function worker(): Promise<void> {
        while (next < targets.length) {
          const cur = targets[next++];
          await embedOne(cur);
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()),
      );
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `mehsullar${withImages ? "-sekilli" : ""}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
