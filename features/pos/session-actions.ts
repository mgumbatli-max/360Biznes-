"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { audit } from "@/lib/audit/log";

const OpenSchema = z.object({
  ad: z.string().min(1).max(100),
  filial_id: z.coerce.number().int().positive().optional(),
  acilis_qaligi: z.coerce.number().min(0).default(0),
  /** Hansı maliye hesabı (nağd kassa) ilə bağlıdır. Seçilməsə default nağd hesab */
  maliye_hesab_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

const CloseSchema = z.object({
  hesablanan_qaliq: z.coerce.number().min(0),
  qeyd: z.string().max(2000).optional(),
});

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function openKassa(input: FormData | z.infer<typeof OpenSchema>): Promise<ActionResult<{ id: string }>> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = OpenSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Forma yanlışdır: ${issue?.path.join(".") || "?"} — ${issue?.message || "naməlum"}` };
  }

  const { requireTicaretActionPerm } = await import("@/features/ticaret/access-guard");
  const permCheck = await requireTicaretActionPerm(["pos.session_open", "pos.satis"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  try {
    return await withTenant(async () => {
      const { istifadeciId, sahibkarId } = requireTenant();

      // QA-audit: "artıq açıq kassa var" yoxlaması atomik deyildi (nə tx, nə lock) → eyni kassirin
      // paralel/double-click açılışı İKİ eyni vaxtlı açıq sessiya yaradırdı. İndi advisory xact-lock
      // (kassir açarı üzrə) + yoxlama+create tx daxilində → serializasiya olunur.
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${istifadeciId + ":openkassa"}))`;
        const existing = await tx.kassalar.findFirst({
          where: { status: "acig", acan_id: istifadeciId },
        });
        if (existing) {
          return { ok: false as const, error: "Sizdə artıq açıq kassa var. Əvvəl bağlayın." };
        }

        // Default maliye hesabı — istifadəçi seçməyibsə ilk aktiv nağd hesab
        let maliyeHesabId = parsed.data.maliye_hesab_id ?? null;
        if (!maliyeHesabId) {
          const defHesab = await tx.maliye_hesablari.findFirst({
            where: { sahibkar_id: sahibkarId, aktiv: true, nov: "negd" },
            orderBy: { yaradildi: "asc" },
            select: { id: true },
          });
          maliyeHesabId = defHesab?.id ?? null;
        }

        const created = await tx.kassalar.create({
          data: {
            sahibkar_id: sahibkarId,
            ad: parsed.data.ad,
            filial_id: parsed.data.filial_id ?? null,
            acan_id: istifadeciId,
            acilis_qaligi: parsed.data.acilis_qaligi,
            status: "acig",
            maliye_hesab_id: maliyeHesabId,
          },
        });
        await audit("yarat", "kassa", created.id, {
          yeni_data: {
            ad: parsed.data.ad,
            acilis_qaligi: parsed.data.acilis_qaligi,
            filial_id: parsed.data.filial_id ?? null,
          },
          sebeb: "Kassa açıldı",
        });
        revalidatePath("/pos");
        return { ok: true as const, data: { id: created.id } };
      });
    });
  } catch (e) {
    const err = e as Error & { code?: string; meta?: unknown };
    console.error("[openKassa] failed", {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
    });
    const detail =
      err.code === "P2003"
        ? "Bağlı qeyd (FK) tapılmadı (sahibkar/filial)."
        : err.code === "P2002"
          ? "Eyni kassa artıq mövcuddur."
          : err.message;
    return { ok: false, error: `Kassa açıla bilmədi: ${detail}` };
  }
}

export async function closeKassa(
  kassaId: string,
  input: FormData | z.infer<typeof CloseSchema>
): Promise<ActionResult> {
  const raw = input instanceof FormData ? Object.fromEntries(input.entries()) : input;
  const parsed = CloseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };

  const { requireTicaretActionPerm } = await import("@/features/ticaret/access-guard");
  const permCheck = await requireTicaretActionPerm(["pos.session_close", "pos.satis"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    // QA-audit: bağlanış oxu/aqreqasiya/update TX-siz + lock-suz idi → eyni anda commit olan nağd
    // satış gün-sonu gözlənilən balansdan İSTİSNA olub fantom fərq (fark) yaradırdı. İndi kassa
    // sətri FOR UPDATE ilə kilidlənir + hər şey tx daxilində → paralel satış serializasiya olunur.
    const result = await prisma.$transaction(async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ id: string; acan_id: string | null; acilis_qaligi: unknown }>>`
        SELECT id, acan_id, acilis_qaligi FROM kassalar WHERE id = ${kassaId}::uuid AND status = 'acig' FOR UPDATE`;
      const kassa = lockRows[0];
      if (!kassa) return { ok: false as const, error: "Açıq kassa tapılmadı" };
      if (kassa.acan_id !== istifadeciId) {
        return { ok: false as const, error: "Bu kassanı başqa istifadəçi açıb" };
      }

      // Compute expected balance: opening + sum of cash inflow - sum of cash outflow
      const cashAgg = await tx.kassa_emeliyyatlari.aggregate({
        where: { kassa_id: kassa.id, odenis_nov: "negd" },
        _sum: { mebleg: true },
      });
      const negdNet = Number(cashAgg._sum.mebleg ?? 0);
      const expected = Number(kassa.acilis_qaligi ?? 0) + negdNet;

      await tx.kassalar.update({
        where: { id: kassa.id },
        data: {
          status: "bagli",
          baglayan_id: istifadeciId,
          baglanis_tarixi: new Date(),
          hesablanan_qaliq: expected,
          baglanis_qaligi: parsed.data.hesablanan_qaliq,
          fark: parsed.data.hesablanan_qaliq - expected,
          qeyd: parsed.data.qeyd ?? null,
        },
      });
      return { ok: true as const, kassaId: kassa.id, expected, acilis: Number(kassa.acilis_qaligi ?? 0) };
    });
    if (!result.ok) return result;
    const { expected } = result;
    await audit("yenile", "kassa", result.kassaId, {
      evvelki_data: { acilis_qaligi: result.acilis, status: "acig" },
      yeni_data: {
        status: "bagli",
        hesablanan_qaliq: expected,
        baglanis_qaligi: parsed.data.hesablanan_qaliq,
        fark: parsed.data.hesablanan_qaliq - expected,
      },
      sebeb: "Kassa bağlandı (gün sonu)",
    });
    revalidatePath("/pos");
    return { ok: true as const };
  });
}
