"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { formatNumber, formatDate } from "@/lib/utils";

export type JourneyItemDetail = {
  ref_id: string;
  title: string;
  subtitle: string | null;
  amount: number | null;
  amount_tone?: "success" | "danger" | "neutral";
  balance_info?: string | null;
  qeyd?: string | null;
  fields: Array<{
    label: string;
    value: string;
    icon?: "calendar" | "user" | "package" | "wallet" | "file" | "in" | "out";
  }>;
  lines?: Array<{ mehsul_ad: string; miqdar: number; qiymet: number; cemi: number }>;
  allocations?: Array<{ nomre: string; mebleg: number; href: string | null }>;
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return formatNumber(n, 2);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return formatDate(d);
}

export async function getJourneyItemDetail(
  kind: "sale" | "payment_in" | "payment_out" | "return" | "servis",
  refId: string,
): Promise<JourneyItemDetail | null> {
  const { requireElaqeActionPerm } = await import("./access-guard");
  if (!(await requireElaqeActionPerm("musteri.oxu")).ok) return null;
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    if (kind === "sale") {
      const s = await prisma.satis_sifarisleri.findFirst({
        where: { id: refId, sahibkar_id: sahibkarId },
        select: {
          id: true,
          nomre: true,
          tarix: true,
          son_mebleg: true,
          odenilmis: true,
          odenis_nov: true,
          status: true,
          qeyd: true,
          satis_sifaris_satirlari: {
            select: {
              miqdar: true,
              vahid_qiymet: true,
              cemi: true,
              mehsullar: { select: { ad: true } },
            },
          },
          istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler: {
            select: { ad_soyad: true },
          },
          anbarlar: { select: { ad: true } },
        },
      });
      if (!s) return null;
      const sonMebleg = Number(s.son_mebleg ?? 0);
      const odenilmis = Number(s.odenilmis ?? 0);
      const qalig = +(sonMebleg - odenilmis).toFixed(2);
      return {
        ref_id: s.id,
        title: `Satış #${s.nomre}`,
        subtitle: s.status === "tamamlandi" ? "Tam ödənilib" : qalig > 0 ? "Açıq qaimə" : "Bağlanıb",
        amount: sonMebleg,
        amount_tone: qalig > 0.01 ? "danger" : "success",
        balance_info: qalig > 0.01
          ? `Ödənilib ${fmt(odenilmis)} ₼ · Qalıq ${fmt(qalig)} ₼`
          : `Tam ödənilib (${fmt(odenilmis)} ₼)`,
        qeyd: s.qeyd,
        fields: [
          { label: "Tarix", value: fmtDate(s.tarix), icon: "calendar" },
          { label: "Ödəniş növü", value: s.odenis_nov ?? "—", icon: "wallet" },
          { label: "Status", value: s.status ?? "—", icon: "file" },
          { label: "Satıcı", value: s.istifadeciler_satis_sifarisleri_satis_meneceri_idToistifadeciler?.ad_soyad ?? "—", icon: "user" },
          { label: "Anbar", value: s.anbarlar?.ad ?? "—", icon: "package" },
        ],
        lines: (s.satis_sifaris_satirlari ?? []).map((l) => ({
          mehsul_ad: l.mehsullar?.ad ?? "—",
          miqdar: Number(l.miqdar),
          qiymet: Number(l.vahid_qiymet),
          cemi: Number(l.cemi ?? 0),
        })),
      };
    }

    if (kind === "payment_in" || kind === "payment_out") {
      const op = await prisma.finance_operations.findFirst({
        where: { id: refId, sahibkar_id: sahibkarId },
        select: {
          id: true,
          tarix: true,
          y_n: true,
          meblegh: true,
          type_kod: true,
          sened_nomresi: true,
          qeyd: true,
          maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari: {
            select: { ad: true, nov: true },
          },
          istifadeciler_finance_operations_yaradan_idToistifadeciler: {
            select: { ad_soyad: true },
          },
          finance_payment_allocations: {
            select: {
              mebleg: true,
              satis_id: true,
              alish_id: true,
              satis_sifarisleri: { select: { nomre: true } },
              alis_sifarisleri: { select: { nomre: true } },
            },
          },
        },
      });
      if (!op) return null;
      const mebleg = Number(op.meblegh ?? 0);
      const isIn = op.y_n === "daxil";
      const hesabAd = op.maliye_hesablari_finance_operations_hesab_idTomaliye_hesablari?.ad ?? "—";
      return {
        ref_id: op.id,
        title: isIn ? "Ödəniş daxil oldu" : "Ödəniş çıxdı",
        subtitle: op.sened_nomresi ? `Sənəd: ${op.sened_nomresi}` : null,
        amount: mebleg,
        amount_tone: isIn ? "success" : "danger",
        qeyd: op.qeyd,
        fields: [
          { label: "Tarix", value: fmtDate(op.tarix), icon: "calendar" },
          { label: "İstiqamət", value: isIn ? "Mədaxil" : "Məxariç", icon: isIn ? "in" : "out" },
          { label: "Hesab / kassa", value: hesabAd, icon: "wallet" },
          { label: "Növ", value: op.type_kod ?? "—", icon: "file" },
          { label: "İcra edən", value: op.istifadeciler_finance_operations_yaradan_idToistifadeciler?.ad_soyad ?? "—", icon: "user" },
        ],
        allocations: (op.finance_payment_allocations ?? []).map((a) => ({
          nomre: a.satis_sifarisleri?.nomre ?? a.alis_sifarisleri?.nomre ?? "—",
          mebleg: Number(a.mebleg),
          href: a.satis_id
            ? `/ticaret/satislar/${a.satis_id}`
            : a.alish_id
              ? `/ticaret/alislar/${a.alish_id}`
              : null,
        })),
      };
    }

    if (kind === "return") {
      const r = await prisma.qaytarma_sifarisleri.findFirst({
        where: { id: refId, sahibkar_id: sahibkarId },
        select: {
          id: true, nomre: true, tarix: true, umumi_mebleg: true,
          sebeb: true, qeyd: true,
          qaytarma_satirlari: {
            select: {
              miqdar: true, vahid_qiymet: true,
              mehsullar: { select: { ad: true } },
            },
          },
        },
      });
      if (!r) return null;
      return {
        ref_id: r.id,
        title: `Qaytarma #${r.nomre}`,
        subtitle: r.sebeb,
        amount: Number(r.umumi_mebleg ?? 0),
        qeyd: r.qeyd,
        fields: [
          { label: "Tarix", value: fmtDate(r.tarix), icon: "calendar" },
          { label: "Səbəb", value: r.sebeb ?? "—", icon: "file" },
        ],
        lines: (r.qaytarma_satirlari ?? []).map((l) => ({
          mehsul_ad: l.mehsullar?.ad ?? "—",
          miqdar: Number(l.miqdar),
          qiymet: Number(l.vahid_qiymet),
          cemi: Number(l.miqdar) * Number(l.vahid_qiymet),
        })),
      };
    }

    if (kind === "servis") {
      const sv = await prisma.servis_qeydleri.findFirst({
        where: { id: refId, sahibkar_id: sahibkarId },
        select: {
          id: true, nomre: true, yaradildi: true, status: true,
          mehsul_ad: true, problem_tesviri: true,
        },
      });
      if (!sv) return null;
      return {
        ref_id: sv.id,
        title: `Servis #${sv.nomre ?? sv.id.slice(0, 8)}`,
        subtitle: sv.status,
        amount: null,
        qeyd: sv.problem_tesviri,
        fields: [
          { label: "Tarix", value: fmtDate(sv.yaradildi), icon: "calendar" },
          { label: "Məhsul", value: sv.mehsul_ad ?? "—", icon: "package" },
          { label: "Status", value: sv.status ?? "—", icon: "file" },
        ],
      };
    }

    return null;
  });
}
