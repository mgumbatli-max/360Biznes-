"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { requireTicaretActionPerm } from "./access-guard";

export type OperationLineItem = {
  ad: string;
  kod: string | null;
  miqdar: number;
  qiymet: number;
  endirim_faiz?: number;
  cemi: number;
};

export type OperationPayment = {
  id: string;
  tarix: Date;
  mebleg: number;
  odenis_nov: string | null;
  hesab_ad: string | null;
  qeyd: string | null;
  status: string;
  yaradan_ad: string | null;
};

export type OperationAuditEntry = {
  id: string;
  emeliyyat: string;
  istifadeci_ad: string | null;
  yaradildi: Date | null;
  sebeb: string | null;
  status: string | null;
};

export type OperationDetailData = {
  ok: true;
  nov: "satis" | "alis";
  nomre: string;
  tarix: Date;
  status: string;
  kontragent_ad: string | null;
  anbar_ad: string | null;
  yaradan_ad: string | null;
  yaradildi: Date | null;
  yenilendi: Date | null;
  qeyd: string | null;
  umumi_mebleg: number;
  odenilmis: number;
  qaliq: number;
  odenis_nov: string | null;
  lines: OperationLineItem[];
  payments: OperationPayment[];
  audit: OperationAuditEntry[];
};

export type OperationDetailResult = OperationDetailData | { ok: false; error: string };

export async function getOperationDetailAction(
  nov: "satis" | "alis",
  id: string,
): Promise<OperationDetailResult> {
  const perm = nov === "satis" ? "satis.oxu" : "alis.oxu";
  const check = await requireTicaretActionPerm(perm);
  if (!check.ok) return { ok: false, error: check.error };

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    if (nov === "satis") {
      const sale = await prisma.satis_sifarisleri.findUnique({
        where: { id },
        include: {
          kontragentler: { select: { ad: true } },
          anbarlar: { select: { ad: true } },
          istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
          satis_sifaris_satirlari: {
            orderBy: { id: "asc" },
            include: { mehsullar: { select: { ad: true, kod: true } } },
          },
        },
      });
      if (!sale) return { ok: false, error: "Satış tapılmadı" };

      const payments = await prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          satis_id: id,
          type_kod: { in: ["satis_odenis", "musteri_odenis", "nisye_odenis"] },
        },
        orderBy: { tarix: "desc" },
        select: {
          id: true,
          tarix: true,
          meblegh: true,
          status: true,
          qeyd: true,
          maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: {
            select: { ad: true, nov: true },
          },
          istifadeciler_finance_operations_yaradan_idToistifadeciler: {
            select: { ad_soyad: true },
          },
        },
      });

      const audit = await prisma.audit_log.findMany({
        where: {
          sahibkar_id: sahibkarId,
          resurs_nov: "satis_sifarisi",
          resurs_id: id,
        },
        orderBy: { yaradildi: "desc" },
        take: 50,
        select: {
          id: true,
          emeliyyat: true,
          istifadeci_ad: true,
          istifadeciler: { select: { ad_soyad: true } },
          yaradildi: true,
          sebeb: true,
          status: true,
        },
      });

      const umumi = Number(sale.son_mebleg ?? 0);
      const odenilmis = Number(sale.odenilmis ?? 0);
      return {
        ok: true,
        nov: "satis",
        nomre: sale.nomre,
        tarix: sale.tarix,
        status: sale.status ?? "yeni",
        kontragent_ad: sale.kontragentler?.ad ?? null,
        anbar_ad: sale.anbarlar?.ad ?? null,
        yaradan_ad:
          sale.istifadeciler_satis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? null,
        yaradildi: sale.yaradildi ?? null,
        yenilendi: sale.yenilendi ?? null,
        qeyd: sale.qeyd ?? null,
        umumi_mebleg: umumi,
        odenilmis,
        qaliq: umumi - odenilmis,
        odenis_nov: sale.odenis_nov ?? null,
        lines: sale.satis_sifaris_satirlari.map((l) => ({
          ad: l.mehsullar?.ad ?? "—",
          kod: l.mehsullar?.kod ?? null,
          miqdar: Number(l.miqdar),
          qiymet: Number(l.vahid_qiymet ?? 0),
          endirim_faiz: Number(l.endirim_faiz ?? 0),
          cemi: Number(l.cemi ?? 0),
        })),
        payments: payments.map((p) => ({
          id: p.id,
          tarix: p.tarix,
          mebleg: Number(p.meblegh ?? 0),
          odenis_nov: p.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.nov ?? null,
          hesab_ad: p.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? null,
          qeyd: p.qeyd ?? null,
          status: p.status,
          yaradan_ad: p.istifadeciler_finance_operations_yaradan_idToistifadeciler?.ad_soyad ?? null,
        })),
        audit: audit.map((a) => ({
          id: String(a.id),
          emeliyyat: a.emeliyyat,
          istifadeci_ad: a.istifadeciler?.ad_soyad ?? a.istifadeci_ad ?? null,
          yaradildi: a.yaradildi,
          sebeb: a.sebeb ?? null,
          status: a.status ?? null,
        })),
      };
    }

    // alis
    const purchase = await prisma.alis_sifarisleri.findUnique({
      where: { id },
      include: {
        kontragentler: { select: { ad: true } },
        anbarlar: { select: { ad: true } },
        istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler: { select: { ad_soyad: true } },
        alis_sifaris_satirlari: {
          orderBy: { id: "asc" },
          include: { mehsullar: { select: { ad: true, kod: true } } },
        },
      },
    });
    if (!purchase) return { ok: false, error: "Alış tapılmadı" };

    const payments = await prisma.finance_operations.findMany({
      where: {
        sahibkar_id: sahibkarId,
        alish_id: id,
        type_kod: "alis_odenis",
      },
      orderBy: { tarix: "desc" },
      select: {
        id: true,
        tarix: true,
        meblegh: true,
        status: true,
        qeyd: true,
        maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: {
          select: { ad: true, nov: true },
        },
        istifadeciler_finance_operations_yaradan_idToistifadeciler: {
          select: { ad_soyad: true },
        },
      },
    });

    const audit = await prisma.audit_log.findMany({
      where: {
        sahibkar_id: sahibkarId,
        resurs_nov: "alis_sifarisi",
        resurs_id: id,
      },
      orderBy: { yaradildi: "desc" },
      take: 50,
      select: {
        id: true,
        emeliyyat: true,
        istifadeci_ad: true,
        istifadeciler: { select: { ad_soyad: true } },
        yaradildi: true,
        sebeb: true,
        status: true,
      },
    });

    const umumi = Number(purchase.umumi_mebleg ?? 0);
    const odenilmis = Number(purchase.odenilmis ?? 0);
    // Ödəniş növü inferensiyası — birinci aktiv bağlı op-dan
    const firstActivePayment = payments.find((p) => p.status === "aktiv");
    const odenis_nov_inferred = firstActivePayment
      ? firstActivePayment.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.nov ?? "negd"
      : odenilmis >= umumi && umumi > 0
        ? "negd"
        : "nisye";

    return {
      ok: true,
      nov: "alis",
      nomre: purchase.nomre,
      tarix: purchase.tarix,
      status: purchase.status ?? "gozlemede",
      kontragent_ad: purchase.kontragentler?.ad ?? null,
      anbar_ad: purchase.anbarlar?.ad ?? null,
      yaradan_ad:
        purchase.istifadeciler_alis_sifarisleri_yaradan_idToistifadeciler?.ad_soyad ?? null,
      yaradildi: purchase.yaradildi ?? null,
      yenilendi: purchase.yenilendi ?? null,
      qeyd: purchase.qeyd ?? null,
      umumi_mebleg: umumi,
      odenilmis,
      qaliq: umumi - odenilmis,
      odenis_nov: odenis_nov_inferred,
      lines: purchase.alis_sifaris_satirlari.map((l) => ({
        ad: l.mehsullar?.ad ?? "—",
        kod: l.mehsullar?.kod ?? null,
        miqdar: Number(l.miqdar),
        qiymet: Number(l.vahid_qiymet ?? 0),
        cemi: Number(l.cemi ?? 0),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        tarix: p.tarix,
        mebleg: Number(p.meblegh ?? 0),
        odenis_nov: p.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.nov ?? null,
        hesab_ad: p.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? null,
        qeyd: p.qeyd ?? null,
        status: p.status,
        yaradan_ad: p.istifadeciler_finance_operations_yaradan_idToistifadeciler?.ad_soyad ?? null,
      })),
      audit: audit.map((a) => ({
        id: String(a.id),
        emeliyyat: a.emeliyyat,
        istifadeci_ad: a.istifadeciler?.ad_soyad ?? a.istifadeci_ad ?? null,
        yaradildi: a.yaradildi,
        sebeb: a.sebeb ?? null,
        status: a.status ?? null,
      })),
    };
  });
}
