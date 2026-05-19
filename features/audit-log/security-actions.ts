"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

type ActionResult = { ok: true } | { ok: false; error: string };

// === IP BLOCKS ===

const IpBlockSchema = z.object({
  ip_adres: z.string().min(3).max(45),
  sebeb: z.string().max(500).optional().or(z.literal("")),
  bitme_tarixi: z.string().optional().or(z.literal("")),
});

export async function createIpBlock(input: FormData): Promise<ActionResult> {
  const parsed = IpBlockSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const existing = await prisma.ip_bloklari.findUnique({
        where: { sahibkar_id_ip_adres: { sahibkar_id: sahibkarId, ip_adres: d.ip_adres.trim() } },
      });
      if (existing && existing.aktiv) return { ok: false, error: "Bu IP artıq bloklanıb" };

      const bitme = d.bitme_tarixi?.trim()
        ? new Date(d.bitme_tarixi)
        : null;
      if (bitme && Number.isNaN(bitme.getTime())) {
        return { ok: false, error: "Bitmə tarixi yanlışdır" };
      }

      if (existing) {
        await prisma.ip_bloklari.update({
          where: { id: existing.id },
          data: {
            aktiv: true,
            sebeb: d.sebeb?.trim() || null,
            bloklayan_id: istifadeciId ?? null,
            bitme_tarixi: bitme,
            yaradildi: new Date(),
          },
        });
      } else {
        await prisma.ip_bloklari.create({
          data: {
            sahibkar_id: sahibkarId,
            ip_adres: d.ip_adres.trim(),
            sebeb: d.sebeb?.trim() || null,
            bloklayan_id: istifadeciId ?? null,
            bitme_tarixi: bitme,
            aktiv: true,
          },
        });
      }
      revalidatePath("/audit-log");
      return { ok: true };
    } catch (e) {
      console.error("[createIpBlock]", e);
      return { ok: false, error: "IP bloklanmadı (format yanlış ola bilər)" };
    }
  });
}

export async function unblockIp(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const block = await prisma.ip_bloklari.findFirst({
        where: { id, sahibkar_id: sahibkarId },
      });
      if (!block) return { ok: false, error: "Tapılmadı" };
      await prisma.ip_bloklari.update({ where: { id }, data: { aktiv: false } });
      revalidatePath("/audit-log");
      return { ok: true };
    } catch (e) {
      console.error("[unblockIp]", e);
      return { ok: false, error: "Açılmadı" };
    }
  });
}

export async function deleteIpBlock(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.ip_bloklari.deleteMany({ where: { id, sahibkar_id: sahibkarId } });
      revalidatePath("/audit-log");
      return { ok: true };
    } catch (e) {
      console.error("[deleteIpBlock]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

// === LOGIN HOURS RULES ===

const LoginRuleSchema = z.object({
  istifadeci_id: z.string().uuid(),
  baslama_saat: z.string().regex(/^\d{1,2}:\d{2}$/),
  bitme_saat: z.string().regex(/^\d{1,2}:\d{2}$/),
  gunler: z.string().regex(/^[1-7](,[1-7])*$/), // "1,2,3,4,5"
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

function timeToDate(s: string): Date {
  const [h, m] = s.split(":").map(Number);
  const d = new Date("1970-01-01T00:00:00Z");
  d.setUTCHours(h, m, 0, 0);
  return d;
}

export async function saveLoginRule(input: FormData): Promise<ActionResult> {
  const parsed = LoginRuleSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
  const d = parsed.data;
  const gunlerArr = d.gunler.split(",").map(Number);
  if (gunlerArr.length === 0) return { ok: false, error: "Ən az 1 gün seçilməlidir" };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      const u = await prisma.istifadeciler.findFirst({
        where: { id: d.istifadeci_id, sahibkar_id: sahibkarId },
      });
      if (!u) return { ok: false, error: "İstifadəçi tapılmadı" };

      await prisma.istifadeci_giris_qaydalari.upsert({
        where: { istifadeci_id: d.istifadeci_id },
        create: {
          sahibkar_id: sahibkarId,
          istifadeci_id: d.istifadeci_id,
          baslama_saat: timeToDate(d.baslama_saat),
          bitme_saat: timeToDate(d.bitme_saat),
          gunler: gunlerArr,
          qeyd: d.qeyd?.trim() || null,
          aktiv: true,
        },
        update: {
          baslama_saat: timeToDate(d.baslama_saat),
          bitme_saat: timeToDate(d.bitme_saat),
          gunler: gunlerArr,
          qeyd: d.qeyd?.trim() || null,
          aktiv: true,
          yenilendi: new Date(),
        },
      });
      revalidatePath("/audit-log");
      return { ok: true };
    } catch (e) {
      console.error("[saveLoginRule]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteLoginRule(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.istifadeci_giris_qaydalari.deleteMany({
        where: { id, sahibkar_id: sahibkarId },
      });
      revalidatePath("/audit-log");
      return { ok: true };
    } catch (e) {
      console.error("[deleteLoginRule]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

export async function toggleLoginRuleActive(input: FormData): Promise<ActionResult> {
  const id = Number(input.get("id"));
  const value = input.get("value") === "true";
  if (!id) return { ok: false, error: "Id yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.istifadeci_giris_qaydalari.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { aktiv: value, yenilendi: new Date() },
      });
      revalidatePath("/audit-log");
      return { ok: true };
    } catch (e) {
      console.error("[toggleLoginRuleActive]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}
