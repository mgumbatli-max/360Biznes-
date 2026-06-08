"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";
import { getActiveFeatures, setActiveFeatures } from "./state";
import { getFeatureById, LAB_FEATURES, type LabFeature } from "./catalog";
import { requireLabActionPerm, bustLabCache } from "./access-guard";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Sanitize ID-i — yalnız catalog-da olan ID-lər keçir. */
function isValidId(id: string): boolean {
  return !!LAB_FEATURES.find((f) => f.id === id);
}

/**
 * Tenant whitelist — sahibkar tərəfindən bloklanmış feature ID-lər.
 * `ayarlar` qrup="lab_whitelist", acar="blocked", deyer=JSON array.
 */
async function getBlockedFeatures(sahibkarId: string): Promise<Set<string>> {
  try {
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: "lab_whitelist", acar: "blocked" },
      select: { deyer: true },
    });
    if (!row?.deyer) return new Set();
    const parsed = JSON.parse(row.deyer);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

/** Toggle a lab feature on/off for the current user. */
export async function toggleLabFeature(id: string): Promise<{ ok: boolean; active: boolean; error?: string }> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, active: false, error: permCheck.error };
  if (!isValidId(id)) return { ok: false, active: false, error: "Funksiya tapılmadı" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    // Tenant whitelist yoxlanması — sahibkar həmin feature-ı bloklayıbsa
    const blocked = await getBlockedFeatures(sahibkarId);
    if (blocked.has(id)) {
      return { ok: false, active: false, error: "Bu Lab funksiyası tenant səviyyəsində bloklanıb" };
    }

    const feature = getFeatureById(id) as LabFeature;
    const current = await getActiveFeatures();
    const isActive = current.includes(id);
    const next = isActive ? current.filter((x) => x !== id) : [...current, id];
    await setActiveFeatures(next);

    revalidatePath("/360-lab");
    revalidatePath(`/360-lab/${id}`);
    bustLabCache();
    await audit(isActive ? "deaktivlesh" : "aktivlesh", "lab_feature", id, {
      yeni_data: { feature_id: id, ad: feature.ad, status: feature.status },
      sebeb: `Lab feature ${isActive ? "söndürüldü" : "aktivləşdirildi"}: ${feature.ad}`,
    });
    return { ok: true, active: !isActive };
  });
}

/** Disable all activated lab features at once. */
export async function deactivateAllLabFeatures(): Promise<{ ok: boolean; count?: number }> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false };
  return withTenant(async () => {
    const before = await getActiveFeatures();
    if (before.length === 0) return { ok: true, count: 0 };
    await setActiveFeatures([]);
    revalidatePath("/360-lab");
    bustLabCache();
    await audit("toplu_deaktivlesh", "lab_feature", null, {
      yeni_data: { silinen_sayi: before.length, idler: before },
      sebeb: "Bütün Lab funksiyaları söndürüldü",
    });
    return { ok: true, count: before.length };
  });
}

// ============================================================
// YENİ FUNKSIONALLIQ
// ============================================================

/**
 * 1) Bulk toggle — bir neçə feature-ı eyni anda aktiv/passiv.
 */
export async function bulkToggleLabFeatures(
  ids: string[],
  active: boolean,
): Promise<ActionResult<{ updated: number; skipped: number }>> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Seçim yoxdur" };
  if (ids.length > 50) return { ok: false, error: "Bir dəfəyə 50-dən çox feature ola bilməz" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const blocked = await getBlockedFeatures(sahibkarId);
    const valid = ids.filter((id) => isValidId(id) && !blocked.has(id));
    const skipped = ids.length - valid.length;

    const current = new Set(await getActiveFeatures());
    for (const id of valid) {
      if (active) current.add(id);
      else current.delete(id);
    }
    await setActiveFeatures(Array.from(current));

    revalidatePath("/360-lab");
    bustLabCache();
    await audit("bulk_toggle", "lab_feature", null, {
      yeni_data: { updated: valid.length, skipped, active, idler: valid },
      sebeb: `Bulk lab toggle: ${valid.length} aktiv=${active}`,
    });
    return { ok: true, data: { updated: valid.length, skipped } };
  });
}

/**
 * 2) Feature-ə rating ver (1-5 ulduz + ixtiyari comment).
 * Hər istifadəçi bir feature-ə bir rating verə bilər (yenisi köhnəni əvəz edir).
 */
export type RateInput = {
  feature_id: string;
  score: number; // 1-5
  comment?: string;
};

export async function rateLabFeature(input: RateInput): Promise<ActionResult> {
  const permCheck = await requireLabActionPerm(["lab.rate", "lab.view"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!isValidId(input.feature_id)) return { ok: false, error: "Funksiya tapılmadı" };
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    return { ok: false, error: "Reytinq 1-5 aralığında tam ədəd olmalıdır" };
  }
  if (input.comment && input.comment.length > 500) {
    return { ok: false, error: "Şərh 500 simvoldan uzun ola bilməz" };
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const acar = `${input.feature_id}:${istifadeciId}`;
    const deyer = JSON.stringify({
      score: input.score,
      comment: input.comment?.trim() || null,
      tarix: new Date().toISOString(),
    });
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "lab_rating", acar },
      },
      create: { sahibkar_id: sahibkarId, qrup: "lab_rating", acar, deyer, nov: "json" },
      update: { deyer, yenilendi: new Date() },
    });
    revalidatePath(`/360-lab/${input.feature_id}`);
    bustLabCache();
    await audit("rating", "lab_feature", input.feature_id, {
      yeni_data: { score: input.score, has_comment: !!input.comment },
      sebeb: `Lab feature reytinq: ${input.score}/5`,
    });
    return { ok: true };
  });
}

/**
 * 3) Feature üçün rating xülasəsi — orta bal, sayı, son şərhlər.
 */
export type FeatureRatingSummary = {
  feature_id: string;
  orta: number;
  say: number;
  paylanma: Record<1 | 2 | 3 | 4 | 5, number>;
  son_serh: { score: number; comment: string | null; tarix: string }[];
};

export async function getLabFeatureRatings(featureId: string): Promise<
  ActionResult<FeatureRatingSummary>
> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!isValidId(featureId)) return { ok: false, error: "Funksiya tapılmadı" };
  return withTenant(async () => {
    try {
      const rows = await prisma.ayarlar.findMany({
        where: {
          qrup: "lab_rating",
          acar: { startsWith: `${featureId}:` },
        },
        select: { deyer: true, yenilendi: true },
      });
      const ratings: { score: number; comment: string | null; tarix: string }[] = [];
      for (const r of rows) {
        if (!r.deyer) continue;
        try {
          const p = JSON.parse(r.deyer);
          if (Number.isInteger(p.score) && p.score >= 1 && p.score <= 5) {
            ratings.push({
              score: p.score,
              comment: p.comment ?? null,
              tarix: p.tarix ?? r.yenilendi?.toISOString() ?? new Date().toISOString(),
            });
          }
        } catch { /* skip bad */ }
      }
      const say = ratings.length;
      const orta = say > 0 ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / say) * 10) / 10 : 0;
      const paylanma: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of ratings) paylanma[r.score as 1 | 2 | 3 | 4 | 5]++;
      const son_serh = ratings
        .filter((r) => r.comment)
        .sort((a, b) => b.tarix.localeCompare(a.tarix))
        .slice(0, 10);
      return {
        ok: true,
        data: { feature_id: featureId, orta, say, paylanma, son_serh },
      };
    } catch (e) {
      console.error("[getLabFeatureRatings]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 4) Tenant whitelist set/get — sahibkar öz şirkəti üçün feature-ları bloklaya bilər.
 */
export async function setLabTenantWhitelist(
  blockedIds: string[],
): Promise<ActionResult<{ blocked: number }>> {
  const permCheck = await requireLabActionPerm("lab.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!Array.isArray(blockedIds)) return { ok: false, error: "Seçim yanlışdır" };
  // Yalnız catalog-da olan ID-lər
  const valid = blockedIds.filter(isValidId).slice(0, LAB_FEATURES.length);
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const deyer = JSON.stringify(valid);
    await prisma.ayarlar.upsert({
      where: {
        sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: "lab_whitelist", acar: "blocked" },
      },
      create: { sahibkar_id: sahibkarId, qrup: "lab_whitelist", acar: "blocked", deyer, nov: "json" },
      update: { deyer, yenilendi: new Date() },
    });
    revalidatePath("/360-lab");
    bustLabCache();
    await audit("whitelist", "lab_tenant", null, {
      yeni_data: { bloklanan_sayi: valid.length, idler: valid },
      sebeb: `Lab whitelist: ${valid.length} feature bloklandı`,
    });
    return { ok: true, data: { blocked: valid.length } };
  });
}

export async function getLabTenantWhitelist(): Promise<ActionResult<{ blocked: string[] }>> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const blocked = await getBlockedFeatures(sahibkarId);
    return { ok: true, data: { blocked: Array.from(blocked) } };
  });
}

/**
 * 5) Tenant səviyyəli istifadə statistikası.
 * Hansı feature-lar ən çox aktiv olunub, top rated.
 */
export type LabUsageStats = {
  total_features: number;
  toplu_aktivlesdirme: number; // bu tenant-da çağırılan toplam toggle (audit-dən)
  top_rated: { id: string; ad: string; orta: number; say: number }[];
  bloklanan_sayi: number;
};

export async function getLabUsageStats(): Promise<ActionResult<LabUsageStats>> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const [aktivlesdirme, ratings, blockedRow] = await Promise.all([
        prisma.audit_log.count({
          where: { resurs_nov: "lab_feature", emeliyyat: { in: ["aktivlesh", "deaktivlesh"] } },
        }),
        prisma.ayarlar.findMany({
          where: { sahibkar_id: sahibkarId, qrup: "lab_rating" },
          select: { acar: true, deyer: true },
        }),
        prisma.ayarlar.findFirst({
          where: { sahibkar_id: sahibkarId, qrup: "lab_whitelist", acar: "blocked" },
          select: { deyer: true },
        }),
      ]);

      // Rating xülasəsi feature başına
      const byFeature = new Map<string, number[]>();
      for (const r of ratings) {
        const [fid] = r.acar.split(":");
        if (!fid || !r.deyer) continue;
        try {
          const p = JSON.parse(r.deyer);
          if (Number.isInteger(p.score) && p.score >= 1 && p.score <= 5) {
            const arr = byFeature.get(fid) ?? [];
            arr.push(p.score);
            byFeature.set(fid, arr);
          }
        } catch { /* skip */ }
      }
      const top_rated = Array.from(byFeature.entries())
        .map(([id, scores]) => {
          const feature = getFeatureById(id);
          return {
            id,
            ad: feature?.ad ?? id,
            orta: Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10,
            say: scores.length,
          };
        })
        .sort((a, b) => b.orta - a.orta || b.say - a.say)
        .slice(0, 10);

      let blocked_say = 0;
      if (blockedRow?.deyer) {
        try {
          const p = JSON.parse(blockedRow.deyer);
          if (Array.isArray(p)) blocked_say = p.length;
        } catch { /* skip */ }
      }

      return {
        ok: true,
        data: {
          total_features: LAB_FEATURES.length,
          toplu_aktivlesdirme: aktivlesdirme,
          top_rated,
          bloklanan_sayi: blocked_say,
        },
      };
    } catch (e) {
      console.error("[getLabUsageStats]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Alınmadı: ${msg}` };
    }
  });
}

/**
 * 6) JSON export — istifadəçinin Lab state-ini debug üçün export et.
 */
export async function exportLabState(): Promise<ActionResult<{ active: string[]; timestamp: string }>> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const active = await getActiveFeatures();
  return {
    ok: true,
    data: { active, timestamp: new Date().toISOString() },
  };
}

/**
 * 7) JSON import — debug/restore üçün state import.
 */
export async function importLabState(
  state: { active: string[] },
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!state || !Array.isArray(state.active)) {
    return { ok: false, error: "Yanlış format" };
  }
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const blocked = await getBlockedFeatures(sahibkarId);
    const valid = state.active.filter((id) => isValidId(id) && !blocked.has(id));
    const skipped = state.active.length - valid.length;
    await setActiveFeatures(valid);
    revalidatePath("/360-lab");
    bustLabCache();
    await audit("idxal", "lab_state", null, {
      yeni_data: { imported: valid.length, skipped },
      sebeb: `Lab state idxal: ${valid.length} feature`,
    });
    return { ok: true, data: { imported: valid.length, skipped } };
  });
}

/**
 * 8) Lab dashboard — sahibkar üçün ümumi bilgi.
 */
export type LabDashboard = {
  total_features: number;
  preview_count: number;
  full_count: number;
  blocked_count: number;
  user_active_count: number;
  top_categories: { id: string; count: number }[];
};

export async function getLabDashboard(): Promise<ActionResult<LabDashboard>> {
  const permCheck = await requireLabActionPerm("lab.view");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const blocked = await getBlockedFeatures(sahibkarId);
    const active = await getActiveFeatures();
    // Kateqoriyalar üzrə say
    const catCount = new Map<string, number>();
    for (const f of LAB_FEATURES) {
      for (const cat of f.kateqoriyalar) {
        catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
      }
    }
    const top_categories = Array.from(catCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }));
    return {
      ok: true,
      data: {
        total_features: LAB_FEATURES.length,
        preview_count: LAB_FEATURES.filter((f) => f.status === "preview").length,
        full_count: LAB_FEATURES.filter((f) => f.status === "tam").length,
        blocked_count: blocked.size,
        user_active_count: active.length,
        top_categories,
      },
    };
  });
}
