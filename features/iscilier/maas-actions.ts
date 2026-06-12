"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils";
import { audit } from "@/lib/audit/log";
import { requireHrActionPerm, bustHrCache } from "./access-guard";
import { safeUserMessage } from "@/lib/error/user-message";

// Extended prisma client-in transaction client tipini extension-aware şəkildə çıxar.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type Result = { ok: true; count?: number; warning?: string } | { ok: false; error: string };

/**
 * Helper: Maaş ödənişində kassa/bank qalığını azaldıb maliyə əməliyyatı yarat.
 *
 * @returns true uğurlu yazıldısa, false hesab yoxdursa (yumşaq fallback — UX-i pozma)
 */
async function recordMaasFinanceLeg(
  tx: TxClient,
  opts: {
    sahibkarId: string;
    yaradanId: string;
    istifadeciId: string;
    bordroId: number;
    meblegh: number;
    qeyd: string;
    hesabId?: string | null;
  },
): Promise<{ ok: boolean; hesabId?: string }> {
  if (opts.meblegh <= 0) return { ok: true };

  // 1) Hesab seç — manual yoxdursa default kassa, kassa yoxdursa bank
  let hesabId = opts.hesabId ?? null;
  if (!hesabId) {
    const defaultKassa = await tx.maliye_hesablari.findFirst({
      where: { sahibkar_id: opts.sahibkarId, aktiv: true, nov: "negd" }, // QA-orta: kanonik nov "negd" (AccountSchema) — "nagd" heç vaxt tapılmırdı
      orderBy: { yaradildi: "asc" },
      select: { id: true },
    });
    hesabId = defaultKassa?.id ?? null;
    if (!hesabId) {
      const defaultBank = await tx.maliye_hesablari.findFirst({
        where: { sahibkar_id: opts.sahibkarId, aktiv: true, nov: { in: ["bank", "kart"] } },
        orderBy: { yaradildi: "asc" },
        select: { id: true },
      });
      hesabId = defaultBank?.id ?? null;
    }
  }
  if (!hesabId) return { ok: false };

  // 2) Maaş tip-i tap
  const maasType = await tx.finance_operation_types.findUnique({
    where: { kod: "maas" },
    select: { id: true },
  });
  if (!maasType) return { ok: false };

  // 3) Source-of-truth ilə yetərlilik yoxlaması — mənfi balansın qarşısı alınır
  const { checkAccountSufficient, recalculateAccountBalance } = await import("@/lib/balance/account-balance");
  const sufficient = await checkAccountSufficient(hesabId, opts.meblegh, tx);
  if (!sufficient.ok) {
    return { ok: false };
  }

  // 4) finance_operations qeyd
  await tx.finance_operations.create({
    data: {
      sahibkar_id: opts.sahibkarId,
      type_id: maasType.id,
      type_kod: "maas",
      y_n: "mexaric",
      meblegh: opts.meblegh,
      azn_meblegh: opts.meblegh,
      hesab_id: hesabId,
      isci_id: opts.istifadeciId,
      status: "aktiv",
      qeyd: opts.qeyd,
      yaradan_id: opts.yaradanId,
      sened_nomresi: `MAAS-${opts.bordroId}`,
    },
  });

  // 5) Source-of-truth-dan qaliq cache-i yenilə
  await recalculateAccountBalance(hesabId, tx);

  return { ok: true, hesabId };
}

const MonthSchema = z.object({
  il: z.coerce.number().int().min(2000).max(2100),
  ay: z.coerce.number().int().min(1).max(12),
});

const TAX_RATE = 0.14;
const SOCIAL_RATE = 0.03;
const COMMISSION_RATE = 0.03;

/**
 * Calculates draft bordro rows for the given month for every active employee.
 * If an existing maas_hesablamalar row exists (any status), it's left untouched.
 */
export async function calculateBordro(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("maas.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = MonthSchema.safeParse({
    il: input.get("il"),
    ay: input.get("ay"),
  });
  if (!parsed.success) return { ok: false, error: "Yanlış ay" };
  const { il, ay } = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const start = new Date(il, ay - 1, 1);
      const end = new Date(il, ay, 1);

      const [employees, existing, sales, attendance, leaves] = await Promise.all([
        prisma.istifadeciler.findMany({
          where: { aktiv: true, isden_cixdi: null, sahibkar_id: sahibkarId },
        }),
        prisma.maas_hesablamalar.findMany({
          where: { il, ay, sahibkar_id: sahibkarId },
          select: { istifadeci_id: true },
        }),
        prisma.satis_sifarisleri.groupBy({
          by: ["satis_meneceri_id"],
          where: {
            sahibkar_id: sahibkarId,
            status: { not: "legv" },
            tarix: { gte: start, lt: end },
            satis_meneceri_id: { not: null },
          },
          _sum: { son_mebleg: true },
        }),
        prisma.davamiyyet.groupBy({
          by: ["istifadeci_id", "status"],
          where: { sahibkar_id: sahibkarId, tarix: { gte: start, lt: end } },
          _count: { _all: true },
        }),
        prisma.isci_mezuniyyet
          .findMany({
            where: {
              sahibkar_id: sahibkarId,
              status: "tesdiq",
              OR: [
                { baslama: { gte: start, lt: end } },
                { bitme: { gte: start, lt: end } },
              ],
            },
          })
          .catch(() => []),
      ]);

      const existingSet = new Set(existing.map((e) => e.istifadeci_id));
      const salesMap = new Map<string, number>();
      for (const s of sales) {
        if (s.satis_meneceri_id) salesMap.set(s.satis_meneceri_id, Number(s._sum.son_mebleg ?? 0));
      }
      // attendance summary per user
      const attMap = new Map<string, { faktiki: number; qaib: number }>();
      for (const a of attendance) {
        const cur = attMap.get(a.istifadeci_id) ?? { faktiki: 0, qaib: 0 };
        if (a.status === "qaib") cur.qaib += a._count._all;
        // QA-orta: istirahət/məzuniyyət işlənmiş gün deyil — faktiki-yə yalnız
        // real iş statusları (qaydasinda/gecikib) sayılır (davamiyyet-queries.ts
        // ilə eyni semantika); məzuniyyət ayrıca mezuniyyet_gun-da uçota alınır
        else if (a.status !== "istirahet" && a.status !== "mezuniyyet")
          cur.faktiki += a._count._all;
        attMap.set(a.istifadeci_id, cur);
      }
      const leaveMap = new Map<string, number>();
      for (const lv of leaves) {
        const days = Math.max(1, Number(lv.gun_sayi ?? 1));
        leaveMap.set(lv.istifadeci_id, (leaveMap.get(lv.istifadeci_id) ?? 0) + days);
      }

      const norma = 22;

      // Perf: əvvəl per-işçi sequential create idi — indi massiv qurub tək createMany.
      // existingSet pre-filter saxlanılır.
      const toCreate = employees
        .filter((e) => !existingSet.has(e.id))
        .map((e) => {
          const esas = Number(e.aylik_maas ?? 0);
          const att = attMap.get(e.id);
          const ish_faktiki = att?.faktiki ?? norma;
          const qaib_gun = att?.qaib ?? 0;
          const mezuniyyet_gun = leaveMap.get(e.id) ?? 0;
          const prorata = esas > 0 ? (esas * Math.min(ish_faktiki, norma)) / norma : 0;
          const komisyon = (salesMap.get(e.id) ?? 0) * COMMISSION_RATE;
          const gross = prorata + komisyon;
          const vergi = gross * TAX_RATE;
          const sosial = gross * SOCIAL_RATE;
          const son = gross - vergi - sosial;
          return {
            sahibkar_id: sahibkarId,
            istifadeci_id: e.id,
            il,
            ay,
            esas_maas: esas,
            ish_gun_norma: norma,
            ish_gun_faktiki: ish_faktiki,
            qaib_gun,
            mezuniyyet_gun,
            prorata_maas: prorata,
            kpi_bonus: 0,
            manual_bonus: 0,
            cerime: 0,
            avans: 0,
            son_meblegh: son,
            status: "cernovik" as const,
            detal: {
              satis_komisyon: komisyon,
              vergi,
              sosial_sigorta: sosial,
              gross,
            },
            yaradan_id: istifadeciId,
          };
        });

      const created =
        toCreate.length > 0
          ? (await prisma.maas_hesablamalar.createMany({ data: toCreate })).count
          : 0;
      revalidatePath("/iscilier/maas");
      bustHrCache();
      if (created > 0) {
        await audit("hesabla", "maas_hesablama", null, {
          yeni_data: { il, ay, yaradilan: created, isci_say: employees.length },
          sebeb: `Payroll çernovik hesablanıb (${il}-${String(ay).padStart(2, "0")})`,
        });
      }
      return { ok: true, count: created };
    } catch (e) {
      console.error("[calculateBordro]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Bordro hesablanmadı: ${msg}` };
    }
  });
}

/* ------------------------------------------------------------------ */
/*   MANUAL BONUS / PENALTY                                            */
/* ------------------------------------------------------------------ */

const BonusSchema = z.object({
  istifadeci_id: z.string().uuid(),
  nov: z.enum(["bonus", "cerime"]),
  meblegh: z.coerce.number().positive(),
  sebeb: z.string().min(2).max(500),
  tarix: z.string().optional().or(z.literal("")),
});

export async function saveBonusOrPenalty(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm(["maas.idare", "isci.discipline"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BonusSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  // 📅 Real-time tarix məcburiyyəti
  const { validateOperationDate } = await import("@/lib/operation-date-guard");
  const dateCheck = await validateOperationDate(d.tarix, { fieldLabel: "Bonus/cərimə tarixi" });
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const refDate = d.tarix ? (parseLocalDate(d.tarix) ?? new Date()) : new Date();
      const il = refDate.getFullYear();
      const ay = refDate.getMonth() + 1;

      // Find or create draft bordro for that month
      let b = await prisma.maas_hesablamalar.findFirst({
        where: { sahibkar_id: sahibkarId, istifadeci_id: d.istifadeci_id, il, ay },
      });
      if (b && b.status === "odenilib") {
        return { ok: false, error: `${il}-${String(ay).padStart(2, "0")} ödənilib, redaktə oluna bilməz` };
      }
      if (!b) {
        const emp = await prisma.istifadeciler.findUnique({ where: { id: d.istifadeci_id } });
        if (!emp) return { ok: false, error: "İşçi tapılmadı" };
        const esas = Number(emp.aylik_maas ?? 0);
        b = await prisma.maas_hesablamalar.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: d.istifadeci_id,
            il,
            ay,
            esas_maas: esas,
            prorata_maas: esas,
            kpi_bonus: 0,
            manual_bonus: 0,
            cerime: 0,
            avans: 0,
            son_meblegh: esas,
            status: "cernovik",
            yaradan_id: istifadeciId,
          },
        });
      }

      const isBonus = d.nov === "bonus";
      const curBonus = Number(b.manual_bonus ?? 0);
      const curCerime = Number(b.cerime ?? 0);
      const nextBonus = isBonus ? curBonus + d.meblegh : curBonus;
      const nextCerime = !isBonus ? curCerime + d.meblegh : curCerime;
      const prorata = Number(b.prorata_maas ?? 0);
      const kpiBonus = Number(b.kpi_bonus ?? 0);
      const avans = Number(b.avans ?? 0);
      const detal = (b.detal as { satis_komisyon?: number } | null) ?? {};
      const komisyon = Number(detal.satis_komisyon ?? 0);
      const gross = prorata + kpiBonus + nextBonus + komisyon;
      const vergi = gross * 0.14;
      const sosial = gross * 0.03;
      const son = gross - nextCerime - avans - vergi - sosial;

      // Append to qeyd JSON in detal: { events: [...] }
      const events = ((b.detal as { events?: unknown[] } | null)?.events ?? []) as Array<{
        ts: string; nov: string; meblegh: number; sebeb: string; by?: string;
      }>;
      events.push({
        ts: new Date().toISOString(),
        nov: d.nov,
        meblegh: d.meblegh,
        sebeb: d.sebeb.trim(),
        by: istifadeciId ?? undefined,
      });

      await prisma.maas_hesablamalar.update({
        where: { id: b.id },
        data: {
          manual_bonus: nextBonus,
          cerime: nextCerime,
          son_meblegh: son,
          detal: { ...detal, events, vergi, sosial_sigorta: sosial, gross },
        },
      });
      revalidatePath("/iscilier/maas");
      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      bustHrCache();
      await audit("yenile", "maas_hesablama", b.id, {
        yeni_data: {
          nov: d.nov,
          meblegh: d.meblegh,
          istifadeci_id: d.istifadeci_id,
          il, ay,
          yeni_son: son,
        },
        sebeb: `${d.nov === "bonus" ? "Bonus" : "Cərimə"}: ${d.sebeb}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveBonusOrPenalty]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

const PaySchema = z.object({
  id: z.coerce.number().int().positive(),
  hesab_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

export async function payBordro(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("maas.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = PaySchema.safeParse({
    id: input.get("id"),
    hesab_id: input.get("hesab_id"),
  });
  if (!parsed.success) return { ok: false, error: "Yanlış ID" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const b = await prisma.maas_hesablamalar.findUnique({ where: { id: parsed.data.id } });
      if (!b) return { ok: false, error: "Bordro tapılmadı" };
      if (b.status === "odenilib") return { ok: false, error: "Artıq ödənilib" };

      const now = new Date();
      let financeOk = false;
      let usedHesabId: string | undefined;
      const meblegh = Number(b.son_meblegh ?? 0);

      await prisma.$transaction(async (tx) => {
        await tx.maas_hesablamalar.update({
          where: { id: b.id },
          data: { status: "odenilib", odenish_tarixi: now },
        });
        await tx.isci_odenisleri.create({
          data: {
            sahibkar_id: sahibkarId,
            istifadeci_id: b.istifadeci_id,
            nov: "maas",
            meblegh: b.son_meblegh ?? 0,
            maas_hesab_id: b.id,
            qeyd: `${b.il}-${String(b.ay).padStart(2, "0")} ayı üçün maaş`,
            yaradan_id: istifadeciId,
          },
        });
        // 🔗 Maliyə bağlantısı — kassa/bank məxariç + finance_operations
        const res = await recordMaasFinanceLeg(tx, {
          sahibkarId,
          yaradanId: istifadeciId,
          istifadeciId: b.istifadeci_id,
          bordroId: b.id,
          meblegh,
          qeyd: `${b.il}-${String(b.ay).padStart(2, "0")} ayı üçün maaş`,
          hesabId: parsed.data.hesab_id ?? null,
        });
        financeOk = res.ok;
        usedHesabId = res.hesabId;
      });
      await audit("yarat", "maas_odenis", b.id, {
        yeni_data: {
          istifadeci_id: b.istifadeci_id,
          il: b.il,
          ay: b.ay,
          meblegh,
          hesab_id: usedHesabId,
          finance_leg: financeOk,
        },
        sebeb: `Maaş ödənildi (${b.il}-${String(b.ay).padStart(2, "0")})${financeOk ? "" : " — DİQQƏT: hesab bağlanmadı"}`,
      });
      revalidatePath("/iscilier/maas");
      revalidatePath("/maliyye");
      bustHrCache();
      return {
        ok: true,
        ...(financeOk ? {} : { count: 0 }),
      };
    } catch (e) {
      console.error("[payBordro]", e);
      return { ok: false, error: safeUserMessage(e, "Ödəniş alınmadı") };
    }
  });
}

export async function bulkPayBordro(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("maas.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = MonthSchema.safeParse({ il: input.get("il"), ay: input.get("ay") });
  if (!parsed.success) return { ok: false, error: "Yanlış ay" };
  const { il, ay } = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const list = await prisma.maas_hesablamalar.findMany({
        where: { il, ay, sahibkar_id: sahibkarId, status: { not: "odenilib" } },
      });
      const now = new Date();
      let count = 0;
      let financeFailCount = 0;
      // Perf (#2): əvvəl hər bordro üçün ayrıca $transaction idi (N round-trip).
      // İndi TƏK transaction: status update-ləri updateMany ilə, ödəniş qeydləri
      // createMany ilə toplu yazılır; finance-leg-lər balans yoxlaması olduğu üçün
      // həmin tx içində SEQUENTIAL qalır (atomarlıq + balans nəzarəti qorunur).
      if (list.length > 0) {
        await prisma.$transaction(async (tx) => {
          const ids = list.map((b) => b.id);
          await tx.maas_hesablamalar.updateMany({
            where: { id: { in: ids } },
            data: { status: "odenilib", odenish_tarixi: now },
          });
          await tx.isci_odenisleri.createMany({
            data: list.map((b) => ({
              sahibkar_id: sahibkarId,
              istifadeci_id: b.istifadeci_id,
              nov: "maas",
              meblegh: b.son_meblegh ?? 0,
              maas_hesab_id: b.id,
              qeyd: `${il}-${String(ay).padStart(2, "0")} ayı üçün maaş (bulk)`,
              yaradan_id: istifadeciId,
            })),
          });
          for (const b of list) {
            const res = await recordMaasFinanceLeg(tx, {
              sahibkarId,
              yaradanId: istifadeciId,
              istifadeciId: b.istifadeci_id,
              bordroId: b.id,
              meblegh: Number(b.son_meblegh ?? 0),
              qeyd: `${il}-${String(ay).padStart(2, "0")} ayı üçün maaş (toplu)`,
            });
            if (!res.ok) financeFailCount++;
            count++;
          }
        });
      }
      if (financeFailCount > 0) {
        console.warn(`[bulkPayBordro] ${financeFailCount}/${count} ödəniş hesab-a bağlanmadı (default kassa/bank yox)`);
      }
      // QA-K29: maliyyə leg-i alınmayan ödənişlər əvvəl SƏSSİZ udulurdu —
      // istifadəçi indi açıq xəbərdarlıq görür (hesab balansı azalmayıb!).
      const warning =
        financeFailCount > 0
          ? `${financeFailCount}/${count} ödəniş heç bir kassa/bank hesabına bağlanmadı — hesab balansı dəyişmədi. Maliyyə → Hesablar bölməsində default hesab yoxlayın.`
          : undefined;
      revalidatePath("/maliyye");
      await audit("yarat", "maas_odenis_bulk", null, {
        yeni_data: {
          il, ay, count,
          ids: list.map((b) => b.id),
        },
        sebeb: `Toplu maaş ödənişi (${il}-${String(ay).padStart(2, "0")})`,
      });
      revalidatePath("/iscilier/maas");
      bustHrCache();
      return { ok: true, count, warning };
    } catch (e) {
      console.error("[bulkPayBordro]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Toplu ödəniş alınmadı: ${msg}` };
    }
  });
}

const AdjustSchema = z.object({
  id: z.coerce.number().int().positive(),
  field: z.enum(["kpi_bonus", "manual_bonus", "cerime", "avans"]),
  value: z.coerce.number().min(0),
});

export async function adjustBordro(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("maas.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = AdjustSchema.safeParse({
    id: input.get("id"),
    field: input.get("field"),
    value: input.get("value"),
  });
  if (!parsed.success) return { ok: false, error: "Yanlış məlumat" };
  return withTenant(async () => {
    try {
      const { id, field, value } = parsed.data;
      const b = await prisma.maas_hesablamalar.findUnique({ where: { id } });
      if (!b) return { ok: false, error: "Bordro tapılmadı" };
      if (b.status === "odenilib") return { ok: false, error: "Ödənilib, redaktə oluna bilməz" };

      const data: Record<string, unknown> = { [field]: value };
      const next = {
        prorata_maas: Number(b.prorata_maas ?? 0),
        kpi_bonus: Number(b.kpi_bonus ?? 0),
        manual_bonus: Number(b.manual_bonus ?? 0),
        cerime: Number(b.cerime ?? 0),
        avans: Number(b.avans ?? 0),
        [field]: value,
      };
      const detal = (b.detal as { satis_komisyon?: number; vergi?: number; sosial_sigorta?: number } | null) ?? {};
      const komisyon = Number(detal.satis_komisyon ?? 0);
      const gross = next.prorata_maas + next.kpi_bonus + next.manual_bonus + komisyon;
      const vergi = gross * TAX_RATE;
      const sosial = gross * SOCIAL_RATE;
      const son = gross - next.cerime - next.avans - vergi - sosial;
      data.son_meblegh = son;
      data.detal = { ...detal, vergi, sosial_sigorta: sosial, gross };

      await prisma.maas_hesablamalar.update({ where: { id }, data });
      await audit("yenile", "maas_hesablama", id, {
        evvelki_data: { [field]: Number((b as unknown as Record<string, unknown>)[field] ?? 0), son_meblegh: Number(b.son_meblegh ?? 0) },
        yeni_data: { [field]: value, son_meblegh: son },
        sebeb: `Bordro düzəlişi: ${field}`,
      });
      revalidatePath("/iscilier/maas");
      bustHrCache();
      return { ok: true };
    } catch (e) {
      console.error("[adjustBordro]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yenilənmədi: ${msg}` };
    }
  });
}
