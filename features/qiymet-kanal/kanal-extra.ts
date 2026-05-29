import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const QRUP = "kanal_extra";

export type KanalExtra = {
  stok_buffer: number;        // satıla bilən stok = max(0, stok_cemi − buffer)
  rate_limit_per_min: number; // 0 = limit yox
  outbound_url: string | null;     // platformanın stok update endpoint-i (opsiyonel)
  outbound_secret: string | null;  // HMAC üçün shared secret (platform tərəfində eynisi)
  auto_push_on_sale: boolean;      // POS satış olduqda avtomatik bu kanala push
};

const DEFAULT: KanalExtra = {
  stok_buffer: 0,
  rate_limit_per_min: 0,
  outbound_url: null,
  outbound_secret: null,
  auto_push_on_sale: false,
};

/** Cari sahibkar üçün bütün kanalların əlavə ayarlarını qaytarır. */
export async function getAllKanalExtra(): Promise<Record<string, KanalExtra>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: QRUP },
      select: { acar: true, deyer: true },
    });
    const out: Record<string, KanalExtra> = {};
    for (const r of rows) {
      try {
        out[r.acar] = { ...DEFAULT, ...(JSON.parse(r.deyer ?? "{}") as Partial<KanalExtra>) };
      } catch {}
    }
    return out;
  });
}

/** SERVER-ONLY (API endpoint daxili) — bir kanalın əlavə ayarlarını gətirir. */
export async function getKanalExtraServer(sahibkarId: string, kanal: string): Promise<KanalExtra> {
  const row = await prisma.ayarlar.findUnique({
    where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: QRUP, acar: kanal } },
    select: { deyer: true },
  });
  if (!row?.deyer) return { ...DEFAULT };
  try {
    return { ...DEFAULT, ...(JSON.parse(row.deyer) as Partial<KanalExtra>) };
  } catch {
    return { ...DEFAULT };
  }
}
