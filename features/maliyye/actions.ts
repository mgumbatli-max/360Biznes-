"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseLocalDate } from "@/lib/utils/date-parse";
import { createApprovalRequest, shouldApproveExpense } from "@/features/tesdiq/create";
import { safeAuditLog } from "@/lib/audit/safe-log";

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
});

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function saveExpense(input: FormData): Promise<ActionResult> {
  const parsed = ExpenseSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
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
      if (d.id) {
        const updated = await prisma.xercl_r.update({ where: { id: d.id }, data });
        id = updated.id;
      } else {
        const created = await prisma.xercl_r.create({ data: { sahibkar_id: sahibkarId, ...data } });
        id = created.id;
      }

      // Təsdiq tələbi (xərc) — yalnız yeni xərc yaradanda
      if (!d.id) {
        const { needed, limit } = await shouldApproveExpense(d.mebleg);
        if (needed) {
          await createApprovalRequest({
            emeliyyat_nov: "xerc",
            resurs_nov: "xerc",
            resurs_id: id,
            basliq: `Xərc: ${d.tesvir.slice(0, 80)}`,
            risk_sebeb: limit > 0
              ? `Xərc ${d.mebleg.toFixed(2)}₼ — limit ${limit}₼-i keçir`
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
        }
      }

      revalidatePath("/maliyye");
      revalidatePath("/maliyye/xercler");
      return { ok: true, id };
    } catch (e) {
      console.error("[saveExpense]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return withTenant(async () => {
    try {
      await prisma.xercl_r.delete({ where: { id } });
      revalidatePath("/maliyye/xercler");
      return { ok: true };
    } catch (e) {
      console.error("[deleteExpense]", e);
      return { ok: false, error: "Silinmədi" };
    }
  });
}

const CategorySchema = z.object({
  ad: z.string().min(1).max(100),
  reng: z.string().max(20).optional().or(z.literal("")),
});

export async function createExpenseCategory(input: FormData): Promise<ActionResult> {
  const parsed = CategorySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
      await prisma.xerc_kateqoriyalari.create({
        data: { sahibkar_id: sahibkarId, ad: parsed.data.ad, reng: parsed.data.reng || "#64748b" },
      });
      revalidatePath("/maliyye/xercler");
      return { ok: true };
    } catch (e) {
      console.error("[createExpenseCategory]", e);
      return { ok: false, error: "Yaradılmadı" };
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
  const parsed = AccountSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
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
          valyuta: d.valyuta,
          qeyd: d.qeyd || null,
          aktiv: true,
        },
      });
      revalidatePath("/maliyye/hesab");
      revalidatePath("/maliyye");
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[createAccount]", e);
      return { ok: false, error: "Hesab yaradılmadı" };
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
  tesisci_pul:      { qrup: "sahibkar",  ad: "Təsisçi pulu",          yon: "transfer", needHesab: true },
  tehtl_hesab:      { qrup: "sahibkar",  ad: "Tahtəl hesab",          yon: "transfer", needHesab: true },
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

  // Required-field validation per operation type
  if (meta.needHesab && !d.hesab_id) return { ok: false, error: "Hesab / kassa seçilməlidir" };
  if (meta.needHesab2 && !d.hesab_id2) return { ok: false, error: "Hədəf hesab seçilməlidir" };
  if (meta.needHesab2 && d.hesab_id && d.hesab_id2 && d.hesab_id === d.hesab_id2) {
    return { ok: false, error: "Mənbə və hədəf hesab eyni ola bilməz" };
  }
  if (meta.needIsci && !d.isci_id) return { ok: false, error: "İşçi seçilməlidir" };
  if (meta.needKontragent && !d.kontragent_id) return { ok: false, error: "Kontragent seçilməlidir" };

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

      // Update kontragent debt on debt-related payments (best-effort)
      // Yeni model:
      //   alacaq > 0 → müştəri bizə borclu (debitor)
      //   borc   > 0 → biz təchizatçıya borcluyuq (kreditor)
      if (d.kontragent_id) {
        const azn = d.mebleg * (d.mezenne || 1);
        let alacaqDelta = 0;
        switch (d.type_kod) {
          case "qaime":
          case "borc_silinme":
            // Müştəri ödəyir / silinir → onun bizə borcu (alacaq) azalır
            alacaqDelta = -azn;
            break;
          default:
            alacaqDelta = 0;
        }
        if (alacaqDelta !== 0) {
          try {
            await prisma.kontragentler.update({
              where: { id: d.kontragent_id },
              data: { alacaq: { increment: alacaqDelta }, yenilendi: new Date() },
            });
          } catch (e) {
            console.warn("[saveQuickOperation] alacaq update skipped:", e);
          }
        }
      }

      revalidatePath("/maliyye");
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye/hesab");
      revalidatePath("/maliyye/debitor");
      revalidatePath("/maliyye/kreditor");
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[saveQuickOperation]", e);
      return { ok: false, error: "Əməliyyat yadda saxlanmadı" };
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
  const parsed = BankCsvImportSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      await prisma.bank_cixarislari.create({
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
      return { ok: true };
    } catch (e) {
      console.error("[importBankStatement]", e);
      return { ok: false, error: "İdxal alınmadı" };
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
  const parsed = MarketplaceReconcileSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
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
      return { ok: true };
    } catch (e) {
      console.error("[startMarketplaceReconciliation]", e);
      return { ok: false, error: "Reconciliation icra edilmədi" };
    }
  });
}

// ───────────────────────────────────────────────────────────
// FIN_OPERATION — approve / reject / cancel
// ───────────────────────────────────────────────────────────
export async function approveOperation(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    const { istifadeciId: userId } = requireTenant();
    try {
      await prisma.finance_operations.update({
        where: { id },
        data: {
          status: "aktiv",
          tesdiq_eden_id: userId ?? null,
          tesdiq_de: new Date(),
          yenilendi: new Date(),
        },
      });
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      return { ok: true, id };
    } catch (e) {
      console.error("[approveOperation]", e);
      return { ok: false, error: "Təsdiqlənmədi" };
    }
  });
}

export async function rejectOperation(id: string, sebeb?: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    const { istifadeciId: userId } = requireTenant();
    try {
      await prisma.finance_operations.update({
        where: { id },
        data: {
          status: "redd",
          legv_eden_id: userId ?? null,
          legv_de: new Date(),
          legv_sebeb: sebeb || null,
          yenilendi: new Date(),
        },
      });
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      return { ok: true, id };
    } catch (e) {
      console.error("[rejectOperation]", e);
      return { ok: false, error: "Rədd edilmədi" };
    }
  });
}

export async function cancelOperation(id: string, sebeb?: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    const { istifadeciId: userId } = requireTenant();
    try {
      await prisma.finance_operations.update({
        where: { id },
        data: {
          status: "legv",
          legv_eden_id: userId ?? null,
          legv_de: new Date(),
          legv_sebeb: sebeb || null,
          yenilendi: new Date(),
        },
      });
      revalidatePath("/maliyye/emeliyyat");
      revalidatePath("/maliyye");
      return { ok: true, id };
    } catch (e) {
      console.error("[cancelOperation]", e);
      return { ok: false, error: "Ləğv edilmədi" };
    }
  });
}

// ───────────────────────────────────────────────────────────
// GUN SONU — günü bağla
// ───────────────────────────────────────────────────────────
export async function closeGunSonu(): Promise<ActionResult> {
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
          where: { sahibkar_id: sahibkarId, tarix: { gte: today } },
          _sum: { mebleg: true },
        }),
        prisma.kassalar.aggregate({
          where: { sahibkar_id: sahibkarId, status: "acig" },
          _sum: { acilis_qaligi: true },
        }),
      ]);
      const satis = Number(salesAgg._sum.odenilmis ?? 0);
      const xerc = Number(expenseAgg._sum.mebleg ?? 0);
      const kassaQaliq = Number(kassaAgg._sum.acilis_qaligi ?? 0);

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
      return { ok: true };
    } catch (e) {
      console.error("[closeGunSonu]", e);
      return { ok: false, error: "Gün bağlanmadı" };
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
});

export async function receivePartialPayment(input: FormData): Promise<ActionResult> {
  const parsed = ReceivePaymentSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      const k = await prisma.kontragentler.findFirst({
        where: { id: d.musteri_id, sahibkar_id: sahibkarId },
        select: { id: true, ad: true, borc: true },
      });
      if (!k) return { ok: false, error: "Müştəri tapılmadı" };

      const qaime_id = d.qaime_id || null;
      const typeKod = "qaime";

      // Atomic transaction
      await prisma.$transaction(async (tx) => {
        // 1) Find or create operation type
        let type = await tx.finance_operation_types
          .findUnique({ where: { kod: typeKod } })
          .catch(() => null);
        if (!type) {
          type = await tx.finance_operation_types
            .create({
              data: {
                kod: typeKod,
                ad: "Qaimə",
                qrup: "qaime",
                y_n: "daxil",
              },
            })
            .catch(() => null);
        }

        // 2) Create finance_operations record (link satis_id when given)
        if (type) {
          await tx.finance_operations.create({
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
              satis_id: qaime_id,
              qeyd:
                d.qeyd ||
                (qaime_id ? `Qaimə ödənişi — ${k.ad}` : `Borc ödənişi — ${k.ad}`),
              yaradan_id: userId ?? null,
            },
          });
        }

        // 3) Update satis_sifarisleri.odenilmis (if qaime_id provided)
        if (qaime_id) {
          await tx.satis_sifarisleri.update({
            where: { id: qaime_id },
            data: { odenilmis: { increment: d.mebleg }, yenilendi: new Date() },
          });
        }

        // 4) Müştəri ödəyir nisyə üçün → onun bizə borcu (alacaq) azalır
        await tx.kontragentler.update({
          where: { id: d.musteri_id },
          data: { alacaq: { decrement: d.mebleg }, son_temas: new Date(), yenilendi: new Date() },
        });

        // 5) audit_log — outbox fallback varsa səssizcə itmir
        await safeAuditLog({
          sahibkar_id: sahibkarId,
          istifadeci_id: userId ?? null,
          emeliyyat: "nisye_odenish",
          resurs_nov: "kontragent",
          resurs_id: d.musteri_id,
          yeni_data: {
            mebleg: d.mebleg,
            qaime_id,
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
      if (qaime_id) revalidatePath(`/ticaret/satislar/${qaime_id}`);
      return { ok: true, id: d.musteri_id };
    } catch (e) {
      console.error("[receivePartialPayment]", e);
      return { ok: false, error: "Ödəniş alınmadı" };
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
});

export async function saveExpenseWithInvoiceLink(input: FormData): Promise<ActionResult> {
  const parsed = ExpenseWithInvoiceSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  const alis_id = d.alis_id || null;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId: userId } = requireTenant();
    try {
      // Compose qeyd with [INVOICE:<id>] tag if linked
      const qeydParts: string[] = [];
      if (alis_id) qeydParts.push(`[INVOICE:${alis_id}]`);
      const baseQeyd = qeydParts.join(" ");

      const created = await prisma.xercl_r.create({
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
      return { ok: false, error: "Xərc yadda saxlanmadı" };
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
      return { ok: true, id: mehsul_id };
    } catch (e) {
      console.error("[recalculateProductCost]", e);
      return { ok: false, error: "Yenidən hesablanmadı" };
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
  const parsed = ThresholdSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    try {
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
      return { ok: true };
    } catch (e) {
      console.error("[saveMaliyyeThresholds]", e);
      return { ok: false, error: "Yadda saxlanmadı" };
    }
  });
}

// ───────────────────────────────────────────────────────────
// SENED ATTACHMENT — sil (yüklənmə API üzərindəndir)
// ───────────────────────────────────────────────────────────
export async function deleteFinanceAttachment(id: number): Promise<ActionResult> {
  if (!id || !Number.isFinite(id)) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    try {
      const att = await prisma.finance_attachments.findUnique({
        where: { id },
        select: { id: true, operation_id: true },
      });
      if (!att) return { ok: false, error: "Sənəd tapılmadı" };
      await prisma.finance_attachments.delete({ where: { id } });
      revalidatePath("/maliyye/emeliyyat");
      if (att.operation_id) revalidatePath(`/maliyye/emeliyyat/${att.operation_id}`);
      return { ok: true };
    } catch (e) {
      console.error("[deleteFinanceAttachment]", e);
      return { ok: false, error: "Silinmədi" };
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
      }
      return { ok: true as const, yaradilan };
    } catch (e) {
      console.error("[runRecurringCheck]", e);
      return { ok: false as const, error: "Təkrar yoxlama uğursuz" };
    }
  });
}

export async function disableRecurringRule(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    try {
      const op = await prisma.finance_operations.findUnique({
        where: { id },
        select: { qeyd: true },
      });
      if (!op) return { ok: false, error: "Tapılmadı" };
      const newQeyd = (op.qeyd ?? "").replace(/\[RECUR:[^\]]*\]/gi, "[RECUR_OFF]");
      await prisma.finance_operations.update({
        where: { id },
        data: { qeyd: newQeyd, yenilendi: new Date() },
      });
      revalidatePath("/maliyye/recurring");
      return { ok: true };
    } catch (e) {
      console.error("[disableRecurringRule]", e);
      return { ok: false, error: "Söndürülmədi" };
    }
  });
}

export async function enableRecurringRule(id: string, tezlik: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "ID tələb olunur" };
  return withTenant(async () => {
    try {
      const op = await prisma.finance_operations.findUnique({
        where: { id },
        select: { qeyd: true },
      });
      if (!op) return { ok: false, error: "Tapılmadı" };
      const base = (op.qeyd ?? "").replace(/\[RECUR(?:_OFF)?(?::[^\]]*)?\]/gi, "").trim();
      const newQeyd = `[RECUR:${tezlik}] ${base}`.trim();
      await prisma.finance_operations.update({
        where: { id },
        data: { qeyd: newQeyd, yenilendi: new Date() },
      });
      revalidatePath("/maliyye/recurring");
      return { ok: true };
    } catch (e) {
      console.error("[enableRecurringRule]", e);
      return { ok: false, error: "Aktivləşdirilmədi" };
    }
  });
}
