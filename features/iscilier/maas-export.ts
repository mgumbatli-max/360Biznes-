"use server";

import ExcelJS from "exceljs";
import { getMaasTable } from "./maas-queries";
import { requireHrActionPerm } from "./access-guard";
import { formatDate } from "@/lib/utils";

const MONTH_LABELS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

/**
 * Aylıq maaş bordrosunu Excel-ə export edir.
 * Server action — base64 buffer + filename qaytarır, client `<a download>`-la endirir.
 */
export async function exportMaasExcel(monthArg?: string): Promise<{ ok: true; filename: string; data: string } | { ok: false; error: string }> {
  try {
    // QA-K1: server action client-dən birbaşa çağırıla bilir — səhifə guard-ı
    // kifayət deyil, action özü maas.view/maas.idare tələb etməlidir.
    const perm = await requireHrActionPerm(["maas.view", "maas.idare"]);
    if (!perm.ok) return { ok: false, error: perm.error };

    const { month, rows, totals } = await getMaasTable(monthArg);

    const wb = new ExcelJS.Workbook();
    wb.creator = "360biznes";
    wb.created = new Date();

    const ws = wb.addWorksheet(`Bordro ${MONTH_LABELS[month.ay - 1]} ${month.il}`);
    ws.columns = [
      { header: "#",            key: "sira",          width: 4 },
      { header: "Ad Soyad",     key: "ad",            width: 28 },
      { header: "Vəzifə",       key: "vezife",        width: 20 },
      { header: "Əsas maaş",    key: "esas",          width: 12 },
      { header: "İş günü norma",key: "norma",         width: 11 },
      { header: "Faktiki gün",  key: "faktiki",       width: 11 },
      { header: "Qaib",         key: "qaib",          width: 8 },
      { header: "Məzuniyyət",   key: "mezuniyyet",    width: 11 },
      { header: "Pro-rata",     key: "prorata",       width: 11 },
      { header: "KPI bonus",    key: "kpi",           width: 11 },
      { header: "Manual bonus", key: "manual",        width: 11 },
      { header: "Satış komis.", key: "komisyon",      width: 12 },
      { header: "Cərimə",       key: "cerime",        width: 10 },
      { header: "Avans",        key: "avans",         width: 10 },
      { header: "Vergi",        key: "vergi",         width: 10 },
      { header: "Sos. sığorta", key: "sosial",        width: 12 },
      { header: "NET",          key: "net",           width: 12 },
      { header: "Status",       key: "status",        width: 12 },
      { header: "Ödəniş tarixi",key: "odenish_tarixi",width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
    ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

    rows.forEach((r, idx) => {
      ws.addRow({
        sira:           idx + 1,
        ad:             r.ad_soyad,
        vezife:         r.vezife ?? "—",
        esas:           r.esas_maas,
        norma:          r.ish_gun_norma,
        faktiki:        r.ish_gun_faktiki,
        qaib:           r.qaib_gun,
        mezuniyyet:     r.mezuniyyet_gun,
        prorata:        r.prorata_maas,
        kpi:            r.kpi_bonus,
        manual:         r.manual_bonus,
        komisyon:       r.satis_komisyon,
        cerime:         r.cerime,
        avans:          r.avans,
        vergi:          r.vergi,
        sosial:         r.sosial_sigorta,
        net:            r.net_meblegh,
        status:         r.status,
        odenish_tarixi: r.odenish_tarixi ? formatDate(r.odenish_tarixi) : "—",
      });
    });

    // Money columns format
    const moneyCols = ["esas", "prorata", "kpi", "manual", "komisyon", "cerime", "avans", "vergi", "sosial", "net"];
    moneyCols.forEach((k) => {
      const col = ws.getColumn(k);
      if (col) col.numFmt = "#,##0.00";
    });

    // Totals row
    const totalsRow = ws.addRow({
      sira: "",
      ad: "CƏMİ",
      net: totals.cemi,
      vergi: totals.vergi,
    });
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };

    // Borders for all data rows
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const data = Buffer.from(buffer).toString("base64");
    const filename = `bordro-${month.il}-${String(month.ay).padStart(2, "0")}.xlsx`;
    return { ok: true, filename, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Xəta" };
  }
}
