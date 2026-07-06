"use server";
import { prisma, Prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { permGate } from "@/lib/auth/role-check";
import { safeStockDecrement, stockIncrement } from "@/lib/db/stock-guards";
import { revalidatePath } from "next/cache";
import { ISTEHSAL_QRUP, RESEPT_ACAR_PREFIX, type ReceptKomponent } from "./istehsal";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Resept təyin et (0 komponent → sil). Komponentlər cari tenantə aid + hazır məhsuldan fərqli olmalıdır. */
export async function setRecipe(hazirMehsulId: string, komponentler: ReceptKomponent[]): Promise<Result> {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const g = permGate("anbar.idare", "mehsul.idare");
    if (!g.ok) return g;

    const hazir = await prisma.mehsullar.findFirst({ where: { id: hazirMehsulId, sahibkar_id: sahibkarId }, select: { id: true } });
    if (!hazir) return { ok: false, error: "Hazır məhsul tapılmadı" };

    const acar = RESEPT_ACAR_PREFIX + hazirMehsulId;
    const temiz = (komponentler ?? []).filter((k) => k.mehsul_id && Number(k.miqdar) > 0 && k.mehsul_id !== hazirMehsulId);
    if (temiz.length === 0) {
      await prisma.ayarlar.deleteMany({ where: { sahibkar_id: sahibkarId, qrup: ISTEHSAL_QRUP, acar } });
      revalidatePath("/anbar/istehsal");
      return { ok: true };
    }
    // Komponentlərin tenantə aid olduğunu təsdiqlə
    const ids = temiz.map((k) => k.mehsul_id);
    const mevcud = await prisma.mehsullar.findMany({ where: { id: { in: ids }, sahibkar_id: sahibkarId }, select: { id: true } });
    if (mevcud.length !== new Set(ids).size) return { ok: false, error: "Bəzi komponentlər tapılmadı" };

    const payload = JSON.stringify(temiz.map((k) => ({ mehsul_id: k.mehsul_id, miqdar: Number(k.miqdar) })));
    await prisma.ayarlar.upsert({
      where: { sahibkar_id_qrup_acar: { sahibkar_id: sahibkarId, qrup: ISTEHSAL_QRUP, acar } },
      update: { deyer: payload, yenilendi: new Date() },
      create: { sahibkar_id: sahibkarId, qrup: ISTEHSAL_QRUP, acar, deyer: payload, nov: "json", tesvir: "İstehsal resepti" },
    });
    revalidatePath("/anbar/istehsal");
    return { ok: true };
  });
}

/**
 * İSTEHSAL: `qty` ədəd hazır məhsul istehsal et. Resept komponentlərini anbardan çıxar (safeStockDecrement),
 * istehsal-mayanı hesabla (komponent maya cəmi), hazır məhsulu MOVING-AVERAGE maya ilə stoka əlavə et,
 * bütün hərəkətləri anbar_hereketleri-yə yaz (komponent mexaric + hazır medaxil, ref_nov="istehsal").
 */
export async function produceProduct(hazirMehsulId: string, qty: number, anbarId: number): Promise<Result<{ istehsal_maya: number; vahid_maya: number }>> {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    const g = permGate("anbar.idare", "mehsul.idare");
    if (!g.ok) return g;
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Miqdar 0-dan böyük olmalıdır" };
    if (!Number.isInteger(anbarId) || anbarId <= 0) return { ok: false, error: "Anbar seçilməyib" };

    // Resept oxu
    const row = await prisma.ayarlar.findFirst({
      where: { sahibkar_id: sahibkarId, qrup: ISTEHSAL_QRUP, acar: RESEPT_ACAR_PREFIX + hazirMehsulId },
      select: { deyer: true },
    });
    let komponentler: ReceptKomponent[] = [];
    if (row?.deyer) { try { komponentler = JSON.parse(row.deyer); } catch { /* */ } }
    if (!Array.isArray(komponentler) || komponentler.length === 0) return { ok: false, error: "Bu məhsulun resepti təyin olunmayıb" };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Komponent mayalarını oxu
        const ids = komponentler.map((k) => k.mehsul_id);
        const prods = await tx.mehsullar.findMany({ where: { id: { in: ids }, sahibkar_id: sahibkarId }, select: { id: true, ad: true, alish_qiymeti: true } });
        const prodMap = new Map(prods.map((p) => [p.id, p]));

        let toplamMaya = 0;
        // Hər komponenti çıxar
        for (const k of komponentler) {
          const p = prodMap.get(k.mehsul_id);
          if (!p) throw new Error("Komponent tapılmadı");
          const lazim = Number(k.miqdar) * qty;
          const dec = await safeStockDecrement(tx, { mehsulId: k.mehsul_id, anbarId, miqdar: lazim, mehsulAd: p.ad });
          if (!dec.ok) throw new Error(`«${p.ad}» stok çatmır: lazım ${lazim}, mövcud ${(dec as { current: number }).current}`);
          const setirMaya = Number(p.alish_qiymeti ?? 0) * lazim;
          toplamMaya += setirMaya;
          await tx.anbar_hereketleri.create({
            data: {
              sahibkar_id: sahibkarId, mehsul_id: k.mehsul_id, anbar_id: anbarId,
              nov: "mexaric", miqdar: lazim, qiymet: Number(p.alish_qiymeti ?? 0),
              ref_nov: "istehsal", ref_id: hazirMehsulId, edilen_id: istifadeciId,
              qeyd: `İstehsal sərfi: ${qty} ədəd hazır məhsul üçün`,
            },
          });
        }

        const vahidMaya = Math.round((toplamMaya / qty) * 10000) / 10000;

        // Hazır məhsul mayası — MOVING-AVERAGE (cari stok+maya ilə)
        const hazirProd = await tx.mehsullar.findFirst({ where: { id: hazirMehsulId, sahibkar_id: sahibkarId }, select: { alish_qiymeti: true } });
        const stokAgg = await tx.stok.aggregate({ where: { sahibkar_id: sahibkarId, mehsul_id: hazirMehsulId }, _sum: { miqdar: true } });
        const oldStok = Number(stokAgg._sum.miqdar ?? 0);
        // QA-audit: köhnə stok yoxdursa (oldStok<=0) köhnə maya əhəmiyyətsizdir → vahidMaya götür.
        // Əvvəl `Number(...)|| vahidMaya` köhnə stok VAR ikən qanuni 0 mayanı vahidMaya ilə əvəz edib
        // çəkili-orta mayanı korlayırdı. İndi yalnız stok olduqda köhnə maya işlədilir.
        const oldMaya = oldStok > 0 ? Number(hazirProd?.alish_qiymeti ?? 0) : vahidMaya;
        const yeniMaya = oldStok + qty > 0 ? (oldStok * oldMaya + qty * vahidMaya) / (oldStok + qty) : vahidMaya;

        // Hazır məhsulu stoka əlavə et
        await stockIncrement(tx, { sahibkarId, mehsulId: hazirMehsulId, anbarId, miqdar: qty, sonQiymet: vahidMaya });
        await tx.mehsullar.updateMany({ where: { id: hazirMehsulId, sahibkar_id: sahibkarId }, data: { alish_qiymeti: new Prisma.Decimal(yeniMaya.toFixed(4)) } });
        await tx.anbar_hereketleri.create({
          data: {
            sahibkar_id: sahibkarId, mehsul_id: hazirMehsulId, anbar_id: anbarId,
            nov: "medaxil", miqdar: qty, qiymet: vahidMaya,
            ref_nov: "istehsal", ref_id: hazirMehsulId, edilen_id: istifadeciId,
            qeyd: `İstehsal: ${qty} ədəd (vahid maya ${vahidMaya.toFixed(2)} ₼)`,
          },
        });

        return { istehsal_maya: Math.round(toplamMaya * 100) / 100, vahid_maya: vahidMaya };
      });

      revalidatePath("/anbar/istehsal");
      revalidatePath("/anbar/mehsullar");
      return { ok: true, data: result };
    } catch (e) {
      console.error("[produceProduct]", e);
      const raw = e instanceof Error ? e.message : "";
      if (/stok çatmır|tapılmadı|resept/i.test(raw)) return { ok: false, error: raw };
      return { ok: false, error: "İstehsal alınmadı" };
    }
  });
}
