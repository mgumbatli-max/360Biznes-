import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withTenant } from "@/lib/db/with-tenant";
import { getReorderList } from "@/features/hesabatlar/mehsul-queries";
import { requireHesabatActionPerm } from "@/features/hesabatlar/access-guard";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Reorder report — returns a print-friendly HTML page that can be saved to PDF
 * via the browser's "Print → Save as PDF" flow. Avoids extra deps.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const perm = await requireHesabatActionPerm("hesabat.view");
  if (!perm.ok) return new NextResponse(perm.error, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").toLowerCase();

  const rows = await withTenant(async () => getReorderList(200));
  const filtered = rows.filter((r) => {
    if (q && !(r.ad.toLowerCase().includes(q) || (r.kod ?? "").toLowerCase().includes(q))) return false;
    return true;
  });

  const today = formatDate(new Date(), { day: "numeric", month: "long", year: "numeric" });
  const escapeHtml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] || c);
  const tbody = filtered
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.ad)}${r.kod ? `<div style="font-size:10px;color:#6b7280;font-family:monospace">${escapeHtml(r.kod)}</div>` : ""}</td>
        <td style="text-align:right">${r.stok.toFixed(0)}</td>
        <td style="text-align:right">${r.min_stok.toFixed(0)}</td>
        <td style="text-align:right">${r.kritik_stok != null ? r.kritik_stok.toFixed(0) : "—"}</td>
        <td style="text-align:right;color:#b45309;font-weight:600">${Math.max(0, r.min_stok - r.stok).toFixed(0)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8">
<title>Reorder hesabatı — ${today}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#0f172a;margin:24px}
  h1{margin:0 0 4px 0;font-size:22px}
  .meta{color:#64748b;font-size:12px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#f1f5f9;text-align:left;padding:8px 10px;border-bottom:1px solid #cbd5e1;text-transform:uppercase;font-size:10px;letter-spacing:.05em;color:#475569}
  td{padding:7px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  tr:last-child td{border-bottom:none}
  @media print{ .noprint{display:none} body{margin:12px} }
  .btn{display:inline-block;padding:6px 12px;border-radius:6px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:600;font-size:12px}
</style>
</head>
<body>
  <h1>Reorder lazım olan məhsullar</h1>
  <div class="meta">Hesabat tarixi: ${today} · Yekun: ${filtered.length} məhsul</div>
  <div class="noprint" style="margin-bottom:14px">
    <a href="javascript:window.print()" class="btn">Çap et / PDF kimi saxla</a>
  </div>
  <table>
    <thead><tr>
      <th>Məhsul</th><th style="text-align:right">Stok</th><th style="text-align:right">Min</th>
      <th style="text-align:right">Kritik</th><th style="text-align:right">Çatışmır</th>
    </tr></thead>
    <tbody>${tbody || `<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8">Reorder lazım deyil</td></tr>`}</tbody>
  </table>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
