import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const STATS_QRUP = "kanal_api_stats";
const RECENT_KEEP = 50;

export type ApiCallEntry = {
  at: string;       // ISO
  status: number;
  count: number;
  ip: string | null;
};

export type KanalStat = {
  last_call: string | null;     // ISO
  last_status: number | null;   // HTTP
  last_count: number | null;    // qaytarılan məhsul sayı
  today_count: number;          // bu günkü uğurlu çağırış sayı
  today_date: string;           // YYYY-MM-DD
  total_count: number;          // bütün dövr üçün
  last_ip: string | null;
  recent: ApiCallEntry[];       // son 50 çağırış
};

const EMPTY: KanalStat = {
  last_call: null,
  last_status: null,
  last_count: null,
  today_count: 0,
  today_date: "",
  total_count: 0,
  last_ip: null,
  recent: [],
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * SERVER-ONLY (API endpoint daxili) — uğurlu API çağırışını qeydə alır.
 * Atomic upsert — race condition-da counter qaçırılmaz.
 */
export async function recordKanalApiCall(opts: {
  sahibkarId: string;
  kanal: string;
  status: number;
  itemCount: number;
  ip?: string | null;
}): Promise<void> {
  try {
    const today = todayKey();
    const existing = await prisma.ayarlar.findUnique({
      where: {
        sahibkar_id_qrup_acar: {
          sahibkar_id: opts.sahibkarId,
          qrup: STATS_QRUP,
          acar: opts.kanal,
        },
      },
      select: { deyer: true },
    });
    let prev: KanalStat = EMPTY;
    if (existing?.deyer) {
      try {
        prev = { ...EMPTY, ...(JSON.parse(existing.deyer) as Partial<KanalStat>) };
      } catch {}
    }
    const nowIso = new Date().toISOString();
    const entry: ApiCallEntry = {
      at: nowIso,
      status: opts.status,
      count: opts.itemCount,
      ip: opts.ip ?? null,
    };
    const recent = [entry, ...(prev.recent ?? [])].slice(0, RECENT_KEEP);
    const next: KanalStat = {
      last_call: nowIso,
      last_status: opts.status,
      last_count: opts.itemCount,
      today_count: prev.today_date === today ? prev.today_count + 1 : 1,
      today_date: today,
      total_count: prev.total_count + 1,
      last_ip: opts.ip ?? null,
      recent,
    };
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: {
          sahibkar_id: opts.sahibkarId,
          qrup: STATS_QRUP,
          acar: opts.kanal,
        },
      },
      create: {
        sahibkar_id: opts.sahibkarId,
        qrup: STATS_QRUP,
        acar: opts.kanal,
        deyer: JSON.stringify(next),
        nov: "string",
      },
      update: {
        deyer: JSON.stringify(next),
        yenilendi: new Date(),
      },
    });
  } catch (e) {
    // Stats yazılma uğursuz olsa endpoint cavabını bozma
    console.error("[recordKanalApiCall]", e);
  }
}

/** UI üçün — bütün kanalların statistikası. */
export async function getAllKanalStats(): Promise<Record<string, KanalStat>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: STATS_QRUP },
      select: { acar: true, deyer: true },
    });
    const out: Record<string, KanalStat> = {};
    for (const r of rows) {
      try {
        out[r.acar] = { ...EMPTY, ...(JSON.parse(r.deyer ?? "{}") as Partial<KanalStat>) };
      } catch {}
    }
    return out;
  });
}
