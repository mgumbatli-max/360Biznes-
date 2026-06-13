import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { findSalesUsingProducts } from "@/lib/blockers/find-purchase-blockers";

/**
 * Bağlı əməliyyatlar (Linked Operations) — istənilən əməliyyat üçün ona
 * bağlı olan digər əməliyyatları (modul-arası) qaytarır.
 *
 * Bağ sahələri (tək həqiqət mənbəyi):
 *   - finance_operations.satis_id / .alish_id / .servis_id
 *   - qaytarma_sifarisleri.original_id + .nov
 *   - anbar_hereketleri.ref_nov + .ref_id
 *   - alis_sifaris_satirlari.mehsul_id (stok-based satış izi → findSalesUsingProducts)
 *
 * `blocks` = reverse-order qaydası: hədəf əməliyyatı ləğv etmək üçün əvvəlcə
 * həll olunmalı bağlı op (məs. satışı bloklayan ödəniş).
 */

export type LinkedOpType =
  | "satis"
  | "alis"
  | "maliyye"
  | "qaytarma"
  | "transfer"
  | "servis";

export type LinkedOp = {
  type: LinkedOpType;
  id: string;
  nomre: string;
  tarix: string | null; // ISO
  mebleg: number;
  status: string;
  rol: string; // "Ödəniş", "Bu malı satan satış", "Qaytarma", ...
  blocks: boolean;
  href: string; // deep-link (Bax fallback / yeni tab)
};

const num = (v: unknown): number => Number((v as number | null | undefined) ?? 0);
const iso = (d: Date | null | undefined): string | null => d?.toISOString() ?? null;

export async function getLinkedOperations(target: {
  type: LinkedOpType;
  id: string;
}): Promise<LinkedOp[]> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const out: LinkedOp[] = [];
    const seen = new Set<string>();
    const push = (op: LinkedOp) => {
      const k = op.type + ":" + op.id;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(op);
      }
    };

    // Maliyyə ödənişlərini (satis_id və ya alish_id üzrə) əlavə edən köməkçi.
    const pushPayments = async (key: "satis_id" | "alish_id") => {
      const pays = await prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          [key]: target.id,
          deleted_at: null,
          status: { not: "legv" },
        },
        select: {
          id: true,
          tarix: true,
          meblegh: true,
          azn_meblegh: true,
          qeyd: true,
          status: true,
        },
        orderBy: { tarix: "desc" },
        take: 30,
      });
      for (const p of pays) {
        push({
          type: "maliyye",
          id: p.id,
          nomre: p.qeyd?.slice(0, 40) || "Ödəniş",
          tarix: iso(p.tarix),
          mebleg: num(p.azn_meblegh ?? p.meblegh),
          status: p.status,
          rol: "Ödəniş",
          blocks: true,
          href: `/maliyye/emeliyyat?op=${p.id}`,
        });
      }
    };

    // Qaytarmaları (original_id + nov üzrə) əlavə edən köməkçi.
    const pushReturns = async (nov: "satis" | "alis") => {
      const rets = await prisma.qaytarma_sifarisleri.findMany({
        where: {
          sahibkar_id: sahibkarId,
          original_id: target.id,
          nov,
          deleted_at: null,
          status: { not: "legv" },
        },
        select: { id: true, nomre: true, tarix: true, umumi_mebleg: true, status: true },
        orderBy: { tarix: "desc" },
        take: 20,
      });
      for (const r of rets) {
        push({
          type: "qaytarma",
          id: r.id,
          nomre: r.nomre,
          tarix: iso(r.tarix),
          mebleg: num(r.umumi_mebleg),
          status: r.status ?? "",
          rol: "Qaytarma",
          blocks: false,
          href: `/ticaret/qaytarma?q=${r.id}`,
        });
      }
    };

    if (target.type === "satis") {
      // Ödənişlər (bloklayır) + qaytarmalar.
      await pushPayments("satis_id");
      await pushReturns("satis");
    }

    if (target.type === "alis") {
      // Bu alışın malını satan satışlar (stok-based) → bloklayır.
      const lines = await prisma.alis_sifaris_satirlari.findMany({
        where: { sahibkar_id: sahibkarId, sifaris_id: target.id },
        select: { mehsul_id: true },
      });
      const purchase = await prisma.alis_sifarisleri.findFirst({
        where: { id: target.id, sahibkar_id: sahibkarId },
        select: { anbar_id: true },
      });
      const mehsulIds = lines
        .map((l) => l.mehsul_id)
        .filter((v): v is string => !!v);
      const saleBlockers = await findSalesUsingProducts(
        mehsulIds,
        purchase?.anbar_id ?? null,
        prisma,
      );
      for (const b of saleBlockers) {
        const tarix =
          b.tarix instanceof Date
            ? b.tarix.toISOString()
            : typeof b.tarix === "string"
              ? b.tarix
              : null;
        push({
          type: "satis",
          id: b.id,
          nomre: b.label.split(" — ")[0] || b.id.slice(0, 8),
          tarix,
          mebleg: b.amount ?? 0,
          status: b.badge ?? "",
          rol: "Bu malı satan satış",
          blocks: true,
          href: b.href,
        });
      }
      // Ödənişlər (bloklayır) + qaytarmalar.
      await pushPayments("alish_id");
      await pushReturns("alis");
    }

    if (target.type === "maliyye") {
      const op = await prisma.finance_operations.findFirst({
        where: { id: target.id, sahibkar_id: sahibkarId },
        select: { satis_id: true, alish_id: true, servis_id: true },
      });
      if (op?.satis_id) {
        const s = await prisma.satis_sifarisleri.findFirst({
          where: { id: op.satis_id, sahibkar_id: sahibkarId },
          select: { id: true, nomre: true, tarix: true, son_mebleg: true, status: true },
        });
        if (s) {
          push({
            type: "satis",
            id: s.id,
            nomre: s.nomre,
            tarix: iso(s.tarix),
            mebleg: num(s.son_mebleg),
            status: s.status ?? "",
            rol: "Bağlı satış",
            blocks: false,
            href: `/ticaret/satislar/${s.id}`,
          });
        }
      }
      if (op?.alish_id) {
        const a = await prisma.alis_sifarisleri.findFirst({
          where: { id: op.alish_id, sahibkar_id: sahibkarId },
          select: { id: true, nomre: true, tarix: true, umumi_mebleg: true, status: true },
        });
        if (a) {
          push({
            type: "alis",
            id: a.id,
            nomre: a.nomre,
            tarix: iso(a.tarix),
            mebleg: num(a.umumi_mebleg),
            status: a.status ?? "",
            rol: "Bağlı alış",
            blocks: false,
            href: `/ticaret/alislar/${a.id}`,
          });
        }
      }
      if (op?.servis_id) {
        const sv = await prisma.servis_qeydleri.findFirst({
          where: { id: op.servis_id, sahibkar_id: sahibkarId },
          select: {
            id: true,
            nomre: true,
            yaradildi: true,
            status: true,
            musteriden_alinan: true,
          },
        });
        if (sv) {
          push({
            type: "servis",
            id: sv.id,
            nomre: sv.nomre,
            tarix: iso(sv.yaradildi),
            mebleg: num(sv.musteriden_alinan),
            status: sv.status ?? "",
            rol: "Bağlı servis",
            blocks: false,
            href: `/servis/${sv.id}`,
          });
        }
      }
    }

    if (target.type === "qaytarma") {
      // Orijinal sənəd (satış/alış) + əksetmə maliyyə ops.
      const q = await prisma.qaytarma_sifarisleri.findFirst({
        where: { id: target.id, sahibkar_id: sahibkarId },
        select: { original_id: true, nov: true },
      });
      if (q?.original_id && q.nov === "satis") {
        const s = await prisma.satis_sifarisleri.findFirst({
          where: { id: q.original_id, sahibkar_id: sahibkarId },
          select: { id: true, nomre: true, tarix: true, son_mebleg: true, status: true },
        });
        if (s) {
          push({
            type: "satis",
            id: s.id,
            nomre: s.nomre,
            tarix: iso(s.tarix),
            mebleg: num(s.son_mebleg),
            status: s.status ?? "",
            rol: "Orijinal satış",
            blocks: false,
            href: `/ticaret/satislar/${s.id}`,
          });
        }
      }
      if (q?.original_id && q.nov === "alis") {
        const a = await prisma.alis_sifarisleri.findFirst({
          where: { id: q.original_id, sahibkar_id: sahibkarId },
          select: { id: true, nomre: true, tarix: true, umumi_mebleg: true, status: true },
        });
        if (a) {
          push({
            type: "alis",
            id: a.id,
            nomre: a.nomre,
            tarix: iso(a.tarix),
            mebleg: num(a.umumi_mebleg),
            status: a.status ?? "",
            rol: "Orijinal alış",
            blocks: false,
            href: `/ticaret/alislar/${a.id}`,
          });
        }
      }
      // Əksetmə maliyyə əməliyyatları (qaytarma id-sinə bağlı ödəniş geri-qaytarması).
      const fin = await prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          OR: [{ satis_id: q?.original_id ?? undefined }, { alish_id: q?.original_id ?? undefined }],
          y_n: "xaric",
          deleted_at: null,
          status: { not: "legv" },
        },
        select: { id: true, tarix: true, meblegh: true, azn_meblegh: true, qeyd: true, status: true },
        orderBy: { tarix: "desc" },
        take: 20,
      });
      for (const p of fin) {
        push({
          type: "maliyye",
          id: p.id,
          nomre: p.qeyd?.slice(0, 40) || "Geri ödəniş",
          tarix: iso(p.tarix),
          mebleg: num(p.azn_meblegh ?? p.meblegh),
          status: p.status,
          rol: "Əksetmə",
          blocks: false,
          href: `/maliyye/emeliyyat?op=${p.id}`,
        });
      }
    }

    if (target.type === "transfer") {
      // Transferin stok hərəkətləri (ref_nov=transfer, ref_id=id).
      const moves = await prisma.anbar_hereketleri.findMany({
        where: { sahibkar_id: sahibkarId, ref_nov: "transfer", ref_id: target.id },
        select: { id: true, nov: true, miqdar: true, qeyd: true, yaradildi: true, anbar_id: true },
        orderBy: { yaradildi: "desc" },
        take: 30,
      });
      for (const m of moves) {
        push({
          type: "transfer",
          id: m.id,
          nomre: m.qeyd?.slice(0, 40) || `Anbar #${m.anbar_id ?? "—"}`,
          tarix: iso(m.yaradildi),
          mebleg: num(m.miqdar),
          status: m.nov ?? "",
          rol: "Stok hərəkəti",
          blocks: false,
          href: `/anbar/transfer`,
        });
      }
    }

    if (target.type === "servis") {
      // Servis geliri maliyyə ops (servis_id) + orijinal satış (satis_id).
      const finOps = await prisma.finance_operations.findMany({
        where: {
          sahibkar_id: sahibkarId,
          servis_id: target.id,
          deleted_at: null,
          status: { not: "legv" },
        },
        select: { id: true, tarix: true, meblegh: true, azn_meblegh: true, qeyd: true, status: true },
        orderBy: { tarix: "desc" },
        take: 30,
      });
      for (const p of finOps) {
        push({
          type: "maliyye",
          id: p.id,
          nomre: p.qeyd?.slice(0, 40) || "Servis geliri",
          tarix: iso(p.tarix),
          mebleg: num(p.azn_meblegh ?? p.meblegh),
          status: p.status,
          rol: "Servis geliri",
          blocks: false,
          href: `/maliyye/emeliyyat?op=${p.id}`,
        });
      }
      const sv = await prisma.servis_qeydleri.findFirst({
        where: { id: target.id, sahibkar_id: sahibkarId },
        select: { satis_id: true },
      });
      if (sv?.satis_id) {
        const s = await prisma.satis_sifarisleri.findFirst({
          where: { id: sv.satis_id, sahibkar_id: sahibkarId },
          select: { id: true, nomre: true, tarix: true, son_mebleg: true, status: true },
        });
        if (s) {
          push({
            type: "satis",
            id: s.id,
            nomre: s.nomre,
            tarix: iso(s.tarix),
            mebleg: num(s.son_mebleg),
            status: s.status ?? "",
            rol: "Orijinal satış",
            blocks: false,
            href: `/ticaret/satislar/${s.id}`,
          });
        }
      }
    }

    return out;
  });
}
