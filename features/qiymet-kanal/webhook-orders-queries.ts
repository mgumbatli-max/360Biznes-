import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type WebhookOrderItem = {
  sku: string | null;
  resolved_id: string | null;
  miqdar: number;
  azaldilan: number;
  stok_catismir: boolean;
};

export type WebhookOrder = {
  audit_id: bigint;
  kanal: string;
  external_id: string;
  at: string;
  musteri_ad: string | null;
  musteri_telefon: string | null;
  cem_mebleg: number;
  valyuta: string;
  status: string;
  items: WebhookOrderItem[];
  short_count: number;
};

export type WebhookOrdersResult = {
  items: WebhookOrder[];
  total: number;
};

/** Audit log-dan webhook_order qeydlərini oxuyub user-friendly forma qaytarır. */
export async function getWebhookOrders(opts?: {
  kanal?: string | null;
  limit?: number;
  offset?: number;
}): Promise<WebhookOrdersResult> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const limit = Math.min(500, Math.max(1, opts?.limit ?? 50));
    const offset = Math.max(0, opts?.offset ?? 0);

    const where = {
      sahibkar_id: sahibkarId,
      resurs_nov: "webhook_order",
      ...(opts?.kanal ? { resurs_id: { startsWith: `${opts.kanal}:` } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.audit_log.findMany({
        where,
        orderBy: { yaradildi: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          yaradildi: true,
          resurs_id: true,
          yeni_data: true,
        },
      }),
      prisma.audit_log.count({ where }),
    ]);

    const items: WebhookOrder[] = rows.map((r) => {
      const d = (r.yeni_data ?? {}) as Record<string, unknown>;
      const items = Array.isArray(d.items) ? (d.items as WebhookOrderItem[]) : [];
      const [kanal, external_id] = String(r.resurs_id ?? "").split(":");
      const musteri = (d.musteri ?? null) as { ad?: string; telefon?: string } | null;
      return {
        audit_id: r.id,
        kanal: kanal ?? d.kanal as string ?? "",
        external_id: external_id ?? String(d.external_id ?? ""),
        at: (r.yaradildi ?? new Date()).toISOString(),
        musteri_ad: musteri?.ad ?? null,
        musteri_telefon: musteri?.telefon ?? null,
        cem_mebleg: Number(d.cem_mebleg ?? 0),
        valyuta: String(d.valyuta ?? "AZN"),
        status: String(d.status ?? "yeni"),
        items,
        short_count: items.filter((i) => i.stok_catismir).length,
      };
    });

    return { items, total };
  });
}
