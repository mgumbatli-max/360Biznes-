"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { requireElaqeActionPerm } from "./access-guard";

/**
 * Auto-tag generator (cron-əsaslı, manual triggerable).
 *
 * Tag-lar:
 *   - "VIP"     → son 90 gündə 10+ satış olub
 *   - "Yatmış"  → 90+ gündür son satış yoxdur (heç olmayıb da)
 *   - "Borclu"  → borc > 0
 *
 * Vəziyyət ödənilmirsə, tag silinir (audit-li).
 */

const AUTO_TAGS = ["VIP", "Yatmış", "Borclu"] as const;
type AutoTag = (typeof AUTO_TAGS)[number];

const TAG_META: Record<AutoTag, { reng: string; emoji: string }> = {
  VIP: { reng: "amber", emoji: "⭐" },
  Yatmış: { reng: "rose", emoji: "💤" },
  Borclu: { reng: "red", emoji: "💳" },
};

export type AutoTagResult = {
  ok: true;
  scanned: number;
  added: number;
  removed: number;
  by_tag: Record<AutoTag, { added: number; removed: number }>;
};

export async function runAutoTagUpdate(): Promise<AutoTagResult | { ok: false; error: string }> {
  const permCheck = await requireElaqeActionPerm("musteri.duzelt");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Ensure tags exist
      const tagIds: Record<AutoTag, number> = {} as Record<AutoTag, number>;
      for (const ad of AUTO_TAGS) {
        const meta = TAG_META[ad];
        const t = await prisma.contact_tags.upsert({
          where: { sahibkar_id_ad: { sahibkar_id: sahibkarId, ad } },
          update: { reng: meta.reng, emoji: meta.emoji },
          create: { sahibkar_id: sahibkarId, ad, reng: meta.reng, emoji: meta.emoji },
        });
        tagIds[ad] = t.id;
      }

      const ninetyDays = new Date();
      ninetyDays.setDate(ninetyDays.getDate() - 90);

      // Compute VIP set: kontragentlər son 90 gündə 10+ satış sayı
      const vipRows = await prisma.$queryRaw<{ musteri_id: string }[]>`
        SELECT musteri_id
          FROM satis_sifarisleri
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND status <> 'legv'
           AND musteri_id IS NOT NULL
           AND tarix >= ${ninetyDays}
         GROUP BY musteri_id
        HAVING COUNT(*) >= 10
      `.catch(() => []);
      const vipSet = new Set(vipRows.map((r) => r.musteri_id));

      // Bütün aktiv müştəriləri çək — defense-in-depth: sahibkar_id explicit
      const contacts = await prisma.kontragentler.findMany({
        where: { aktiv: true, sahibkar_id: sahibkarId },
        select: { id: true, borc: true },
      });

      // Hər müştəri üçün son satış tarixi
      const ids = contacts.map((c) => c.id);
      const lastSales = new Map<string, Date>();
      if (ids.length > 0) {
        const ls = await prisma.$queryRaw<{ musteri_id: string; tarix: Date }[]>`
          SELECT DISTINCT ON (musteri_id) musteri_id, tarix
            FROM satis_sifarisleri
           WHERE sahibkar_id = ${sahibkarId}::uuid
             AND status <> 'legv'
             AND musteri_id = ANY(${ids}::uuid[])
           ORDER BY musteri_id, tarix DESC
        `.catch(() => [] as { musteri_id: string; tarix: Date }[]);
        for (const r of ls) lastSales.set(r.musteri_id, r.tarix);
      }

      // Mövcud auto-tag link-ləri
      const existingLinks = await prisma.contact_tag_links.findMany({
        where: { tag_id: { in: Object.values(tagIds) } },
        select: { kontragent_id: true, tag_id: true },
      });
      const linkSet = new Set(existingLinks.map((l) => `${l.kontragent_id}|${l.tag_id}`));

      const by_tag: Record<AutoTag, { added: number; removed: number }> = {
        VIP: { added: 0, removed: 0 },
        Yatmış: { added: 0, removed: 0 },
        Borclu: { added: 0, removed: 0 },
      };

      let added = 0;
      let removed = 0;

      for (const c of contacts) {
        const isVip = vipSet.has(c.id);
        const ls = lastSales.get(c.id);
        const isYatmis = !ls || ls.getTime() < ninetyDays.getTime();
        const isBorclu = Number(c.borc ?? 0) > 0;

        const wantedFlags: Record<AutoTag, boolean> = {
          VIP: isVip,
          Yatmış: isYatmis,
          Borclu: isBorclu,
        };

        for (const tag of AUTO_TAGS) {
          const tagId = tagIds[tag];
          const key = `${c.id}|${tagId}`;
          const has = linkSet.has(key);
          const want = wantedFlags[tag];

          if (want && !has) {
            try {
              await prisma.contact_tag_links.upsert({
                where: { kontragent_id_tag_id: { kontragent_id: c.id, tag_id: tagId } },
                update: {},
                create: { kontragent_id: c.id, tag_id: tagId },
              });
              by_tag[tag].added++;
              added++;
            } catch {
              /* skip */
            }
          } else if (!want && has) {
            try {
              await prisma.contact_tag_links.deleteMany({
                where: { kontragent_id: c.id, tag_id: tagId },
              });
              by_tag[tag].removed++;
              removed++;
            } catch {
              /* skip */
            }
          }
        }
      }

      // Audit log — outbox-safe
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "auto_tag",
        resurs_nov: "contact_tags",
        yeni_data: {
          scanned: contacts.length,
          added,
          removed,
          by_tag,
        } as unknown as object,
        status: "ugur",
      });

      revalidatePath("/elaqe");
      revalidatePath("/elaqe/musteriler");
      revalidatePath("/elaqe/hesabat");
      try {
        revalidateTag(`elaqe:${sahibkarId}`, "max");
        revalidateTag(`dashboard:${sahibkarId}`, "max");
      } catch { /* non-fatal */ }

      return {
        ok: true,
        scanned: contacts.length,
        added,
        removed,
        by_tag,
      };
    } catch (e) {
      console.error("[runAutoTagUpdate]", e);
      return { ok: false, error: "Auto-tag yenilənmədi" };
    }
  });
}
