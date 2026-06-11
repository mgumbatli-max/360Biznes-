import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type TransferRow = {
  id: string;
  nomre: string;
  tarix: Date;
  kaynak_anbar_ad: string;
  hedef_anbar_ad: string;
  umumi_miqdar: number;
  status: string;
  satir_say: number;
};

export type TransferFilter = {
  status?: string;
  kaynakId?: number;
  hedefId?: number;
  from?: string;
  to?: string;
  /** Soft-delete standart filter */
  recordStatus?: "aktiv" | "silinmis" | "hamisi";
};

export async function getTransfers(filter: TransferFilter = {}): Promise<TransferRow[]> {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    const rs = filter.recordStatus ?? "aktiv";
    if (rs === "aktiv") {
      where.deleted_at = null;
      // QA-standart: Aktiv = ləğv edilməmiş də (istifadəçi seçsə görünür)
      if (!filter.status || (Array.isArray(filter.status) && filter.status.length === 0)) where.status = { not: "legv" };
    }
    else if (rs === "silinmis") {
      // ləğvlilər də "silinmişlər"də görünür
      (where as Record<string, unknown>).AND = [ { OR: [ { deleted_at: { not: null } }, { status: "legv" } ] } ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.kaynakId) where.kaynak_anbar_id = filter.kaynakId;
    if (filter.hedefId) where.hedef_anbar_id = filter.hedefId;
    if (filter.from || filter.to) {
      const r: Record<string, Date> = {};
      if (filter.from) r.gte = new Date(filter.from);
      if (filter.to) {
        const end = new Date(filter.to);
        end.setHours(23, 59, 59, 999);
        r.lte = end;
      }
      where.tarix = r;
    }
    const rows = await prisma.anbar_transferleri.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: 200,
      include: {
        anbarlar_anbar_transferleri_kaynak_anbar_idToanbarlar: { select: { ad: true } },
        anbarlar_anbar_transferleri_hedef_anbar_idToanbarlar: { select: { ad: true } },
        transfer_satirlari: { select: { miqdar: true } },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      nomre: t.nomre,
      tarix: t.tarix,
      kaynak_anbar_ad: t.anbarlar_anbar_transferleri_kaynak_anbar_idToanbarlar?.ad ?? "—",
      hedef_anbar_ad: t.anbarlar_anbar_transferleri_hedef_anbar_idToanbarlar?.ad ?? "—",
      umumi_miqdar: t.transfer_satirlari.reduce((s, r) => s + Number(r.miqdar), 0),
      status: t.status ?? "tesdiqlenmemis",
      satir_say: t.transfer_satirlari.length,
    }));
  });
}

export async function getTransferOptions() {
  return withTenant(async () => {
    const [anbarlar, products] = await Promise.all([
      prisma.anbarlar.findMany({
        where: { aktiv: true },
        select: { id: true, ad: true, filial_id: true, filiallar: { select: { ad: true } } },
        orderBy: { ad: "asc" },
      }),
      prisma.mehsullar.findMany({
        where: { aktiv: true },
        select: { id: true, ad: true, kod: true, barkod: true },
        orderBy: { ad: "asc" },
        take: 1000,
      }),
    ]);
    return {
      anbarlar: anbarlar.map((a) => ({
        id: a.id,
        ad: a.ad,
        filial: a.filiallar?.ad ?? null,
      })),
      products,
    };
  });
}

