"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

/**
 * Confidential contacts (suppliers/buyers) that must NOT appear in /elaqe.
 * Stored on top of the existing `sahibkar_qeyd` table with `reng="gizli_elaqe"`
 * so no schema migration is required. The `metn` column holds a JSON blob.
 */

const MARKER = "gizli_elaqe";

export type GizliElaqe = {
  id: number;
  ad: string;
  nov: "techizatci" | "alici" | "her_ikisi" | "diger";
  telefon: string | null;
  email: string | null;
  sirket: string | null;
  olke: string | null;
  unvan: string | null;
  qeyd: string | null;
  link_nov: string | null;
  link_id: string | null;
  link_label: string | null;
  yaradildi: Date | null;
};

const Schema = z.object({
  ad: z.string().trim().min(1, "Ad mütləqdir").max(200),
  nov: z.enum(["techizatci", "alici", "her_ikisi", "diger"]).default("techizatci"),
  telefon: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().max(150).optional().or(z.literal("")),
  sirket: z.string().trim().max(200).optional().or(z.literal("")),
  olke: z.string().trim().min(1, "Ölkə məcburidir — filter üçün istifadə olunur").max(50),
  unvan: z.string().trim().max(500).optional().or(z.literal("")),
  qeyd: z.string().trim().max(2000).optional().or(z.literal("")),
  link_nov: z.string().trim().max(20).optional().or(z.literal("")),
  link_id: z.string().trim().max(100).optional().or(z.literal("")),
  link_label: z.string().trim().max(200).optional().or(z.literal("")),
});

type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

/**
 * Daxili saxlama formatı — `metn` JSON-da olan sahələr (link sahələri
 * birbaşa sahibkar_qeyd-ın `link_*` sütunlarına yazılır, JSON-da yox).
 */
type StoredPayload = Omit<GizliElaqe, "id" | "yaradildi" | "link_nov" | "link_id" | "link_label">;

function buildStoredPayload(input: z.infer<typeof Schema>): StoredPayload {
  return {
    ad: input.ad,
    nov: input.nov,
    telefon: input.telefon || null,
    email: input.email || null,
    sirket: input.sirket || null,
    olke: input.olke || null,
    unvan: input.unvan || null,
    qeyd: input.qeyd || null,
  };
}

export async function createGizliElaqe(input: FormData): Promise<ActionResult> {
  const parsed = Schema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Yanlış məlumat" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId, rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "Yalnız sahibkar əlavə edə bilər" };
    const payload = buildStoredPayload(parsed.data);
    const d = parsed.data;
    const linkActive = !!(d.link_nov?.trim() && d.link_id?.trim());
    const row = await prisma.sahibkar_qeyd.create({
      data: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        basliq: payload.ad,
        metn: JSON.stringify(payload),
        reng: MARKER,
        link_nov: linkActive ? d.link_nov!.trim() : null,
        link_id: linkActive ? d.link_id!.trim() : null,
        link_label: linkActive ? (d.link_label?.trim() || null) : null,
      },
      select: { id: true },
    });
    revalidatePath("/sahibkar/gizli-elaqe");
    return { ok: true, id: row.id };
  });
}

export async function deleteGizliElaqe(id: number): Promise<ActionResult> {
  return withTenant(async () => {
    const { rolAd } = requireTenant();
    if (rolAd !== "sahibkar") return { ok: false, error: "İcazə yoxdur" };
    await prisma.sahibkar_qeyd.delete({ where: { id } });
    revalidatePath("/sahibkar/gizli-elaqe");
    return { ok: true };
  });
}

export async function listGizliElaqe(): Promise<GizliElaqe[]> {
  return withTenant(async () => {
    const rows = await prisma.sahibkar_qeyd.findMany({
      where: { reng: MARKER },
      orderBy: { yaradildi: "desc" },
      select: { id: true, basliq: true, metn: true, yaradildi: true, link_nov: true, link_id: true, link_label: true },
    });
    return rows.map((r) => {
      let parsed: StoredPayload = {
        ad: r.basliq ?? "—",
        nov: "techizatci",
        telefon: null,
        email: null,
        sirket: null,
        olke: null,
        unvan: null,
        qeyd: null,
      };
      try {
        if (r.metn) {
          const obj = JSON.parse(r.metn);
          if (obj && typeof obj === "object") parsed = { ...parsed, ...obj };
        }
      } catch {
        /* corrupt JSON — keep default */
      }
      return {
        id: r.id,
        yaradildi: r.yaradildi,
        link_nov: r.link_nov,
        link_id: r.link_id,
        link_label: r.link_label,
        ...parsed,
      };
    });
  });
}
