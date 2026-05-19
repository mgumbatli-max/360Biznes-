import { NextRequest, NextResponse } from "next/server";
import { getKpiDashboard } from "@/features/iscilier/kpi-dashboard-queries";

export const dynamic = "force-dynamic";

/**
 * KPI Dashboard CSV eksportu.
 * Excel-də (və ya Numbers/Google Sheets-də) açılır.
 *
 * GET parametrləri:
 *  - month: YYYY-MM
 *  - search: ad/vəzifə filtri
 *  - vezife: konkret vəzifə
 *  - sort: SortKey, dir: asc/desc
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const { rows, month } = await getKpiDashboard({
      monthStr: sp.get("month") ?? undefined,
      search: sp.get("search") ?? undefined,
      vezifeFilter: sp.get("vezife") ?? undefined,
      sortBy: (sp.get("sort") as never) ?? undefined,
      sortDir: (sp.get("dir") as never) ?? undefined,
      // Eksport həmişə real data ilə işləyir — gizli mod tətbiq olunmur
      rawData: true,
    });

    const header = [
      "Ad Soyad", "Vəzifə", "Rol", "Maaş", "Bonus (qazanılan)", "Bonus (pool)",
      "Cərimə", "Net", "Davamiyyət %", "Tapşırıq %", "Səhv %", "Satış ₼", "Satış sayı",
      "Performans skoru",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push([
        r.ad_soyad,
        r.vezife ?? "",
        r.rol_ad ?? "",
        r.aylik_maas,
        r.bonus_qazanilan,
        r.bonus_pool,
        r.cerime_toplam,
        r.net_maas,
        r.davamiyyet_faiz.toFixed(1),
        r.tapsiriq_faiz.toFixed(1),
        r.sehv_faiz.toFixed(1),
        r.satis_meblegh,
        r.satis_sayi,
        r.performans_skoru,
      ].map((v) => csvCell(String(v))).join(","));
    }
    // BOM — Excel UTF-8 düzgün oxusun deyə
    const csv = "﻿" + lines.join("\r\n");
    const filename = `kpi-${month.il}-${String(month.ay).padStart(2, "0")}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("[kpi-export]", e);
    return NextResponse.json({ ok: false, error: "Eksport alınmadı" }, { status: 500 });
  }
}

function csvCell(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}
