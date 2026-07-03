import "server-only";
import { prisma } from "@/lib/db/prisma";
import { runWithTenant } from "@/lib/db/tenant-context";
import { formatDate } from "@/lib/utils";

export type DailySummary = {
  sahibkar_id: string;
  sahibkar_ad: string | null;
  date: string;          // YYYY-MM-DD
  sales: {
    count: number;
    total: number;
    cash: number;
    card: number;
    bank: number;
    debt: number;
  };
  purchases: { count: number; total: number };
  returns: { count: number; total: number };
  webhooks: { count: number; total: number };
  new_customers: number;
  payments: { in_total: number; out_total: number; net: number };
  low_stock: number;
  pending_tasks: number;
  top_products: Array<{ ad: string; qty: number; mebleg: number }>;
};

/**
 * Bir sahibkar üçün dünənki günün xülasəsini hesablayır.
 * Cron daxilində runWithTenant context altında çağırılır.
 */
export async function buildDailySummary(sahibkarId: string): Promise<DailySummary> {
  const now = new Date();
  // Dünənin başlanğıcı və sonu
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() - 1);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  const dateStr = dayStart.toISOString().slice(0, 10);

  return runWithTenant(
    {
      sahibkarId,
      istifadeciId: "00000000-0000-0000-0000-000000000000",
      rolId: 0,
      icazeler: [],
    },
    async () => {
      const [
        sahibkar,
        salesAgg,
        salesByPaymentRaw,
        purchaseAgg,
        returnAgg,
        webhookOrders,
        newCustomers,
        paymentsIn,
        paymentsOut,
        lowStock,
        pendingTasks,
        topProductsRaw,
      ] = await Promise.all([
        prisma.sahibkarlar.findUnique({
          where: { id: sahibkarId },
          select: { ad: true },
        }),
        prisma.satis_sifarisleri.aggregate({
          _count: true,
          _sum: { son_mebleg: true },
          where: {
            sahibkar_id: sahibkarId,
            tarix: { gte: dayStart, lte: dayEnd },
            status: { notIn: ["legv", "qaralama"] },
          },
        }),
        prisma.satis_sifarisleri.groupBy({
          by: ["odenis_nov"],
          where: {
            sahibkar_id: sahibkarId,
            tarix: { gte: dayStart, lte: dayEnd },
            status: { notIn: ["legv", "qaralama"] },
          },
          _sum: { son_mebleg: true },
        }),
        prisma.alis_sifarisleri.aggregate({
          _count: true,
          _sum: { umumi_mebleg: true },
          where: {
            sahibkar_id: sahibkarId,
            tarix: { gte: dayStart, lte: dayEnd },
            status: { notIn: ["legv", "qaralama"] },
          },
        }),
        prisma.qaytarma_sifarisleri.aggregate({
          _count: true,
          _sum: { umumi_mebleg: true },
          where: {
            sahibkar_id: sahibkarId,
            tarix: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.audit_log.findMany({
          where: {
            sahibkar_id: sahibkarId,
            resurs_nov: "webhook_order",
            yaradildi: { gte: dayStart, lte: dayEnd },
          },
          select: { yeni_data: true },
        }),
        prisma.kontragentler.count({
          where: {
            sahibkar_id: sahibkarId,
            nov: { in: ["musteri", "her_ikisi"] },
            yaradildi: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.finance_operations.aggregate({
          _sum: { meblegh: true },
          where: {
            sahibkar_id: sahibkarId,
            y_n: "daxil",
            tarix: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.finance_operations.aggregate({
          _sum: { meblegh: true },
          where: {
            sahibkar_id: sahibkarId,
            y_n: "xaric",
            tarix: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.mehsullar.count({
          where: {
            sahibkar_id: sahibkarId,
            aktiv: true,
            kritik_stok: { not: null },
            stok_cemi: { lte: prisma.mehsullar.fields.kritik_stok as unknown as number },
          },
        }).catch(() => 0),
        prisma.tapshiriqlar.count({
          where: {
            sahibkar_id: sahibkarId,
            status: { notIn: ["tamamlandi", "legv"] },
          },
        }),
        prisma.$queryRaw<{ ad: string; qty: number; mebleg: number }[]>`
          SELECT m.ad,
                 SUM(ssr.miqdar)::float AS qty,
                 SUM(ssr.miqdar * ssr.vahid_qiymet)::float AS mebleg
            FROM satis_sifaris_satirlari ssr
            JOIN satis_sifarisleri ss ON ss.id = ssr.sifaris_id
            JOIN mehsullar m ON m.id = ssr.mehsul_id
           WHERE ssr.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix BETWEEN ${dayStart} AND ${dayEnd}
             AND ss.status NOT IN ('legv', 'qaralama')
           GROUP BY m.id, m.ad
           ORDER BY mebleg DESC
           LIMIT 5
        `.catch(() => [] as { ad: string; qty: number; mebleg: number }[]),
      ]);

      const payByMethod = new Map<string, number>();
      for (const r of salesByPaymentRaw) {
        payByMethod.set(r.odenis_nov ?? "negd", Number(r._sum.son_mebleg ?? 0));
      }

      const inTotal = Number(paymentsIn._sum.meblegh ?? 0);
      const outTotal = Number(paymentsOut._sum.meblegh ?? 0);

      const webhookTotal = webhookOrders.reduce((s, w) => {
        const d = (w.yeni_data ?? {}) as { cem_mebleg?: number };
        return s + Number(d.cem_mebleg ?? 0);
      }, 0);

      return {
        sahibkar_id: sahibkarId,
        sahibkar_ad: sahibkar?.ad ?? null,
        date: dateStr,
        sales: {
          count: salesAgg._count,
          total: Number(salesAgg._sum.son_mebleg ?? 0),
          cash: payByMethod.get("negd") ?? 0,
          card: payByMethod.get("kart") ?? 0,
          bank: payByMethod.get("bank") ?? 0,
          debt: (payByMethod.get("nisye") ?? 0) + (payByMethod.get("borc") ?? 0),
        },
        purchases: {
          count: purchaseAgg._count,
          total: Number(purchaseAgg._sum.umumi_mebleg ?? 0),
        },
        returns: {
          count: returnAgg._count,
          total: Number(returnAgg._sum.umumi_mebleg ?? 0),
        },
        webhooks: {
          count: webhookOrders.length,
          total: webhookTotal,
        },
        new_customers: newCustomers,
        payments: { in_total: inTotal, out_total: outTotal, net: inTotal - outTotal },
        low_stock: lowStock,
        pending_tasks: pendingTasks,
        top_products: topProductsRaw.map((r) => ({
          ad: r.ad,
          qty: Number(r.qty),
          mebleg: Number(r.mebleg),
        })),
      };
    },
  );
}

/** Summary objektindən HTML email yarad. */
export function renderDailySummaryHtml(s: DailySummary): { subject: string; html: string } {
  const fmtAzn = (n: number) => `${n.toFixed(2)} ₼`;
  const fmtDate = (iso: string) => formatDate(iso, { day: "numeric", month: "long", year: "numeric" });
  const subject = `📊 Günlük xülasə — ${fmtDate(s.date)} · Satış ${fmtAzn(s.sales.total)}`;
  const topRows = s.top_products
    .map(
      (p) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${p.ad}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${p.qty.toFixed(0)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${fmtAzn(p.mebleg)}</td></tr>`,
    )
    .join("");

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:680px;padding:24px;background:#f8fafc;color:#0f172a">
  <h1 style="margin:0 0 4px;font-size:24px">📊 Günlük xülasə</h1>
  <p style="margin:0 0 24px;color:#64748b;font-size:14px">${s.sahibkar_ad ?? ""} · ${fmtDate(s.date)}</p>

  <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;margin-bottom:16px">
    <tr style="background:linear-gradient(135deg,#6366f1,#a855f7);color:white">
      <td style="padding:16px;font-size:14px;font-weight:600">SATIŞ</td>
      <td style="padding:16px;text-align:right;font-size:20px;font-weight:700">${fmtAzn(s.sales.total)}</td>
    </tr>
    <tr><td style="padding:8px 16px;color:#64748b">Sifariş sayı</td><td style="padding:8px 16px;text-align:right;font-weight:600">${s.sales.count}</td></tr>
    <tr><td style="padding:8px 16px;color:#64748b">Nağd</td><td style="padding:8px 16px;text-align:right">${fmtAzn(s.sales.cash)}</td></tr>
    <tr><td style="padding:8px 16px;color:#64748b">Kart</td><td style="padding:8px 16px;text-align:right">${fmtAzn(s.sales.card)}</td></tr>
    <tr><td style="padding:8px 16px;color:#64748b">Bank</td><td style="padding:8px 16px;text-align:right">${fmtAzn(s.sales.bank)}</td></tr>
    <tr><td style="padding:8px 16px;color:#dc2626">Nisyə/borc</td><td style="padding:8px 16px;text-align:right;color:#dc2626">${fmtAzn(s.sales.debt)}</td></tr>
  </table>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:white;padding:14px;border-radius:8px">
      <div style="color:#64748b;font-size:12px;text-transform:uppercase">Alış</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px">${fmtAzn(s.purchases.total)}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:2px">${s.purchases.count} sifariş</div>
    </div>
    <div style="background:white;padding:14px;border-radius:8px">
      <div style="color:#64748b;font-size:12px;text-transform:uppercase">Qaytarma</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;color:${s.returns.count > 0 ? "#dc2626" : "#0f172a"}">${fmtAzn(s.returns.total)}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:2px">${s.returns.count} qaytarma</div>
    </div>
    <div style="background:white;padding:14px;border-radius:8px">
      <div style="color:#64748b;font-size:12px;text-transform:uppercase">Marketplace</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px">${fmtAzn(s.webhooks.total)}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:2px">${s.webhooks.count} webhook sifariş</div>
    </div>
    <div style="background:white;padding:14px;border-radius:8px">
      <div style="color:#64748b;font-size:12px;text-transform:uppercase">Yeni müştəri</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px">${s.new_customers}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:2px">qeydiyyat</div>
    </div>
    <div style="background:white;padding:14px;border-radius:8px">
      <div style="color:#64748b;font-size:12px;text-transform:uppercase">Net pul axını</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;color:${s.payments.net >= 0 ? "#059669" : "#dc2626"}">${fmtAzn(s.payments.net)}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:2px">+${fmtAzn(s.payments.in_total)} / −${fmtAzn(s.payments.out_total)}</div>
    </div>
    <div style="background:white;padding:14px;border-radius:8px">
      <div style="color:#64748b;font-size:12px;text-transform:uppercase">Diqqət</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px">${s.low_stock} az stok</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:2px">${s.pending_tasks} açıq tapşırıq</div>
    </div>
  </div>

  ${
    s.top_products.length > 0
      ? `
  <div style="background:white;padding:16px;border-radius:8px;margin-bottom:16px">
    <h3 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;color:#64748b">Top satılanlar</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:2px solid #e2e8f0"><th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:600">Məhsul</th><th style="padding:6px 8px;text-align:right;color:#64748b;font-weight:600">Miqdar</th><th style="padding:6px 8px;text-align:right;color:#64748b;font-weight:600">Məbləğ</th></tr></thead>
      <tbody>${topRows}</tbody>
    </table>
  </div>`
      : ""
  }

  <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px">
    Bu email avtomatik göndərilib · <a href="${process.env.NEXTAUTH_URL ?? ""}/ayarlar/email" style="color:#6366f1">söndürmək</a>
  </p>
</div>`;

  return { subject, html };
}
