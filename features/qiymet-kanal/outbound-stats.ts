import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

const STATS_QRUP = "kanal_outbound_stats";
const RECENT_KEEP = 50;

export type OutboundEntry = {
  at: string;          // ISO
  status: number;      // 0 = network exception
  sent: number;        // göndərilən item sayı
  ms: number;          // response müddəti
  error: string | null;
};

export type OutboundStat = {
  last_push: string | null;
  last_status: number | null;
  last_sent: number | null;
  total_pushes: number;
  total_success: number;
  total_fail: number;
  recent: OutboundEntry[];
};

const EMPTY: OutboundStat = {
  last_push: null,
  last_status: null,
  last_sent: null,
  total_pushes: 0,
  total_success: 0,
  total_fail: 0,
  recent: [],
};

export async function recordOutboundPush(opts: {
  sahibkarId: string;
  kanal: string;
  status: number;
  sent: number;
  ms: number;
  error?: string | null;
}): Promise<void> {
  try {
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
    let prev: OutboundStat = EMPTY;
    if (existing?.deyer) {
      try {
        prev = { ...EMPTY, ...(JSON.parse(existing.deyer) as Partial<OutboundStat>) };
      } catch {}
    }
    const success = opts.status >= 200 && opts.status < 300;
    const entry: OutboundEntry = {
      at: new Date().toISOString(),
      status: opts.status,
      sent: opts.sent,
      ms: opts.ms,
      error: opts.error ?? null,
    };
    const recent = [entry, ...(prev.recent ?? [])].slice(0, RECENT_KEEP);
    const next: OutboundStat = {
      last_push: entry.at,
      last_status: opts.status,
      last_sent: opts.sent,
      total_pushes: prev.total_pushes + 1,
      total_success: prev.total_success + (success ? 1 : 0),
      total_fail: prev.total_fail + (success ? 0 : 1),
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
      update: { deyer: JSON.stringify(next), yenilendi: new Date() },
    });
  } catch (e) {
    console.error("[recordOutboundPush]", e);
  }
}

export async function getAllOutboundStats(): Promise<Record<string, OutboundStat>> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rows = await prisma.ayarlar.findMany({
      where: { sahibkar_id: sahibkarId, qrup: STATS_QRUP },
      select: { acar: true, deyer: true },
    });
    const out: Record<string, OutboundStat> = {};
    for (const r of rows) {
      try {
        out[r.acar] = { ...EMPTY, ...(JSON.parse(r.deyer ?? "{}") as Partial<OutboundStat>) };
      } catch {}
    }
    return out;
  });
}
