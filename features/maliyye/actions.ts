"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils/date-parse";
import { createApprovalRequest, shouldApproveExpense } from "@/features/tesdiq/create";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { audit } from "@/lib/audit/log";
import { safeUserMessage } from "@/lib/error/user-message";
import { requireMaliyyeActionPerm, bustMaliyyeCache, requireHighValueApproval } from "./access-guard";

const VALYUTA_WHITELIST = ["AZN", "USD", "EUR", "RUB", "GBP", "TRY"] as const;
function isAllowedValyuta(v: string): boolean {
  return (VALYUTA_WHITELIST as readonly string[]).includes(v.toUpperCase());
}

// ───────────────────────────────────────────────────────────
// THRESHOLD HELPERS — ayarlar qrup="maliyye_threshold"
// ───────────────────────────────────────────────────────────
const THRESHOLD_KEYS = {
  xerc: "xerc",
  transfer: "transfer",
  qaime: "qaime",
  maas: "maas",
  default: "default",
} as const;

const THRESHOLD_DEFAULTS: Record<string, number> = {
  xerc: 10000,
  transfer: 50000,
  qaime: 100000,
  maas: 20000,
  default: 25000,
};

async function getThresholdMap(): Promise<Record<string, number>> {
  const { sahibkarId } = requireTenant();
  const rows = await prisma.ayarlar
    .findMany({
      where: { sahibkar_id: sahibkarId, qrup: "maliyye_threshold" },
      select: { acar: true, deyer: true },
    })
    .catch(() => [] as { acar: string; deyer: string | null }[]);
  const out: Record<string, number> = { ...THRESHOLD_DEFAULTS };
  for (const r of rows) {
    const n = Number(r.deyer);
    if (!Number.isNaN(n) && n > 0) out[r.acar] = n;
  }
  return out;
}

function pickThresholdKey(typeKod: string): keyof typeof THRESHOLD_KEYS {
  if (typeKod === "xercler") return "xerc";
  if (typeKod === "transfer" || typeKod === "valyuta_mubadile") return "transfer";
  if (typeKod === "qaime") return "qaime";
  if (typeKod === "maas" || typeKod === "avans" || typeKod === "bonus") return "maas";
  return "default";
}

const ExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  kateqoriya_id: z.coerce.number().int().positive().optional(),
  tarix: z.string(),
  mebleg: z.coerce.number().positive(),
  odenis_nov: z.enum(["negd", "kart", "kecirme"]).default("negd"),
  tesvir: z.string().min(2).max(500),
  qebz_nomresi: z.string().max(50).optional().or(z.literal("")),
  /** Hansı hesabdan/kassadan çıxış — opsional, lakin verilərsə qaliq azalır + finance_op yaranır */
  hesab_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

type ActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

export async function saveExpense(input: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(input.entries());
  const isEdit = !!(raw as { id?: string }).id;
  const permCheck = await requireMaliyyeActionPerm(isEdit ? "xerc.idare" : "xerc.yarat");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = ExpenseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  // 📅 Real-time tarix məcburiyyəti
  const { validateOperationDate } = await import("@/lib/operation-date-guard");
  const dateCheck = await validateOperationDate(d.tarix, { fieldLabel: "Xərc tarixi" });
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const data = {
        kateqoriya_id: d.kateqoriya_id ?? null,
        tarix: parseLocalDate(d.tarix),
        mebleg: d.mebleg,
        odenis_nov: d.odenis_nov,
        tesvir: d.tesvir.trim(),
        qebz_nomresi: d.qebz_nomresi || null,
      };
      let id: string;
      let prevData: Record<string, unknown> | null = null;

      // ⚛️ Atomic transaction — xərc + təsdiq tələbi birlikdə yaranır
      const approvalInfo = !d.id ? await shouldApproveExpense(d.mebleg) : { needed: false, limit: 0 };

      await prisma.$transaction(async (tx) => {
        if (d.id) {
          // 🔒 Açıq sahibkar_id qoruması
          const before = await tx.xercl_r.findFirst({
            where: { id: d.id, sahibkar_id: sahibkarId },
            select: { mebleg: true, tesvir: true, kateqoriya_id: true, odenis_nov: true },
          });
          if (!before) throw new Error("Xərc tapılmadı");
          prevData = before as unknown as Record<string, unknown>;
          const r = await tx.xercl_r.updateMany({
            where: { id: d.id, sahibkar_id: sahibkarId },
            data,
          });
          if (r.count === 0) throw new Error("Xərc tapılmadı");
          id = d.id;
        } else {
          const created = await tx.xercl_r.create({ data: { sahibkar_id: sahibkarId, ...data } });
          id = created.id;

          // Əgər istifadəçi hesab seçibsə, finance_operations qeydi yarat və hesab qaliqını azalt.
          // Bu addım xərcin maliyyə dashboard-ı və hesab balanslarına real təsir etməsi üçündür.
          if (d.hesab_id) {
            // Qaliq yetərlilik yoxlaması
            const { checkAccountSufficient, recalculateAccountBalance } =
              await import("@/lib/balance/account-balance");
            const sufficient = await checkAccountSufficient(d.hesab_id, d.mebleg, tx);
            if (!sufficient.ok) {
              throw new Error(sufficient.error);
            }
            // finance_operation_types — yoxla/yarat
            let xercType = await tx.finance_operation_types.findUnique({
              where: { kod: "xerc" },
              select: { id: true, kod: true },
            }).catch(() => null);
            if (!xercType) {
              xercType = await tx.finance_operation_types.create({
                data: { kod: "xerc", ad: "Xərc", qrup: "xercler", y_n: "mexaric" },
                select: { id: true, kod: true },
              });
            }
            await tx.finance_operations.create({
              data: {
                sahibkar_id: sahibkarId,
                type_id: xercType.id,
                type_kod: xercType.kod,
                y_n: "mexaric",
                tarix: parseLocalDate(d.tarix),
                meblegh: d.mebleg,
                azn_meblegh: d.mebleg,
                hesab_id: d.hesab_id,
                expense_kateq_id: d.kateqoriya_id ?? null,
                status: "aktiv",
                qeyd: `[XERC:${id}] ${d.tesvir}`,
                yaradan_id: istifadeciId,
                sened_nomresi: d.qebz_nomresi || null,
              },
            });
            // Source-of-truth-dan hesab qaliqını yenilə
            await recalculateAccountBalance(d.hesab_id, tx);
          }
        }
      });

      // Təsdiq tələbi (xərc) — yalnız yeni xərc yaradanda
      if (!d.id && approvalInfo.needed) {
        try {
          await createApprovalRequest({
            emeliyyat_nov: "xerc",
            resurs_nov: "xerc",
            resurs_id: id!,
            basliq: `Xərc: ${d.tesvir.slice(0, 80)}`,
            risk_sebeb: approvalInfo.limit > 0
              ? `Xərc ${d.mebleg.toFixed(2)}₼ — limit ${approvalInfo.limit}₼-i keçir`
              : "Hər xərc təsdiq tələb edir",
            mebleg: d.mebleg,
            prioritet: d.mebleg > 1000 ? "yuxsek" : "orta",
            detay_json: {
              kateqoriya_id: d.kateqoriya_id ?? null,
              odenis_nov: d.odenis_nov,
              qebz_nomresi: d.qebz_nomresi ?? null,
            },
          });
          revalidatePath("/tesdiq");
        } catch (e) {
          console.warn("[saveExpense] approval request skipped:", e);
        }
      }

      revalidatePath("/maliyye");
      revalidatePath("/maliyye/xercler");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: d.id ? "yenile" : "yarat",
          resurs_nov: "xerc",
          resurs_id: id!,
          evvelki_data: prevData ?? undefined,
          yeni_data: { ...data, needs_approval: approvalInfo.needed },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id: id! };
    } catch (e) {
      console.error("[saveExpense]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/balans|hesab|tarix|mebleg|məbləğ|miqdar|tapılmadı|bağlı|təsdiq/i.test(raw)) {
        return { ok: false, error: raw };
      }
      return { ok: false, error: safeUserMessage(e, "Yadda saxlanmadı") };
    }
  });
}

export async function deleteExpense(id: string, sebeb?: string): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm("xerc.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Açıq sahibkar_id qoruması + aktiv (legv_de IS NULL) yoxlaması
      const before = await prisma.xercl_r.findFirst({
        where: { id, sahibkar_id: sahibkarId, legv_de: null },
        select: { mebleg: true, tesvir: true, tarix: true },
      });
      if (!before) return { ok: false, error: "Xərc tapılmadı və ya artıq ləğv edilib" };
      // Soft delete — hard delete əvəzinə legv_de timestamp qoy
      const r = await prisma.xercl_r.updateMany({
        where: { id, sahibkar_id: sahibkarId, legv_de: null },
        data: {
          legv_de: new Date(),
          legv_sebeb: sebeb?.trim() || "Manual silinmə",
          legv_eden_id: istifadeciId,
        },
      });
      if (r.count === 0) return { ok: false, error: "Xərc tapılmadı" };
      revalidatePath("/maliyye/xercler");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "legv",
          resurs_nov: "xerc",
          resurs_id: id,
          evvelki_data: { mebleg: Number(before.mebleg), tesvir: before.tesvir, tarix: before.tarix },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[deleteExpense]", e);
      return { ok: false, error: safeUserMessage(e, "Silinmədi") };
    }
  });
}

const CategorySchema = z.object({
  ad: z.string().min(1).max(100),
  reng: z.string().max(20).optional().or(z.literal("")),
});

export async function createExpenseCategory(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["xerc.kateqoriya", "xerc.idare", "ayarlar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = CategorySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const created = await prisma.xerc_kateqoriyalari.create({
        data: { sahibkar_id: sahibkarId, ad: parsed.data.ad, reng: parsed.data.reng || "#64748b" },
      });
      revalidatePath("/maliyye/xercler");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yarat",
          resurs_nov: "xerc_kateqoriya",
          resurs_id: String(created.id),
          yeni_data: { ad: parsed.data.ad },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[createExpenseCategory]", e);
      return { ok: false, error: safeUserMessage(e, "Yaradılmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// HESAB (maliye_hesablari) — yeni hesab yarat
// ───────────────────────────────────────────────────────────
const AccountSchema = z.object({
  ad: z.string().min(1).max(100),
  nov: z.enum(["negd", "bank", "kart", "e_pul", "diger"]).default("bank"),
  bank_adi: z.string().max(100).optional().or(z.literal("")),
  iban: z.string().max(50).optional().or(z.literal("")),
  kart_son4: z.string().max(4).optional().or(z.literal("")),
  qaliq: z.coerce.number().default(0),
  valyuta: z.string().max(3).default("AZN"),
  qeyd: z.string().optional().or(z.literal("")),
});

export async function createAccount(input: FormData): Promise<ActionResult> {
  // Bank və ya kassa yaradılır — nov-a görə icazə yoxlanır
  const raw = Object.fromEntries(input.entries());
  const nov = String(raw.nov ?? "");
  const requiredPerm = nov === "bank" ? "bank.emeliyyat" : "kassa.emeliyyat";
  const permCheck = await requireMaliyyeActionPerm(requiredPerm);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = AccountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  if (!isAllowedValyuta(d.valyuta)) return { ok: false, error: `Valyuta «${d.valyuta}» dəstəklənmir` };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const created = await prisma.maliye_hesablari.create({
        data: {
          sahibkar_id: sahibkarId,
          ad: d.ad,
          nov: d.nov,
          bank_adi: d.bank_adi || null,
          iban: d.iban || null,
          kart_son4: d.kart_son4 || null,
          qaliq: d.qaliq,
          valyuta: d.valyuta.toUpperCase(),
          qeyd: d.qeyd || null,
          aktiv: true,
        },
      });
      revalidatePath("/maliyye/hesab");
      revalidatePath("/maliyye");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "yarat",
          resurs_nov: "maliye_hesabi",
          resurs_id: created.id,
          yeni_data: { ad: d.ad, nov: d.nov, valyuta: d.valyuta.toUpperCase(), bank_adi: d.bank_adi || null, ilkin_qaliq: d.qaliq },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[createAccount]", e);
      return { ok: false, error: safeUserMessage(e, "Hesab yaradılmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// FIN_QUICK — sürətli əməliyyatlar (finance_operations)
// ───────────────────────────────────────────────────────────
const QuickOpSchema = z.object({
  type_kod: z.string().min(1).max(40),
  mebleg: z.coerce.number().positive(),
  valyuta: z.string().max(8).default("AZN"),
  hesab_id: z.string().uuid().optional().or(z.literal("")),
  hesab_id2: z.string().uuid().optional().or(z.literal("")),
  meblegh2: z.coerce.number().optional(),
  mezenne: z.coerce.number().default(1),
  isci_id: z.string().uuid().optional().or(z.literal("")),
  kontragent_id: z.string().uuid().optional().or(z.literal("")),
  tarix: z.string().optional(),
  sened_nomresi: z.string().max(50).optional().or(z.literal("")),
  qeyd: z.string().optional().or(z.literal("")),
  xerc_kateqoriya: z.string().max(40).optional().or(z.literal("")),
  xerc_merkez: z.string().max(40).optional().or(z.literal("")),
  recur_tezlik: z.string().max(20).optional().or(z.literal("")),
  recur_son_tarix: z.string().optional().or(z.literal("")),
  recur_say: z.coerce.number().int().optional(),
});

type QuickYon = "daxil" | "xaric" | "transfer" | "neutral";
type QuickMetaEntry = {
  qrup: string;
  ad: string;
  yon: QuickYon;
  needHesab?: boolean;
  needHesab2?: boolean;
  needIsci?: boolean;
  needKontragent?: boolean;
};

// ── Sadələşdirilmiş 14 əməliyyat növü (Prospect ERP məntiqi) ──
const QUICK_META: Record<string, QuickMetaEntry> = {
  qaime:            { qrup: "qaime",     ad: "Qaimə",                 yon: "daxil",    needHesab: true, needKontragent: true },
  xercler:          { qrup: "xercler",   ad: "Xərclər",               yon: "xaric",    needHesab: true },
  maas:             { qrup: "maas_isci", ad: "Əməkhaqqı ödənişi",     yon: "xaric",    needHesab: true, needIsci: true },
  avans:            { qrup: "maas_isci", ad: "Avans",                 yon: "xaric",    needHesab: true, needIsci: true },
  bonus:            { qrup: "maas_isci", ad: "Bonus",                 yon: "xaric",    needHesab: true, needIsci: true },
  cerime:           { qrup: "maas_isci", ad: "Cərimə",                yon: "daxil",    needHesab: true, needIsci: true },
  // QA-K19: tək-hesablı əməliyyatlar 'transfer' yönü ilə balansa HEÇ düşmürdü
  // (calculateAccountBalance transfer üçün hesab_id2 tələb edir) — təsisçi pulu
  // hesaba DAXİL, tahtəl hesab hesabdan XARİC kimi modelləşdirilir.
  tesisci_pul:      { qrup: "sahibkar",  ad: "Təsisçi pulu",          yon: "daxil",    needHesab: true },
  tehtl_hesab:      { qrup: "sahibkar",  ad: "Tahtəl hesab",          yon: "xaric",    needHesab: true },
  transfer:         { qrup: "transfer",  ad: "Transfer",              yon: "transfer", needHesab: true, needHesab2: true },
  valyuta_mubadile: { qrup: "transfer",  ad: "Valyuta mübadiləsi",    yon: "transfer", needHesab: true, needHesab2: true },
  dividend:         { qrup: "sahibkar",  ad: "Dividend",              yon: "xaric",    needHesab: true },
  borc_silinme:     { qrup: "borclar",   ad: "Borc silinməsi",        yon: "neutral",  needKontragent: true },
  artirma:          { qrup: "duzelis",   ad: "Artırma",               yon: "daxil",    needHesab: true },
  azaltma:          { qrup: "duzelis",   ad: "Azaltma",               yon: "xaric",    needHesab: true },
  barter:           { qrup: "transfer",  ad: "Barter",                yon: "transfer", needKontragent: true },
};

export async function saveQuickOperation(input: FormData): Promise<ActionResult> {
  const parsed = QuickOpSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  const meta = QUICK_META[d.type_kod];
  if (!meta) return { ok: false, error: "Naməlum əməliyyat növü" };

  // 🔒 İcazə yoxlaması — əməliyyat növünə görə spesifik icazə
  const permKeys: string[] = ["fin_op.yarat", "maliyye.idare"];
  if (meta.yon === "transfer") permKeys.push("fin_op.transfer");
  if (meta.qrup === "sahibkar") permKeys.push("fin_op.sahibkar");
  if (meta.qrup === "maas_isci") permKeys.push("maas.idare");
  if (meta.qrup === "xercler") permKeys.push("xerc.yarat", "xerc.idare");
  const permCheck = await requireMaliyyeActionPerm(permKeys);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  // 📅 Real-time tarix məcburiyyəti
  const { validateOperationDate } = await import("@/lib/operation-date-guard");
  const dateCheck = await validateOperationDate(d.tarix, { fieldLabel: "Əməliyyat tarixi" });
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

  // 💱 Valyuta whitelist
  if (!isAllowedValyuta(d.valyuta)) return { ok: false, error: `Valyuta «${d.valyuta}» dəstəklənmir` };

  // 💸 Yüksək məbləğ təsdiq gate-i (silsiləli müdafiə — admin-only > 50k AZN)
  const aznMeblegEarly = d.mebleg * (d.mezenne || 1);
  const hvCheck = await requireHighValueApproval(aznMeblegEarly, 50_000);
  if (!hvCheck.ok) return { ok: false, error: hvCheck.error };

  // Required-field validation per operation type
  if (meta.needHesab && !d.hesab_id) return { ok: false, error: "Hesab / kassa seçilməlidir" };
  if (meta.needHesab2 && !d.hesab_id2) return { ok: false, error: "Hədəf hesab seçilməlidir" };
  if (meta.needHesab2 && d.hesab_id && d.hesab_id2 && d.hesab_id === d.hesab_id2) {
    return { ok: false, error: "Mənbə və hədəf hesab eyni ola bilməz" };
  }
  if (meta.needIsci && !d.isci_id) return { ok: false, error: "İşçi seçilməlidir" };
  if (meta.needKontragent && !d.kontragent_id) return { ok: false, error: "Kontragent seçilməlidir" };

  // Hesab/növ ziddiyyəti yoxlaması: hesab tipindən asılı olan əməliyyat növləri.
  // Məs. nağd kassadan kart-spesifik ödəniş edilə bilməz.
  if (d.hesab_id) {
    const hesab = await prisma.maliye_hesablari.findFirst({
      where: { id: d.hesab_id, aktiv: true },
      select: { nov: true, ad: true },
    });
    if (hesab) {
      const ALLOWED: Record<string, string[]> = {
        marketplace_payout: ["bank", "kart", "marketplace"],
        pos_satish: ["pos", "kart"],
        tesisci_pul: ["negd", "bank", "owner"],
        dividend: ["negd", "bank", "owner"],
      };
      const allowed = ALLOWED[d.type_kod];
      if (allowed && !allowed.includes(hesab.nov)) {
        return {
          ok: false,
          error: `${meta.ad} əməliyyatı «${hesab.ad}» (${hesab.nov}) hesabına uyğun deyil. Tələb: ${allowed.join(" / ")}`,
        };
      }
    }
  }

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      // Find or create operation_type
      let type = await prisma.finance_operation_types
        .findUnique({ where: { kod: d.type_kod } })
        .catch(() => null);
      if (!type) {
        type = await prisma.finance_operation_types
          .create({
            data: { kod: d.type_kod, ad: meta.ad, qrup: meta.qrup, y_n: meta.yon },
          })
          .catch(() => null);
      }
      if (!type) {
        // Fallback — save as xerc if xaric
        if (meta.yon === "xaric") {
          const xercTag = d.xerc_kateqoriya ? `[KAT:${d.xerc_kateqoriya}]` : "";
          const xercMerkezTag = d.xerc_merkez ? `[MERKEZ:${d.xerc_merkez}]` : "";
          await prisma.xercl_r.create({
            data: {
              sahibkar_id: sahibkarId,
              tarix: d.tarix ? parseLocalDate(d.tarix) : new Date(),
              mebleg: d.mebleg,
              odenis_nov: "kecirme",
              tesvir: `${meta.ad}${d.qeyd ? ` — ${d.qeyd}` : ""}`,
              qeyd: [xercTag, xercMerkezTag].filter(Boolean).join(" ") || null,
              istifadeci_id: userId ?? null,
            },
          });
          revalidatePath("/maliyye/xercler");
          revalidatePath("/maliyye");
          return { ok: true };
        }
        return { ok: false, error: "Əməliyyat tipi yaradılmadı" };
      }

      const xercTag = d.xerc_kateqoriya ? `[KAT:${d.xerc_kateqoriya}]` : "";
      const xercMerkezTag = d.xerc_merkez ? `[MERKEZ:${d.xerc_merkez}]` : "";
      const recurTag =
        d.recur_tezlik
          ? `[RECUR:${d.recur_tezlik}${d.recur_say ? `,${d.recur_say}` : ""}${d.recur_son_tarix ? `,until=${d.recur_son_tarix}` : ""}]`
          : "";
      const tagPrefix = [xercTag, xercMerkezTag, recurTag].filter(Boolean).join(" ");

      // Approval threshold check
      const aznMebleg = d.mebleg * (d.mezenne || 1);
      const thresholdMap = await getThresholdMap();
      const tKey = pickThresholdKey(d.type_kod);
      const threshold = thresholdMap[tKey] ?? thresholdMap.default ?? 0;
      const needsApproval = threshold > 0 && aznMebleg >= threshold;
      const opStatus = needsApproval ? "gozleyen_tesdiq" : "aktiv";

      const created = await prisma.finance_operations.create({
        data: {
          sahibkar_id: sahibkarId,
          type_id: type.id,
          type_kod: type.kod,
          y_n: type.y_n,
          tarix: d.tarix ? parseLocalDate(d.tarix) : new Date(),
          meblegh: d.mebleg,
          valyuta: d.valyuta,
          mezenne: d.mezenne,
          azn_meblegh: aznMebleg,
          hesab_id: d.hesab_id || null,
          hesab_id2: d.hesab_id2 || null,
          meblegh2: d.meblegh2 ?? null,
          isci_id: d.isci_id || null,
          kontragent_id: d.kontragent_id || null,
          sened_nomresi: d.sened_nomresi || null,
          status: opStatus,
          rehber_tesdiq_lazim: needsApproval,
          qeyd: [tagPrefix, d.qeyd].filter(Boolean).join(" ") || null,
          yaradan_id: userId ?? null,
        },
      });

      // Create approval request + alert when threshold exceeded
      if (needsApproval) {
        try {
          await prisma.finance_approval_requests.create({
            data: {
              sahibkar_id: sahibkarId,
              operation_id: created.id,
              yaradan_id: userId ?? null,
              status: "gozleyir",
              qeyd: `${meta.ad} — ${aznMebleg.toFixed(2)} AZN (threshold: ${threshold.toFixed(0)})`,
            },
          });
        } catch (e) {
          console.warn("[saveQuickOperation] approval request skipped:", e);
        }
        try {
          await prisma.tesdiq_telep.create({
            data: {
              sahibkar_id: sahibkarId,
              emeliyyat_nov: "maliyye_op",
              resurs_nov: "finance_operations",
              resurs_id: created.id,
              basliq: `${meta.ad} — ${aznMebleg.toFixed(2)} AZN`,
              mebleg: aznMebleg,
              risk_sebeb: `Threshold aşılıb (${threshold.toFixed(0)} AZN)`,
              prioritet: aznMebleg >= threshold * 5 ? "kritik" : aznMebleg >= threshold * 2 ? "yuxsek" : "orta",
              status: "gozleyir",
              yaradan_id: userId ?? null,
              detay_json: {
                operation_id: created.id,
                type_kod: d.type_kod,
                hesab_id: d.hesab_id ?? null,
                kontragent_id: d.kontragent_id ?? null,
              },
            },
          });
        } catch (e) {
          console.warn("[saveQuickOperation] tesdiq_telep skipped:", e);
        }
        // Create alert for admin
        try {
          const cat = await prisma.alert_categories.findFirst({
            where: { kod: { in: ["maliyye_tesdiq", "tesdiq_telep", "yuksek_mebleg"] } },
            select: { id: true, kod: true },
          });
          if (cat) {
            await prisma.alerts.create({
              data: {
                sahibkar_id: sahibkarId,
                kateqoriya_id: cat.id,
                kateqoriya_kod: cat.kod,
                seviyye: aznMebleg >= threshold * 5 ? "kritik" : "risk",
                basliq: `Təsdiq gözləyir: ${meta.ad} ${aznMebleg.toFixed(2)} AZN`,
                tesvir: `${meta.ad} əməliyyatı üçün təsdiq tələb olunur. Threshold: ${threshold.toFixed(0)} AZN.`,
                obyekt_nov: "finance_operations",
                obyekt_id: created.id,
              },
            });
          }
        } catch (e) {
          console.warn("[saveQuickOperation] alert create skipped:", e);
        }
      }

      // SOURCE-OF-TRUTH RECALC — bütün təsirlənmiş subyektlər:
      // 1) Hesab/kassa qaliqı (yeni — bu vacibdir, əvvəl qaliq update olunmurdu)
      // 2) Müştəri/təchizatçı balansı (mövcud)
      try {
        if (!needsApproval) {
          // Yalnız təsdiq lazım deyilsə qaliq dəyişib
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          if (d.hesab_id) await recalculateAccountBalance(d.hesab_id);
          if (d.hesab_id2) await recalculateAccountBalance(d.hesab_id2);
        }
      } catch (e) {
        console.warn("[saveQuickOperation] account recalc skipped:", e);
      }

      if (d.kontragent_id) {
        try {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
          await recalculateCustomerBalance(d.kontragent_id);
          await recalculateSupplierBalance(d.kontragent_id);
        } catch (e) {
          console.warn("[saveQuickOperation] recalc skipped:", e);
        }
      }

      revalidatePath("/maliyye");
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye/hesab");
      revalidatePath("/maliyye/debitor");
      revalidatePath("/maliyye/kreditor");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId,
          emeliyyat: "yarat",
          resurs_nov: "finance_operations",
          resurs_id: created.id,
          yeni_data: {
            type_kod: d.type_kod,
            mebleg: d.mebleg,
            valyuta: d.valyuta,
            azn_meblegh: aznMebleg,
            yon: meta.yon,
            needs_approval: needsApproval,
            hesab_id: d.hesab_id || null,
            hesab_id2: d.hesab_id2 || null,
            kontragent_id: d.kontragent_id || null,
            isci_id: d.isci_id || null,
          },
          status: needsApproval ? "gozleyir" : "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[saveQuickOperation]", e);
      return { ok: false, error: safeUserMessage(e, "Əməliyyat yadda saxlanmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// BANK CSV IMPORT — preview-only mock (creates stub record)
// ───────────────────────────────────────────────────────────
const BankCsvImportSchema = z.object({
  bank_adi: z.string().min(1).max(100),
  hesab_nomresi: z.string().max(50).optional().or(z.literal("")),
  fayl_adi: z.string().max(200),
  satir_sayi: z.coerce.number().int().min(0).default(0),
});

export async function importBankStatement(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["bank.import", "bank.emeliyyat", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = BankCsvImportSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const created = await prisma.bank_cixarislari.create({
        data: {
          sahibkar_id: sahibkarId,
          bank_adi: d.bank_adi,
          hesab_nomresi: d.hesab_nomresi || null,
          fayl_adi: d.fayl_adi,
          satir_sayi: d.satir_sayi,
          eslesh_sayi: 0,
          manual_sayi: 0,
          eslesmemis_sayi: d.satir_sayi,
          dovr_baslangic: new Date(),
          dovr_son: new Date(),
          yuklenen_id: userId ?? null,
        },
      });
      revalidatePath("/maliyye/bank");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId,
          emeliyyat: "import",
          resurs_nov: "bank_cixarisi",
          resurs_id: String(created.id),
          yeni_data: { bank_adi: d.bank_adi, fayl_adi: d.fayl_adi, satir_sayi: d.satir_sayi },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[importBankStatement]", e);
      return { ok: false, error: safeUserMessage(e, "İdxal alınmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// MARKETPLACE — yeni dövr reconciliation
// ───────────────────────────────────────────────────────────
const MarketplaceReconcileSchema = z.object({
  platforma: z.string().min(2).max(40),
  from: z.string().min(8),
  to: z.string().min(8),
});

export async function startMarketplaceReconciliation(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["maliyye.idare", "marketplace.recon", "hesabat.oxu"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = MarketplaceReconcileSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const fromBase = parseLocalDate(d.from);
      const toBase = parseLocalDate(d.to);
      const fromDate = new Date(fromBase.getFullYear(), fromBase.getMonth(), fromBase.getDate(), 0, 0, 0);
      const toDate = new Date(toBase.getFullYear(), toBase.getMonth(), toBase.getDate(), 23, 59, 59);
      // Aggregate marketplace sales in window
      const agg = await prisma.satis_sifarisleri.aggregate({
        where: {
          sahibkar_id: sahibkarId,
          tarix: { gte: fromDate, lte: toDate },
          status: { not: "legv" },
          marketplace_platform: d.platforma,
        },
        _sum: { son_mebleg: true, komisyon_meblegh: true, xalis_meblegh: true },
        _count: { _all: true },
      });
      const brut = Number(agg._sum.son_mebleg ?? 0);
      const komissiya = Number(agg._sum.komisyon_meblegh ?? 0);
      const xalis = Number(agg._sum.xalis_meblegh ?? brut - komissiya);
      try {
        await prisma.finance_marketplace_payments.create({
          data: {
            sahibkar_id: sahibkarId,
            platforma: d.platforma,
            donem_baslama: fromDate,
            donem_bitme: toDate,
            gozlenen_meblegh: xalis,
            komissiya,
            ferq: 0,
            status: "gozleyir",
            qeyd: `Avtomatik reconciliation: ${agg._count._all} sifariş`,
          },
        });
      } catch (e) {
        console.warn("[startMarketplaceReconciliation] payments record skipped:", e);
      }
      revalidatePath("/maliyye/marketplace");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "recon_start",
          resurs_nov: "marketplace_payment",
          resurs_id: null,
          yeni_data: {
            platforma: d.platforma,
            from: d.from,
            to: d.to,
            sifaris_sayi: agg._count._all,
            brut,
            komissiya,
            xalis,
          },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[startMarketplaceReconciliation]", e);
      return { ok: false, error: safeUserMessage(e, "Reconciliation icra edilmədi") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// FIN_OPERATION — approve / reject / cancel
// ───────────────────────────────────────────────────────────
export async function approveOperation(id: string): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["fin_op.tesdiq", "tesdiq.yoxla", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      // 🔒 Açıq sahibkar_id qoruması — yalnız öz əməliyyatını təsdiqləmək olar
      const r = await prisma.finance_operations.updateMany({
        where: { id, sahibkar_id: sahibkarId, status: { in: ["gozleyen_tesdiq", "gozleyir"] } },
        data: {
          status: "aktiv",
          tesdiq_eden_id: userId ?? null,
          tesdiq_de: new Date(),
          yenilendi: new Date(),
        },
      });
      if (r.count === 0) return { ok: false, error: "Əməliyyat tapılmadı və ya artıq təsdiqlənib" };
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      revalidatePath("/tesdiq");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId,
          emeliyyat: "tesdiq",
          resurs_nov: "finance_operations",
          resurs_id: id,
          yeni_data: { status: "aktiv" },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id };
    } catch (e) {
      console.error("[approveOperation]", e);
      return { ok: false, error: safeUserMessage(e, "Təsdiqlənmədi") };
    }
  });
}

export async function rejectOperation(id: string, sebeb?: string): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["fin_op.tesdiq", "tesdiq.yoxla", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!id) return { ok: false, error: "ID tələb olunur" };
  const cleanSebeb = (sebeb ?? "").trim().slice(0, 500);
  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const r = await prisma.finance_operations.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: {
          status: "redd",
          legv_eden_id: userId ?? null,
          legv_de: new Date(),
          legv_sebeb: cleanSebeb || null,
          yenilendi: new Date(),
        },
      });
      if (r.count === 0) return { ok: false, error: "Əməliyyat tapılmadı" };
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      revalidatePath("/tesdiq");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId,
          emeliyyat: "redd",
          resurs_nov: "finance_operations",
          resurs_id: id,
          yeni_data: { status: "redd", sebeb: cleanSebeb },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id };
    } catch (e) {
      console.error("[rejectOperation]", e);
      return { ok: false, error: safeUserMessage(e, "Rədd edilmədi") };
    }
  });
}

export async function cancelOperation(id: string, sebeb?: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "ID tələb olunur" };
  const cleanSebeb = (sebeb ?? "").trim();
  if (cleanSebeb.length < 3) return { ok: false, error: "Səbəb tələb olunur" };
  // Tam ləğv məntiqi (allocation revert + qaliq recalc + balans recalc)
  // `cancel-operation-action.ts`-də saxlanılır.
  const { cancelFinanceOperation } = await import("./cancel-operation-action");
  return cancelFinanceOperation({ operation_id: id, reason: cleanSebeb });
}

// LEGACY (saxlanılır — başqa yerlər bu adı çağıra bilər)
async function _legacyCancelOperationOldImpl(id: string, sebeb?: string): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["fin_op.legv", "fin_op.idare", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!id) return { ok: false, error: "ID tələb olunur" };
  const cleanSebeb = (sebeb ?? "").trim().slice(0, 500);
  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const r = await prisma.finance_operations.updateMany({
        where: { id, sahibkar_id: sahibkarId, status: { not: "legv" } },
        data: {
          status: "legv",
          legv_eden_id: userId ?? null,
          legv_de: new Date(),
          legv_sebeb: cleanSebeb || null,
          yenilendi: new Date(),
        },
      });
      if (r.count === 0) return { ok: false, error: "Əməliyyat tapılmadı və ya artıq ləğv edilib" };
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId,
          emeliyyat: "legv",
          resurs_nov: "finance_operations",
          resurs_id: id,
          yeni_data: { status: "legv", sebeb: cleanSebeb },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true, id };
    } catch (e) {
      console.error("[cancelOperation]", e);
      return { ok: false, error: safeUserMessage(e, "Ləğv edilmədi") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// GUN SONU — günü bağla
// ───────────────────────────────────────────────────────────
export async function closeGunSonu(): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm("maliyye.gun_sonu");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const [salesAgg, expenseAgg, kassaAgg] = await Promise.all([
        prisma.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: today }, qaralama: { not: true } },
          _sum: { odenilmis: true, son_mebleg: true },
        }),
        prisma.xercl_r.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: today }, legv_de: null },
          _sum: { mebleg: true },
        }),
        // Hesab/kassa REAL qaliqı — `maliye_hesablari.qaliq` source-of-truth ilə
        // sinxronlaşdırılır. POS açılış məbləği deyil, hazırki real balans.
        prisma.maliye_hesablari.aggregate({
          where: { sahibkar_id: sahibkarId, aktiv: true, nov: "negd" },
          _sum: { qaliq: true },
        }),
      ]);
      const satis = Number(salesAgg._sum.odenilmis ?? 0);
      const xerc = Number(expenseAgg._sum.mebleg ?? 0);
      const kassaQaliq = Number(kassaAgg._sum.qaliq ?? 0);

      const existing = await prisma.gun_sonu.findFirst({
        where: { sahibkar_id: sahibkarId, tarix: today, filial_id: null },
        select: { id: true },
      });
      if (existing) {
        await prisma.gun_sonu.update({
          where: { id: existing.id },
          data: {
            status: "bagli",
            satish_cem: satis,
            xerc_cem: xerc,
            menfeet: satis - xerc,
            kassa_qaliq: kassaQaliq,
            baglayan_id: userId ?? null,
            bagh_tarix: new Date(),
          },
        });
      } else {
        await prisma.gun_sonu.create({
          data: {
            sahibkar_id: sahibkarId,
            tarix: today,
            status: "bagli",
            satish_cem: satis,
            xerc_cem: xerc,
            menfeet: satis - xerc,
            kassa_qaliq: kassaQaliq,
            baglayan_id: userId ?? null,
            bagh_tarix: new Date(),
          },
        });
      }
      revalidatePath("/maliyye/gun-sonu");
      revalidatePath("/maliyye");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId,
          emeliyyat: "bagla",
          resurs_nov: "gun_sonu",
          resurs_id: today.toISOString().slice(0, 10),
          yeni_data: { satis_cem: satis, xerc_cem: xerc, menfeet: satis - xerc, kassa_qaliq: kassaQaliq },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[closeGunSonu]", e);
      return { ok: false, error: safeUserMessage(e, "Gün bağlanmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// NİSYƏ ÖDƏNİŞİ — müştəridən borc ödənişi al (qaiməyə bağlı və ya umumi)
// ───────────────────────────────────────────────────────────
const ReceivePaymentSchema = z.object({
  musteri_id: z.string().uuid(),
  qaime_id: z.string().uuid().optional().or(z.literal("")),
  mebleg: z.coerce.number().positive(),
  hesab_id: z.string().uuid().optional().or(z.literal("")),
  odenis_nov: z.enum(["negd", "kart", "kecirme"]).default("negd"),
  qeyd: z.string().max(500).optional().or(z.literal("")),
  idempotency_key: z.string().max(80).optional().or(z.literal("")),
});

export async function receivePartialPayment(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm("odenis.qebul");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = ReceivePaymentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findFirst({
        where: { id: d.musteri_id, sahibkar_id: sahibkarId },
        select: { id: true, ad: true, borc: true, alacaq: true, avans: true },
      });
      if (!k) return { ok: false, error: "Müştəri tapılmadı" };

      // 🛡️ İdempotensiya — son 5 dəqiqədə eyni key + müştəri + məbləğ varsa duplicate
      const idemKey = (d.idempotency_key || "").trim();
      if (idemKey) {
        const since = new Date(Date.now() - 5 * 60 * 1000);
        const dup = await prisma.finance_operations.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            kontragent_id: d.musteri_id,
            meblegh: d.mebleg,
            yaradildi: { gte: since },
            qeyd: { contains: `[IDEM:${idemKey}]` },
          },
          select: { id: true },
        });
        if (dup) return { ok: true, id: dup.id };
      }

      const qaime_id = d.qaime_id || null;
      const typeKod = "qaime";

      // 🔁 BORC PAYLAMA ALQORİTMİ (overflow cascade):
      // 1. Seçilmiş qaimə (varsa) əvvələ gedir
      // 2. Qalan açıq qaimələr tarix sırası ilə (FIFO)
      // 3. Hər qaiməyə qalıq qədər ödəniş yazılır, artıq məbləğ növbətiyə keçir
      // 4. Yalnız BÜTÜN qaimələr bağlandıqdan sonra qalan məbləğ avansa düşür
      //
      // Bu istifadəçinin "10 AZN ödədim, 2 AZN qaimə bağlandı, 8 AZN avans
      // oldu" səhv davranışını həll edir. Düzgün: 8 AZN növbəti açıq qaiməyə.
      const openSales = await prisma.satis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          musteri_id: d.musteri_id,
          status: { not: "legv" },
          qaralama: { not: true },
          odenis_nov: { in: ["nisye", "borc"] },
        },
        select: { id: true, son_mebleg: true, odenilmis: true, nomre: true, tarix: true, status: true },
        orderBy: { tarix: "asc" },
      });
      const openWithQalig = openSales
        .map((s) => ({
          id: s.id,
          nomre: s.nomre,
          tarix: s.tarix,
          son_mebleg: Number(s.son_mebleg ?? 0),
          odenilmis: Number(s.odenilmis ?? 0),
          qalig: +(Number(s.son_mebleg ?? 0) - Number(s.odenilmis ?? 0)).toFixed(2),
          status: s.status,
        }))
        .filter((s) => s.qalig > 0.01);

      // Seçilmiş qaiməni əvvələ qoy (varsa)
      let processOrder = openWithQalig;
      if (qaime_id) {
        const selected = openWithQalig.find((s) => s.id === qaime_id);
        const others = openWithQalig.filter((s) => s.id !== qaime_id);
        processOrder = selected ? [selected, ...others] : openWithQalig;
      }

      // Paylama hesabı
      let remain = d.mebleg;
      const distribution: Array<{
        sale_id: string; nomre: string; old_qalig: number; applied: number; new_qalig: number; closed: boolean;
      }> = [];
      for (const inv of processOrder) {
        if (remain <= 0.01) break;
        const apply = Math.min(remain, inv.qalig);
        distribution.push({
          sale_id: inv.id,
          nomre: inv.nomre,
          old_qalig: inv.qalig,
          applied: +apply.toFixed(2),
          new_qalig: +(inv.qalig - apply).toFixed(2),
          closed: apply >= inv.qalig - 0.01,
        });
        remain -= apply;
      }
      const totalApplied = +distribution.reduce((s, x) => s + x.applied, 0).toFixed(2);
      const toAdvance = +Math.max(0, remain).toFixed(2);

      // Atomic transaction
      await prisma.$transaction(async (tx) => {
        // 1) Find or create operation type
        let type = await tx.finance_operation_types
          .findUnique({ where: { kod: typeKod } })
          .catch(() => null);
        if (!type) {
          type = await tx.finance_operation_types
            .create({
              data: { kod: typeKod, ad: "Qaimə", qrup: "qaime", y_n: "daxil" },
            })
            .catch(() => null);
        }

        // 2) finance_operations qeyd — vahid ödəniş hadisəsi
        let paymentOpId: string | null = null;
        if (type) {
          const primarySaleId = distribution[0]?.sale_id ?? qaime_id;
          const op = await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: type.kod,
              y_n: "daxil",
              tarix: new Date(),
              meblegh: d.mebleg,
              valyuta: "AZN",
              mezenne: 1,
              azn_meblegh: d.mebleg,
              hesab_id: d.hesab_id || null,
              kontragent_id: d.musteri_id,
              satis_id: primarySaleId,
              qeyd: [
                idemKey ? `[IDEM:${idemKey}]` : "",
                distribution.length > 1
                  ? `Ödəniş ${distribution.length} qaiməyə bölündü${toAdvance > 0 ? `, ${toAdvance.toFixed(2)} ₼ avans` : ""} — ${k.ad}`
                  : distribution.length === 1
                    ? `Qaimə #${distribution[0].nomre} ödənişi${toAdvance > 0 ? `, ${toAdvance.toFixed(2)} ₼ avans` : ""} — ${k.ad}`
                    : `Avans ödənişi — ${k.ad}`,
                d.qeyd || "",
              ].filter(Boolean).join(" "),
              yaradan_id: userId ?? null,
            },
            select: { id: true },
          });
          paymentOpId = op.id;

          // 3) payment_allocations — hər qaimə üçün ayrıca qeyd
          for (const dist of distribution) {
            await tx.finance_payment_allocations.create({
              data: {
                sahibkar_id: sahibkarId,
                payment_op_id: paymentOpId,
                satis_id: dist.sale_id,
                mebleg: dist.applied,
                qeyd: dist.closed
                  ? `Tam bağlandı (əvvəlki qalıq: ${dist.old_qalig.toFixed(2)})`
                  : `Qismən (əvvəlki: ${dist.old_qalig.toFixed(2)} → yeni: ${dist.new_qalig.toFixed(2)})`,
                yaradan_id: userId ?? null,
              },
            });
          }
        }

        // 4) Hər sənədin odenilmis + status update
        for (const dist of distribution) {
          await tx.satis_sifarisleri.update({
            where: { id: dist.sale_id },
            data: {
              odenilmis: { increment: dist.applied },
              ...(dist.closed ? { status: "tamamlandi" } : {}),
              yenilendi: new Date(),
            },
          });
        }

        // 5) Kontragent balansı — `alacaq` source-of-truth-dan derive olunur
        //    (yuxarıda satış.odenilmis artırıldığı üçün calc avtomatik düşür).
        //    Avans ayrı field — manual qalır.
        if (toAdvance > 0) {
          await tx.kontragentler.update({
            where: { id: d.musteri_id },
            data: {
              avans: { increment: toAdvance },
              son_temas: new Date(),
              yenilendi: new Date(),
            },
          });
        } else {
          await tx.kontragentler.update({
            where: { id: d.musteri_id },
            data: { son_temas: new Date(), yenilendi: new Date() },
          });
        }
        const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
        await recalculateCustomerBalance(d.musteri_id, tx);

        // 6) Hesab qaliqı — source-of-truth ilə yenilə (manual delta YOX)
        if (d.hesab_id) {
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          await recalculateAccountBalance(d.hesab_id, tx);
        }

        // 7) Audit
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId ?? null,
          emeliyyat: "nisye_odenish",
          resurs_nov: "kontragent",
          resurs_id: d.musteri_id,
          yeni_data: {
            mebleg: d.mebleg,
            total_applied: totalApplied,
            to_advance: toAdvance,
            qaime_id,
            distribution: distribution.map((dx) => ({
              sale_id: dx.sale_id,
              nomre: dx.nomre,
              applied: dx.applied,
              old_qalig: dx.old_qalig,
              new_qalig: dx.new_qalig,
              closed: dx.closed,
            })),
            hesab_id: d.hesab_id || null,
            odenis_nov: d.odenis_nov,
          },
        });
      });

      revalidatePath("/elaqe");
      revalidatePath("/elaqe/borclar");
      revalidatePath(`/elaqe/musteriler/${d.musteri_id}`);
      revalidatePath("/maliyye");
      revalidatePath("/maliyye/debitor");
      revalidatePath("/maliyye/emeliyyat");
      for (const dist of distribution) {
        revalidatePath(`/ticaret/satislar/${dist.sale_id}`);
      }
      bustMaliyyeCache();

      // Detallı mesaj — nə paylandı, nə avansa keçdi
      let msg: string | undefined;
      if (distribution.length === 0 && toAdvance > 0) {
        msg = `Açıq qaimə yoxdur. ${toAdvance.toFixed(2)} ₼ avans kimi saxlanıldı.`;
      } else if (distribution.length === 1 && toAdvance === 0) {
        const d0 = distribution[0];
        msg = d0.closed
          ? `Qaimə #${d0.nomre} tam bağlandı (${d0.applied.toFixed(2)} ₼).`
          : `Qaimə #${d0.nomre}-yə ${d0.applied.toFixed(2)} ₼ tətbiq, qalıq ${d0.new_qalig.toFixed(2)} ₼.`;
      } else if (distribution.length > 1) {
        const closedCount = distribution.filter((x) => x.closed).length;
        const partialCount = distribution.length - closedCount;
        msg = `${closedCount} qaimə tam${partialCount > 0 ? `, ${partialCount} qismən` : ""} bağlandı` +
          (toAdvance > 0 ? ` · ${toAdvance.toFixed(2)} ₼ avansa keçdi` : "");
      } else if (toAdvance > 0) {
        msg = `${toAdvance.toFixed(2)} ₼ avansa keçdi.`;
      }

      return { ok: true, id: d.musteri_id, ...(msg ? { message: msg } : {}) };
    } catch (e) {
      console.error("[receivePartialPayment]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/balans|hesab|tarix|mebleg|məbləğ|miqdar|tapılmadı|bağlı|təsdiq/i.test(raw)) {
        return { ok: false, error: raw };
      }
      return { ok: false, error: safeUserMessage(e, "Ödəniş alınmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// MARKETPLACE PAYOUT QƏBULU — pul bank hesabına oturduqda
// ───────────────────────────────────────────────────────────
const MarkPayoutReceivedSchema = z.object({
  payout_id: z.coerce.number().int().positive(),
  hesab_id: z.string().uuid(),
  faktiki_mebleg: z.coerce.number().positive(),
  tarix: z.string().min(8).optional().or(z.literal("")),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function markPayoutReceived(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["maliyye.idare", "marketplace.recon"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = MarkPayoutReceivedSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const payout = await prisma.finance_marketplace_payments.findFirst({
        where: { id: d.payout_id, sahibkar_id: sahibkarId },
        select: {
          id: true, platforma: true, gozlenen_meblegh: true, status: true,
          donem_baslama: true, donem_bitme: true,
        },
      });
      if (!payout) return { ok: false, error: "Payout qeydi tapılmadı" };
      if (payout.status === "odenildi") return { ok: false, error: "Bu payout artıq ödənilib" };

      const gozlenen = Number(payout.gozlenen_meblegh ?? 0);
      const ferq = +(d.faktiki_mebleg - gozlenen).toFixed(2);

      let payoutTarix: Date;
      if (d.tarix && /^\d{4}-\d{2}-\d{2}$/.test(d.tarix)) {
        const p = parseLocalDate(d.tarix);
        payoutTarix = p ?? new Date();
      } else {
        payoutTarix = new Date();
      }

      await prisma.$transaction(async (tx) => {
        // 1) Payout statusunu yenilə
        await tx.finance_marketplace_payments.update({
          where: { id: d.payout_id },
          data: {
            status: "odenildi",
            banka_dushen: d.faktiki_mebleg,
            ferq,
            qeyd: [
              `Payout qəbul edildi: ${d.faktiki_mebleg.toFixed(2)} ₼ (gözlənən ${gozlenen.toFixed(2)})`,
              Math.abs(ferq) > 0.01 ? `Fərq: ${ferq.toFixed(2)} ₼` : "",
              d.qeyd || "",
            ].filter(Boolean).join(" · "),
          },
        });

        // 2-3) QA-K18: əvvəl manual qaliq increment + (type yoxdursa) finance_op
        // YARANMIRDI → gələcək recalc balansı silirdi. İndi layihə standartı:
        // type findOrCreate → finance_operations → recalculateAccountBalance
        // (manual increment YOX — balans yalnız source-of-truth-dan).
        let type = await tx.finance_operation_types
          .findUnique({ where: { kod: "marketplace_payout" } })
          .catch(() => null);
        if (!type) {
          type = await tx.finance_operation_types.create({
            data: { kod: "marketplace_payout", ad: "Marketplace payout", qrup: "marketplace", y_n: "daxil" },
          });
        }
        await tx.finance_operations.create({
          data: {
            sahibkar_id: sahibkarId,
            type_id: type.id,
            type_kod: "marketplace_payout",
            y_n: "daxil",
            tarix: payoutTarix,
            meblegh: d.faktiki_mebleg,
            azn_meblegh: d.faktiki_mebleg,
            hesab_id: d.hesab_id,
            status: "aktiv",
            qarsi_teref_ad: payout.platforma,
            qeyd: `[PAYOUT:${payout.id}] ${payout.platforma} payout (gözlənən ${gozlenen.toFixed(2)} ₼, faktiki ${d.faktiki_mebleg.toFixed(2)} ₼)`,
            yaradan_id: userId ?? null,
            sened_nomresi: `MP-${payout.id}`,
          },
        });
        {
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          await recalculateAccountBalance(d.hesab_id, tx);
        }

        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId ?? null,
          emeliyyat: "payout_qebul",
          resurs_nov: "marketplace_payment",
          resurs_id: String(payout.id),
          yeni_data: {
            platforma: payout.platforma,
            gozlenen,
            faktiki: d.faktiki_mebleg,
            ferq,
            hesab_id: d.hesab_id,
          },
        });
      });

      revalidatePath("/maliyye/marketplace");
      revalidatePath("/maliyye/hesab");
      revalidatePath("/maliyye/emeliyyat");
      bustMaliyyeCache();
      return { ok: true, id: String(payout.id) };
    } catch (e) {
      console.error("[markPayoutReceived]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/tapılmadı|ödənilib/i.test(raw)) {
        return { ok: false, error: raw };
      }
      return { ok: false, error: safeUserMessage(e, "Payout qəbulu uğursuz oldu") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// TOPLU ÖDƏNİŞ — kontragentin bütün açıq qaimələrini FIFO ilə bağla
// ───────────────────────────────────────────────────────────
const PayAllOpenSchema = z.object({
  musteri_id: z.string().uuid(),
  mebleg: z.coerce.number().positive(),
  hesab_id: z.string().uuid().optional().or(z.literal("")),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function payAllOpenInvoices(
  input: FormData,
): Promise<{ ok: true; closed: number; partial: number; toAdvance: number } | { ok: false; error: string }> {
  const permCheck = await requireMaliyyeActionPerm("odenis.qebul");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = PayAllOpenSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findFirst({
        where: { id: d.musteri_id, sahibkar_id: sahibkarId },
        select: { id: true, ad: true },
      });
      if (!k) return { ok: false, error: "Müştəri tapılmadı" };

      // Açıq nisyə sənədləri — köhnədən yeniyə (FIFO)
      const openSales = await prisma.satis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          musteri_id: d.musteri_id,
          status: { not: "legv" },
          qaralama: { not: true },
          odenis_nov: { in: ["nisye", "borc"] },
        },
        orderBy: { tarix: "asc" },
        select: { id: true, son_mebleg: true, odenilmis: true, nomre: true },
      });

      // Yalnız açıq qalıqı olanları filtrlə
      const openWithQaliq = openSales
        .map((s) => ({
          id: s.id,
          nomre: s.nomre,
          qaliq: Math.max(0, Number(s.son_mebleg ?? 0) - Number(s.odenilmis ?? 0)),
        }))
        .filter((s) => s.qaliq > 0);

      if (openWithQaliq.length === 0) return { ok: false, error: "Açıq sənəd yoxdur" };

      let remain = d.mebleg;
      let closed = 0;
      let partial = 0;
      const distribution: Array<{ sale_id: string; nomre: string; applied: number; closed: boolean }> = [];

      for (const s of openWithQaliq) {
        if (remain <= 0.01) break;
        const apply = Math.min(remain, s.qaliq);
        distribution.push({
          sale_id: s.id,
          nomre: s.nomre,
          applied: +apply.toFixed(2),
          closed: apply >= s.qaliq - 0.01,
        });
        if (apply >= s.qaliq - 0.01) closed++;
        else partial++;
        remain -= apply;
      }
      const toAdvance = +Math.max(0, remain).toFixed(2);

      // Atomic transaction — bütün sənədlər və balanslar
      await prisma.$transaction(async (tx) => {
        for (const dist of distribution) {
          await tx.satis_sifarisleri.update({
            where: { id: dist.sale_id },
            data: {
              odenilmis: { increment: dist.applied },
              ...(dist.closed ? { status: "tamamlandi" } : {}),
              yenilendi: new Date(),
            },
          });
        }
        // Müştəri balansı — source-of-truth-dan derive olunur
        const balanceUpdate: Record<string, unknown> = {
          son_temas: new Date(),
          yenilendi: new Date(),
        };
        if (toAdvance > 0) balanceUpdate.avans = { increment: toAdvance };
        await tx.kontragentler.update({
          where: { id: d.musteri_id },
          data: balanceUpdate,
        });
        const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
        await recalculateCustomerBalance(d.musteri_id, tx);

        const type = await tx.finance_operation_types.findUnique({
          where: { kod: "qaime" },
          select: { id: true },
        });
        if (type) {
          const op = await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: "qaime",
              y_n: "daxil",
              tarix: new Date(),
              meblegh: d.mebleg,
              azn_meblegh: d.mebleg,
              hesab_id: d.hesab_id || null,
              kontragent_id: d.musteri_id,
              status: "aktiv",
              qeyd: `[TOPLU] ${distribution.length} sənəd bağlandı (${closed} tam, ${partial} qismən)${toAdvance > 0 ? ` + ${toAdvance.toFixed(2)} ₼ avans` : ""}${d.qeyd ? ` — ${d.qeyd}` : ""}`,
              yaradan_id: userId ?? null,
            },
            select: { id: true },
          });
          // payment_allocations — hər sənədə paylaşma qeydi
          for (const dist of distribution) {
            await tx.finance_payment_allocations.create({
              data: {
                sahibkar_id: sahibkarId,
                payment_op_id: op.id,
                satis_id: dist.sale_id,
                mebleg: dist.applied,
                qeyd: dist.closed ? "Tam bağlandı (FIFO)" : "Qismən (FIFO)",
                yaradan_id: userId ?? null,
              },
            });
          }
          // Source-of-truth hesab qaliqı yenilə
          if (d.hesab_id) {
            const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
            await recalculateAccountBalance(d.hesab_id, tx);
          }
        }
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId ?? null,
          emeliyyat: "toplu_odenis",
          resurs_nov: "kontragent",
          resurs_id: d.musteri_id,
          yeni_data: {
            mebleg: d.mebleg,
            sened_count: distribution.length,
            closed,
            partial,
            to_advance: toAdvance,
            hesab_id: d.hesab_id || null,
          },
        });
      });

      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/musteriler/${d.musteri_id}`);
      revalidatePath("/maliyye");
      revalidatePath("/maliyye/debitor");
      bustMaliyyeCache();
      return { ok: true, closed, partial, toAdvance };
    } catch (e) {
      console.error("[payAllOpenInvoices]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/tapılmadı|açıq|bağlı/i.test(raw)) {
        return { ok: false, error: raw };
      }
      return { ok: false, error: safeUserMessage(e, "Toplu ödəniş alınmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// TƏCHİZATÇI ÖDƏNİŞİ — açıq alış sənədlərini FIFO və ya konkret seçimlə bağla
// ───────────────────────────────────────────────────────────
const PaySupplierAllSchema = z.object({
  techizatci_id: z.string().uuid(),
  mebleg: z.coerce.number().positive(),
  hesab_id: z.string().uuid().optional().or(z.literal("")),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

export async function paySupplierAllOpen(
  input: FormData,
): Promise<{ ok: true; closed: number; partial: number } | { ok: false; error: string }> {
  const permCheck = await requireMaliyyeActionPerm("odenis.qebul");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = PaySupplierAllSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findFirst({
        where: { id: d.techizatci_id, sahibkar_id: sahibkarId },
        select: { id: true, ad: true },
      });
      if (!k) return { ok: false, error: "Təchizatçı tapılmadı" };

      const openPurchases = await prisma.alis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          techiazatci_id: d.techizatci_id,
          status: { not: "legv" },
        },
        orderBy: { tarix: "asc" },
        select: { id: true, umumi_mebleg: true, odenilmis: true, nomre: true },
      });

      const openWithQalig = openPurchases
        .map((s) => ({
          id: s.id,
          nomre: s.nomre,
          qalig: Math.max(0, Number(s.umumi_mebleg ?? 0) - Number(s.odenilmis ?? 0)),
        }))
        .filter((s) => s.qalig > 0);

      if (openWithQalig.length === 0) return { ok: false, error: "Açıq alış sənədi yoxdur" };

      let remain = d.mebleg;
      let closed = 0;
      let partial = 0;
      const distribution: Array<{ purchase_id: string; nomre: string; applied: number; closed: boolean }> = [];

      for (const p of openWithQalig) {
        if (remain <= 0.01) break;
        const apply = Math.min(remain, p.qalig);
        distribution.push({
          purchase_id: p.id,
          nomre: p.nomre,
          applied: +apply.toFixed(2),
          closed: apply >= p.qalig - 0.01,
        });
        if (apply >= p.qalig - 0.01) closed++;
        else partial++;
        remain -= apply;
      }

      await prisma.$transaction(async (tx) => {
        for (const dist of distribution) {
          await tx.alis_sifarisleri.update({
            where: { id: dist.purchase_id },
            data: {
              odenilmis: { increment: dist.applied },
              ...(dist.closed ? { status: "qebul_edildi" } : {}),
              yenilendi: new Date(),
            },
          });
        }
        const totalApplied = distribution.reduce((s, x) => s + x.applied, 0);

        // Təchizatçı balansı — source-of-truth recalc (alis_sifarisleri.odenilmis
        // artıq artırıldığı üçün hesablama avtomatik düz olur).
        await tx.kontragentler.update({
          where: { id: d.techizatci_id },
          data: {
            son_temas: new Date(),
            yenilendi: new Date(),
          },
        });
        const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
        await recalculateSupplierBalance(d.techizatci_id, tx);

        // 🛡️ Hesab qaliq yetərlilik yoxlaması (source-of-truth)
        if (d.hesab_id) {
          const { checkAccountSufficient } = await import("@/lib/balance/account-balance");
          const ok = await checkAccountSufficient(d.hesab_id, d.mebleg, tx);
          if (!ok.ok) {
            throw new Error(ok.error);
          }
        }

        const type = await tx.finance_operation_types.findUnique({
          where: { kod: "alis_odenis" },
          select: { id: true },
        });
        if (type) {
          const op = await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: "alis_odenis",
              y_n: "mexaric",
              tarix: new Date(),
              meblegh: d.mebleg,
              azn_meblegh: d.mebleg,
              hesab_id: d.hesab_id || null,
              kontragent_id: d.techizatci_id,
              status: "aktiv",
              qeyd: `[TOPLU] ${distribution.length} alış sənədi bağlandı (${closed} tam, ${partial} qismən)${d.qeyd ? ` — ${d.qeyd}` : ""}`,
              yaradan_id: userId ?? null,
            },
            select: { id: true },
          });
          for (const dist of distribution) {
            await tx.finance_payment_allocations.create({
              data: {
                sahibkar_id: sahibkarId,
                payment_op_id: op.id,
                alish_id: dist.purchase_id,
                mebleg: dist.applied,
                qeyd: dist.closed ? "Tam bağlandı (FIFO)" : "Qismən (FIFO)",
                yaradan_id: userId ?? null,
              },
            });
          }
          // Source-of-truth-dan qaliq cache-i yenilə
          if (d.hesab_id) {
            const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
            await recalculateAccountBalance(d.hesab_id, tx);
          }
        }
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId ?? null,
          emeliyyat: "techizatci_toplu_odenis",
          resurs_nov: "kontragent",
          resurs_id: d.techizatci_id,
          yeni_data: {
            mebleg: d.mebleg,
            sened_count: distribution.length,
            closed,
            partial,
            hesab_id: d.hesab_id || null,
          },
        });
      });

      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/techizatcilar/${d.techizatci_id}`);
      revalidatePath("/maliyye");
      revalidatePath("/maliyye/kreditor");
      bustMaliyyeCache();
      return { ok: true, closed, partial };
    } catch (e) {
      console.error("[paySupplierAllOpen]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/tapılmadı|açıq|bağlı/i.test(raw)) return { ok: false, error: raw };
      return { ok: false, error: safeUserMessage(e, "Toplu ödəniş alınmadı") };
    }
  });
}

const PaySupplierInvoiceSchema = z.object({
  techizatci_id: z.string().uuid(),
  alish_id: z.string().uuid(),
  mebleg: z.coerce.number().positive(),
  hesab_id: z.string().uuid().optional().or(z.literal("")),
  qeyd: z.string().max(500).optional().or(z.literal("")),
});

/** Konkret alış sənədinə ödəniş bağla. */
export async function paySupplierInvoice(
  input: FormData,
): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
  const permCheck = await requireMaliyyeActionPerm("odenis.qebul");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = PaySupplierInvoiceSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findFirst({
        where: { id: d.techizatci_id, sahibkar_id: sahibkarId },
        select: { id: true, ad: true },
      });
      if (!k) return { ok: false, error: "Təchizatçı tapılmadı" };

      // 🔁 CASCADE ALQORİTMİ — eyni müştəri tərəfindəki kimi
      // Seçilmiş alış sənədi əvvələ, qalan açıq alışlar FIFO ilə.
      const openPurchases = await prisma.alis_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          techiazatci_id: d.techizatci_id,
          status: { not: "legv" },
        },
        select: { id: true, nomre: true, umumi_mebleg: true, odenilmis: true, tarix: true },
        orderBy: { tarix: "asc" },
      });
      const openWithQalig = openPurchases
        .map((p) => ({
          id: p.id, nomre: p.nomre,
          qalig: +(Number(p.umumi_mebleg ?? 0) - Number(p.odenilmis ?? 0)).toFixed(2),
        }))
        .filter((p) => p.qalig > 0.01);

      // Seçilmiş alış sənədini yoxla
      const selected = openWithQalig.find((p) => p.id === d.alish_id);
      if (!selected) {
        return { ok: false, error: "Alış sənədi tapılmadı və ya artıq tam bağlıdır" };
      }
      const order = [selected, ...openWithQalig.filter((p) => p.id !== d.alish_id)];

      let remain = d.mebleg;
      const distribution: Array<{ purchase_id: string; nomre: string; old: number; applied: number; new: number; closed: boolean }> = [];
      for (const inv of order) {
        if (remain <= 0.01) break;
        const apply = Math.min(remain, inv.qalig);
        distribution.push({
          purchase_id: inv.id,
          nomre: inv.nomre,
          old: inv.qalig,
          applied: +apply.toFixed(2),
          new: +(inv.qalig - apply).toFixed(2),
          closed: apply >= inv.qalig - 0.01,
        });
        remain -= apply;
      }
      const totalApplied = +distribution.reduce((s, x) => s + x.applied, 0).toFixed(2);
      const overpay = +Math.max(0, remain).toFixed(2);

      await prisma.$transaction(async (tx) => {
        for (const dist of distribution) {
          await tx.alis_sifarisleri.update({
            where: { id: dist.purchase_id },
            data: {
              odenilmis: { increment: dist.applied },
              ...(dist.closed ? { status: "qebul_edildi" } : {}),
              yenilendi: new Date(),
            },
          });
        }
        // Təchizatçı balansı — source-of-truth recalc (alis_sifarisleri.odenilmis
        // artıq artırıldığı üçün hesablama avtomatik düz olur).
        await tx.kontragentler.update({
          where: { id: d.techizatci_id },
          data: {
            son_temas: new Date(),
            yenilendi: new Date(),
          },
        });
        const { recalculateSupplierBalance } = await import("@/lib/balance/supplier-balance");
        await recalculateSupplierBalance(d.techizatci_id, tx);
        // 🛡️ Hesab qaliq yetərlilik yoxlaması (source-of-truth)
        if (d.hesab_id) {
          const { checkAccountSufficient } = await import("@/lib/balance/account-balance");
          const ok = await checkAccountSufficient(d.hesab_id, d.mebleg, tx);
          if (!ok.ok) {
            throw new Error(ok.error);
          }
        }

        const type = await tx.finance_operation_types
          .findUnique({ where: { kod: "alis_odenis" }, select: { id: true } });
        if (type) {
          const op = await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: "alis_odenis",
              y_n: "mexaric",
              tarix: new Date(),
              meblegh: d.mebleg,
              azn_meblegh: d.mebleg,
              hesab_id: d.hesab_id || null,
              kontragent_id: d.techizatci_id,
              alish_id: distribution[0]?.purchase_id ?? d.alish_id,
              status: "aktiv",
              qeyd: distribution.length > 1
                ? `Ödəniş ${distribution.length} alış sənədinə bölündü${overpay > 0 ? `, ${overpay.toFixed(2)} ₼ artıq` : ""} — ${k.ad}`
                : `Alış #${distribution[0]?.nomre ?? "—"} ödənişi${overpay > 0 ? ` (artıq ${overpay.toFixed(2)} ₼)` : ""}${d.qeyd ? ` — ${d.qeyd}` : ""}`,
              yaradan_id: userId ?? null,
              sened_nomresi: distribution[0]?.nomre,
            },
            select: { id: true },
          });
          for (const dist of distribution) {
            await tx.finance_payment_allocations.create({
              data: {
                sahibkar_id: sahibkarId,
                payment_op_id: op.id,
                alish_id: dist.purchase_id,
                mebleg: dist.applied,
                qeyd: dist.closed
                  ? `Tam bağlandı (əvvəlki qalıq: ${dist.old.toFixed(2)})`
                  : `Qismən (əvvəlki: ${dist.old.toFixed(2)} → yeni: ${dist.new.toFixed(2)})`,
                yaradan_id: userId ?? null,
              },
            });
          }
          // Source-of-truth recalc
          if (d.hesab_id) {
            const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
            await recalculateAccountBalance(d.hesab_id, tx);
          }
        }
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId ?? null,
          emeliyyat: "techizatci_odenis",
          resurs_nov: "kontragent",
          resurs_id: d.techizatci_id,
          yeni_data: {
            mebleg: d.mebleg,
            total_applied: totalApplied,
            overpay,
            distribution: distribution.map((dx) => ({
              purchase_id: dx.purchase_id,
              nomre: dx.nomre,
              applied: dx.applied,
              old_qalig: dx.old,
              new_qalig: dx.new,
              closed: dx.closed,
            })),
            hesab_id: d.hesab_id || null,
          },
        });
      });

      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/techizatcilar/${d.techizatci_id}`);
      revalidatePath("/maliyye");
      revalidatePath("/maliyye/kreditor");
      for (const dist of distribution) {
        revalidatePath(`/ticaret/alislar/${dist.purchase_id}`);
      }
      bustMaliyyeCache();

      let msg: string | undefined;
      if (distribution.length === 1 && overpay === 0) {
        const d0 = distribution[0];
        msg = d0.closed
          ? `Alış #${d0.nomre} tam bağlandı (${d0.applied.toFixed(2)} ₼).`
          : `Alış #${d0.nomre}-yə ${d0.applied.toFixed(2)} ₼ tətbiq, qalıq ${d0.new.toFixed(2)} ₼.`;
      } else if (distribution.length > 1) {
        const closedCount = distribution.filter((x) => x.closed).length;
        const partialCount = distribution.length - closedCount;
        msg = `${closedCount} alış tam${partialCount > 0 ? `, ${partialCount} qismən` : ""} bağlandı` +
          (overpay > 0 ? ` · ${overpay.toFixed(2)} ₼ artıq qaldı` : "");
      } else if (overpay > 0) {
        msg = `${overpay.toFixed(2)} ₼ artıq qaldı (kreditor balansından çıxmadı).`;
      }

      return { ok: true, ...(msg ? { message: msg } : {}) };
    } catch (e) {
      console.error("[paySupplierInvoice]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/tapılmadı|aid|bağlı/i.test(raw)) return { ok: false, error: raw };
      return { ok: false, error: safeUserMessage(e, "Ödəniş alınmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// AVANSDAN ÖDƏNİŞ — kontragentin avansından sənədi bağla
// ───────────────────────────────────────────────────────────
const ApplyAdvanceSchema = z.object({
  musteri_id: z.string().uuid(),
  qaime_id: z.string().uuid(),
  mebleg: z.coerce.number().positive(),
});

export async function applyAdvanceToInvoice(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm("odenis.qebul");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };

  const parsed = ApplyAdvanceSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findFirst({
        where: { id: d.musteri_id, sahibkar_id: sahibkarId },
        select: { id: true, ad: true, avans: true, alacaq: true },
      });
      if (!k) return { ok: false, error: "Müştəri tapılmadı" };

      const avans = Number(k.avans ?? 0);
      if (avans <= 0) return { ok: false, error: "Müştərinin avansı yoxdur" };
      if (d.mebleg > avans + 0.01) {
        return { ok: false, error: `Avans (${avans.toFixed(2)} ₼) məbləğdən azdır` };
      }

      const sale = await prisma.satis_sifarisleri.findFirst({
        where: { id: d.qaime_id, sahibkar_id: sahibkarId },
        select: { son_mebleg: true, odenilmis: true, musteri_id: true },
      });
      if (!sale) return { ok: false, error: "Sənəd tapılmadı" };
      if (sale.musteri_id !== d.musteri_id) {
        return { ok: false, error: "Sənəd bu müştəriyə aid deyil" };
      }
      const qaliq = Math.max(0, Number(sale.son_mebleg ?? 0) - Number(sale.odenilmis ?? 0));
      if (qaliq <= 0) return { ok: false, error: "Sənəd artıq tam bağlıdır" };

      const apply = Math.min(d.mebleg, qaliq);

      await prisma.$transaction(async (tx) => {
        // 1) Sənədə yönəlmiş hissə qədər odenilmis artır + status auto-update
        const isFullPaid = apply >= qaliq - 0.01;
        await tx.satis_sifarisleri.update({
          where: { id: d.qaime_id },
          data: {
            odenilmis: { increment: apply },
            ...(isFullPaid ? { status: "tamamlandi" } : {}),
            yenilendi: new Date(),
          },
        });
        // 2) Avans azalır. Alacaq isə source-of-truth-dan derive olunur
        //    (yuxarıda satış.odenilmis artırıldığı üçün calc avtomatik düşür).
        await tx.kontragentler.update({
          where: { id: d.musteri_id },
          data: {
            avans: { decrement: apply },
            son_temas: new Date(),
            yenilendi: new Date(),
          },
        });
        const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
        await recalculateCustomerBalance(d.musteri_id, tx);
        // 3) finance_operations qeyd — avansdan tətbiq (informational, kassa hərəkəti yox)
        const type = await tx.finance_operation_types.findUnique({
          where: { kod: "qaime" },
          select: { id: true },
        });
        if (type) {
          const op = await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: type.id,
              type_kod: "qaime",
              y_n: "daxil",
              tarix: new Date(),
              meblegh: apply,
              azn_meblegh: apply,
              kontragent_id: d.musteri_id,
              satis_id: d.qaime_id,
              status: "aktiv",
              qeyd: `[AVANS] Avansdan tətbiq — ${k.ad}`,
              yaradan_id: userId ?? null,
            },
            select: { id: true },
          });
          // payment_allocations qeydi
          await tx.finance_payment_allocations.create({
            data: {
              sahibkar_id: sahibkarId,
              payment_op_id: op.id,
              satis_id: d.qaime_id,
              mebleg: apply,
              qeyd: "Avansdan tətbiq",
              yaradan_id: userId ?? null,
            },
          });
        }
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId ?? null,
          emeliyyat: "avans_tetbiq",
          resurs_nov: "kontragent",
          resurs_id: d.musteri_id,
          yeni_data: { mebleg: apply, qaime_id: d.qaime_id, avans_qaliq: avans - apply },
        });
      });

      revalidatePath("/elaqe");
      revalidatePath(`/elaqe/musteriler/${d.musteri_id}`);
      revalidatePath("/maliyye");
      revalidatePath("/maliyye/debitor");
      revalidatePath(`/ticaret/satislar/${d.qaime_id}`);
      bustMaliyyeCache();
      return { ok: true, id: d.musteri_id };
    } catch (e) {
      console.error("[applyAdvanceToInvoice]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/avans|tapılmadı|bağlı|azdır|aid/i.test(raw)) {
        return { ok: false, error: raw };
      }
      return { ok: false, error: safeUserMessage(e, "Avans tətbiqi alınmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// XƏRC + ALIŞ QAİMƏSİNƏ BAĞLAMA — proporsional bölgü ilə real maya
// ───────────────────────────────────────────────────────────
const ExpenseWithInvoiceSchema = z.object({
  kateqoriya_id: z.coerce.number().int().positive().optional(),
  tarix: z.string(),
  mebleg: z.coerce.number().positive(),
  odenis_nov: z.enum(["negd", "kart", "kecirme"]).default("negd"),
  tesvir: z.string().min(2).max(500),
  qebz_nomresi: z.string().max(50).optional().or(z.literal("")),
  alis_id: z.string().uuid().optional().or(z.literal("")),
  /** Hesab/kassa — seçilərsə qaliq azalır + finance_op yaranır */
  hesab_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

export async function saveExpenseWithInvoiceLink(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["xerc.yarat", "alis.bagla", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ExpenseWithInvoiceSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  const alis_id = d.alis_id || null;

  // 📅 Real-time tarix məcburiyyəti
  const { validateOperationDate } = await import("@/lib/operation-date-guard");
  const dateCheck = await validateOperationDate(d.tarix, { fieldLabel: "Xərc tarixi" });
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      // Compose qeyd with [INVOICE:<id>] tag if linked
      const qeydParts: string[] = [];
      if (alis_id) qeydParts.push(`[INVOICE:${alis_id}]`);
      const baseQeyd = qeydParts.join(" ");

      const created = await prisma.$transaction(async (tx) => {
        // 1) Hesab seçilibsə yetərliliyi yoxla
        if (d.hesab_id) {
          const { checkAccountSufficient } = await import("@/lib/balance/account-balance");
          const ok = await checkAccountSufficient(d.hesab_id, d.mebleg, tx);
          if (!ok.ok) throw new Error(ok.error);
        }

        // 2) Xərc qeyd
        const expense = await tx.xercl_r.create({
          data: {
            sahibkar_id: sahibkarId,
            kateqoriya_id: d.kateqoriya_id ?? null,
            tarix: parseLocalDate(d.tarix),
            mebleg: d.mebleg,
            odenis_nov: d.odenis_nov,
            tesvir: d.tesvir.trim(),
            qebz_nomresi: d.qebz_nomresi || null,
            qeyd: baseQeyd || null,
            istifadeci_id: userId ?? null,
          },
        });

        // 3) Hesab seçilibsə finance_operations + qaliq yenilənməsi
        if (d.hesab_id) {
          let xercType = await tx.finance_operation_types.findUnique({
            where: { kod: "xerc" },
            select: { id: true, kod: true },
          }).catch(() => null);
          if (!xercType) {
            xercType = await tx.finance_operation_types.create({
              data: { kod: "xerc", ad: "Xərc", qrup: "xercler", y_n: "mexaric" },
              select: { id: true, kod: true },
            });
          }
          await tx.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: xercType.id,
              type_kod: xercType.kod,
              y_n: "mexaric",
              tarix: parseLocalDate(d.tarix),
              meblegh: d.mebleg,
              azn_meblegh: d.mebleg,
              hesab_id: d.hesab_id,
              alish_id: alis_id,
              expense_kateq_id: d.kateqoriya_id ?? null,
              status: "aktiv",
              qeyd: `[XERC:${expense.id}]${alis_id ? ` [INVOICE:${alis_id}]` : ""} ${d.tesvir}`,
              yaradan_id: userId ?? null,
              sened_nomresi: d.qebz_nomresi || null,
            },
          });
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          await recalculateAccountBalance(d.hesab_id, tx);
        }

        return expense;
      });

      // If linked, distribute proportionally + recalc costs
      if (alis_id) {
        await applyExpenseToInvoice(alis_id, d.mebleg, d.tesvir.trim(), sahibkarId, userId ?? null);
      }

      revalidatePath("/maliyye");
      revalidatePath("/maliyye/xercler");
      if (alis_id) {
        revalidatePath(`/ticaret/alislar/${alis_id}`);
        revalidatePath("/ticaret/alislar");
      }
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[saveExpenseWithInvoiceLink]", e);
      return { ok: false, error: safeUserMessage(e, "Xərc yadda saxlanmadı") };
    }
  });
}

// Internal: distribute additional expense over invoice lines and update product cost
async function applyExpenseToInvoice(
  alis_id: string,
  mebleg: number,
  tesvir: string,
  sahibkarId: string,
  userId: string | null,
) {
  const lines = await prisma.alis_sifaris_satirlari.findMany({
    where: { sifaris_id: alis_id, sahibkar_id: sahibkarId },
    select: { id: true, mehsul_id: true, miqdar: true, vahid_qiymet: true, cemi: true, paylanan_xerc: true },
  });
  if (lines.length === 0) return;

  const total = lines.reduce((s, l) => s + Number(l.cemi ?? Number(l.miqdar) * Number(l.vahid_qiymet)), 0);
  if (total <= 0) return;

  // Update alis_sifarisleri.elave_xerc cumulatively
  try {
    await prisma.alis_sifarisleri.update({
      where: { id: alis_id },
      data: {
        elave_xerc: { increment: mebleg },
        xerc_qeyd: tesvir,
        yenilendi: new Date(),
      },
    });
  } catch (e) {
    console.warn("[applyExpenseToInvoice] elave_xerc update skipped:", e);
  }

  for (const line of lines) {
    const lineCemi = Number(line.cemi ?? Number(line.miqdar) * Number(line.vahid_qiymet));
    const miqdar = Number(line.miqdar);
    if (miqdar <= 0) continue;
    const share = (lineCemi / total) * mebleg; // proportional share of THIS expense
    const perUnit = share / miqdar;
    const newPaylanan = Number(line.paylanan_xerc ?? 0) + perUnit;
    const realMaya = Number(line.vahid_qiymet) + newPaylanan;

    try {
      await prisma.alis_sifaris_satirlari.update({
        where: { id: line.id },
        data: {
          paylanan_xerc: newPaylanan,
          real_maya_eded: realMaya,
        },
      });
    } catch (e) {
      console.warn("[applyExpenseToInvoice] line update skipped:", e);
    }

    if (line.mehsul_id) {
      await recalculateProductCostInternal(line.mehsul_id, sahibkarId);
    }
  }

  // audit log — outbox-safe
  await safeAuditLog({
    sahibkar_id: sahibkarId,
    istifadeci_id: userId,
    emeliyyat: "xerc_qaimeye_baglandi",
    resurs_nov: "alis_sifarisi",
    resurs_id: alis_id,
    yeni_data: { elave_xerc: mebleg, tesvir, sira_sayi: lines.length },
  });
}

// Internal: weighted-average product cost from purchase lines + real_maya_eded
async function recalculateProductCostInternal(mehsul_id: string, sahibkarId: string) {
  try {
    const lines = await prisma.alis_sifaris_satirlari.findMany({
      where: { mehsul_id, sahibkar_id: sahibkarId },
      select: { miqdar: true, vahid_qiymet: true, real_maya_eded: true, paylanan_xerc: true },
    });
    if (lines.length === 0) return;
    let totalQty = 0;
    let totalCost = 0;
    for (const l of lines) {
      const q = Number(l.miqdar);
      const real =
        l.real_maya_eded != null
          ? Number(l.real_maya_eded)
          : Number(l.vahid_qiymet) + Number(l.paylanan_xerc ?? 0);
      totalQty += q;
      totalCost += q * real;
    }
    if (totalQty <= 0) return;
    const weighted = totalCost / totalQty;
    await prisma.mehsullar.update({
      where: { id: mehsul_id },
      data: { alish_qiymeti: weighted, yenilendi: new Date() },
    });
  } catch (e) {
    console.warn("[recalculateProductCostInternal]", e);
  }
}

// Public action wrapper
export async function recalculateProductCost(mehsul_id: string): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["maliyye.idare", "mehsul.idare", "maya.hesab"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!mehsul_id) return { ok: false, error: "Məhsul ID tələb olunur" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      await recalculateProductCostInternal(mehsul_id, sahibkarId);
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: userId ?? null,
        emeliyyat: "maya_yenidenhesab",
        resurs_nov: "mehsul",
        resurs_id: mehsul_id,
        yeni_data: { reason: "manual" },
      });
      revalidatePath("/anbar/mehsullar");
      bustMaliyyeCache();
      return { ok: true, id: mehsul_id };
    } catch (e) {
      console.error("[recalculateProductCost]", e);
      return { ok: false, error: safeUserMessage(e, "Yenidən hesablanmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// THRESHOLD SAVE — ayarlar (sahibkar)
// ───────────────────────────────────────────────────────────
const ThresholdSchema = z.object({
  xerc: z.coerce.number().min(0).default(10000),
  transfer: z.coerce.number().min(0).default(50000),
  qaime: z.coerce.number().min(0).default(100000),
  maas: z.coerce.number().min(0).default(20000),
  default: z.coerce.number().min(0).default(25000),
});

export async function saveMaliyyeThresholds(input: FormData): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["maliyye.idare", "ayarlar.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ThresholdSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      // Köhnə dəyərləri oxu — audit diff üçün
      const prevRows = await prisma.ayarlar.findMany({
        where: { sahibkar_id: sahibkarId, qrup: "maliyye_threshold" },
        select: { acar: true, deyer: true },
      });
      const prev = Object.fromEntries(prevRows.map((r) => [r.acar, r.deyer]));
      const entries: Array<[string, number]> = [
        ["xerc", d.xerc],
        ["transfer", d.transfer],
        ["qaime", d.qaime],
        ["maas", d.maas],
        ["default", d.default],
      ];
      for (const [acar, deyer] of entries) {
        await prisma.ayarlar.upsert({
          where: {
            sahibkar_id_qrup_acar: {
              sahibkar_id: sahibkarId,
              qrup: "maliyye_threshold",
              acar,
            },
          },
          create: {
            sahibkar_id: sahibkarId,
            qrup: "maliyye_threshold",
            acar,
            deyer: String(deyer),
            nov: "number",
            tesvir: "Maliyyə təsdiq həddi (AZN)",
          },
          update: { deyer: String(deyer), yenilendi: new Date() },
        });
      }
      revalidatePath("/ayarlar/maliyye-threshold");
      bustMaliyyeCache();
      try {
        await audit("yenile", "maliyye_threshold", null, {
          evvelki_data: prev,
          yeni_data: d as unknown as Record<string, unknown>,
          sebeb: "Təsdiq həddləri yeniləndi",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[saveMaliyyeThresholds]", e);
      return { ok: false, error: safeUserMessage(e, "Yadda saxlanmadı") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// SENED ATTACHMENT — sil (yüklənmə API üzərindəndir)
// ───────────────────────────────────────────────────────────
export async function deleteFinanceAttachment(id: number): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["fin_op.idare", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!id || !Number.isFinite(id)) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // 🔒 Açıq sahibkar_id qoruması — operation_id-dən sahibkarId-ni doğrula
      const att = await prisma.finance_attachments.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: { id: true, operation_id: true, ad: true },
      });
      if (!att) return { ok: false, error: "Sənəd tapılmadı" };
      await prisma.finance_attachments.deleteMany({ where: { id, sahibkar_id: sahibkarId } });
      revalidatePath("/maliyye/emeliyyat");
      if (att.operation_id) revalidatePath(`/maliyye/emeliyyat/${att.operation_id}`);
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "sil",
          resurs_nov: "finance_attachment",
          resurs_id: String(id),
          evvelki_data: { ad: att.ad, operation_id: att.operation_id },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[deleteFinanceAttachment]", e);
      return { ok: false, error: safeUserMessage(e, "Silinmədi") };
    }
  });
}

// ───────────────────────────────────────────────────────────
// RECURRING — bu günü yoxla, vaxtı çatan əməliyyatları çoxalt
// ───────────────────────────────────────────────────────────
type RecurRule = {
  tezlik: string; // weekly / monthly / quarterly / bi_monthly / yearly
  son_tarix?: string | null;
  say?: number | null;
};

function parseRecurTag(qeyd: string | null): RecurRule | null {
  if (!qeyd) return null;
  const m = qeyd.match(/\[RECUR:([^\]]+)\]/i);
  if (!m) return null;
  const parts = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const tezlik = parts[0];
  let say: number | null = null;
  let son_tarix: string | null = null;
  for (const p of parts.slice(1)) {
    if (/^until=/i.test(p)) son_tarix = p.replace(/^until=/i, "");
    else if (/^\d+$/.test(p)) say = Number(p);
  }
  return { tezlik, son_tarix, say };
}

function nextRecurDate(from: Date, tezlik: string): Date {
  const d = new Date(from);
  switch (tezlik.toLowerCase()) {
    case "weekly":
    case "heftelik":
      d.setDate(d.getDate() + 7);
      break;
    case "bi_monthly":
    case "her_2_ay":
      d.setMonth(d.getMonth() + 2);
      break;
    case "quarterly":
    case "ruyublu":
    case "rublu":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
    case "illik":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "monthly":
    case "aylig":
    case "ayliq":
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

export async function runRecurringCheck(): Promise<{ ok: true; yaradilan: number } | { ok: false; error: string }> {
  const permCheck = await requireMaliyyeActionPerm(["recurring.icra", "maliyye.idare", "fin_op.yarat"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const rules = await prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          qeyd: { contains: "[RECUR:" },
          status: { in: ["aktiv", "gozleyen_tesdiq"] },
        },
        orderBy: { tarix: "desc" },
        take: 500,
      });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let yaradilan = 0;
      // Group rules by qeyd-template to find chain — use simpler heuristic: each finance_operations with RECUR is itself the template.
      // For each, find latest copy in chain (same type_kod + same recur_tag + same hesab_id).
      for (const rule of rules) {
        const tag = parseRecurTag(rule.qeyd ?? null);
        if (!tag) continue;
        if (tag.son_tarix) {
          const sonD = new Date(tag.son_tarix);
          if (!Number.isNaN(sonD.getTime()) && sonD < today) continue;
        }
        const last = await prisma.finance_operations.findFirst({
          where: {
            sahibkar_id: sahibkarId,
            type_kod: rule.type_kod,
            hesab_id: rule.hesab_id,
            meblegh: rule.meblegh,
            qeyd: { contains: "[RECUR_INST:" + rule.id + "]" },
          },
          orderBy: { tarix: "desc" },
        });
        const baseDate = last?.tarix ?? rule.tarix;
        const next = nextRecurDate(baseDate, tag.tezlik);
        if (next > today) continue;
        // Count existing instances if "say" specified
        if (tag.say && tag.say > 0) {
          const yaranan = await prisma.finance_operations.count({
            where: {
              sahibkar_id: sahibkarId,
              qeyd: { contains: "[RECUR_INST:" + rule.id + "]" },
            },
          });
          if (yaranan >= tag.say) continue;
        }
        // Duplicate the rule for `next` date
        try {
          await prisma.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: rule.type_id,
              type_kod: rule.type_kod,
              y_n: rule.y_n,
              tarix: next,
              meblegh: rule.meblegh,
              valyuta: rule.valyuta,
              mezenne: rule.mezenne,
              azn_meblegh: rule.azn_meblegh,
              hesab_id: rule.hesab_id,
              hesab_id2: rule.hesab_id2,
              meblegh2: rule.meblegh2,
              isci_id: rule.isci_id,
              kontragent_id: rule.kontragent_id,
              expense_kateq_id: rule.expense_kateq_id,
              status: "aktiv",
              qeyd: `[RECUR_INST:${rule.id}] ${rule.qeyd ?? ""}`.trim(),
              yaradan_id: userId ?? null,
            },
          });
          yaradilan++;
        } catch (e) {
          console.warn("[runRecurringCheck] create skipped:", e);
        }
      }
      if (yaradilan > 0) {
        revalidatePath("/maliyye/emeliyyat");
        revalidatePath("/maliyye");
        revalidatePath("/maliyye/recurring");
        bustMaliyyeCache();
      }
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId,
          emeliyyat: "recurring_run",
          resurs_nov: "recurring_rule",
          resurs_id: null,
          yeni_data: { yoxlanan: rules.length, yaradilan },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true as const, yaradilan };
    } catch (e) {
      console.error("[runRecurringCheck]", e);
      return { ok: false as const, error: safeUserMessage(e, "Təkrar yoxlama uğursuz") };
    }
  });
}

export async function disableRecurringRule(id: string): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["recurring.idare", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const op = await prisma.finance_operations.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: { qeyd: true },
      });
      if (!op) return { ok: false, error: "Tapılmadı" };
      const newQeyd = (op.qeyd ?? "").replace(/\[RECUR:[^\]]*\]/gi, "[RECUR_OFF]");
      const r = await prisma.finance_operations.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { qeyd: newQeyd, yenilendi: new Date() },
      });
      if (r.count === 0) return { ok: false, error: "Tapılmadı" };
      revalidatePath("/maliyye/recurring");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "sondur",
          resurs_nov: "recurring_rule",
          resurs_id: id,
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[disableRecurringRule]", e);
      return { ok: false, error: safeUserMessage(e, "Söndürülmədi") };
    }
  });
}

const ALLOWED_TEZLIK = ["weekly", "heftelik", "monthly", "aylig", "ayliq", "bi_monthly", "her_2_ay", "quarterly", "ruyublu", "rublu", "yearly", "illik"] as const;

export async function enableRecurringRule(id: string, tezlik: string): Promise<ActionResult> {
  const permCheck = await requireMaliyyeActionPerm(["recurring.idare", "maliyye.idare"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  if (!id) return { ok: false, error: "ID tələb olunur" };
  const cleanTezlik = tezlik.toLowerCase().trim();
  if (!ALLOWED_TEZLIK.includes(cleanTezlik as (typeof ALLOWED_TEZLIK)[number])) {
    return { ok: false, error: "Təkrar tezliyi yanlışdır" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const op = await prisma.finance_operations.findFirst({
        where: { id, sahibkar_id: sahibkarId },
        select: { qeyd: true },
      });
      if (!op) return { ok: false, error: "Tapılmadı" };
      const base = (op.qeyd ?? "").replace(/\[RECUR(?:_OFF)?(?::[^\]]*)?\]/gi, "").trim();
      const newQeyd = `[RECUR:${cleanTezlik}] ${base}`.trim();
      const r = await prisma.finance_operations.updateMany({
        where: { id, sahibkar_id: sahibkarId },
        data: { qeyd: newQeyd, yenilendi: new Date() },
      });
      if (r.count === 0) return { ok: false, error: "Tapılmadı" };
      revalidatePath("/maliyye/recurring");
      bustMaliyyeCache();
      try {
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          emeliyyat: "aktivlesdir",
          resurs_nov: "recurring_rule",
          resurs_id: id,
          yeni_data: { tezlik: cleanTezlik },
          status: "ugur",
        });
      } catch { /* non-fatal */ }
      return { ok: true };
    } catch (e) {
      console.error("[enableRecurringRule]", e);
      return { ok: false, error: safeUserMessage(e, "Aktivləşdirilmədi") };
    }
  });
}
