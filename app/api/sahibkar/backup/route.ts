import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { touchPinSession } from "@/lib/sahibkar/session";

export const dynamic = "force-dynamic";

/**
 * Sahibkar backup — bütün tenant data-sını JSON faylına eksport edir.
 * Yalnız sahibkar (rol_id=9) + aktiv PIN sessiyası ilə.
 *
 * Format: JSON, key-də cədvəl adı, value-da sətr massivi.
 * Decimal/BigInt avtomatik string-ə çevrilir (JSON.stringify replacer ilə).
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.rol_id !== 9) {
    return NextResponse.json({ error: "Yalnız sahibkar" }, { status: 403 });
  }
  const pinSession = await touchPinSession();
  if (!pinSession) {
    return NextResponse.json({ error: "PIN sessiyası tələb olunur" }, { status: 403 });
  }

  try {
    const data = await withTenant(async () => {
      const { sahibkarId } = requireTenant();
      const w = { where: { sahibkar_id: sahibkarId } };

      // Real data — gizli mod scale tətbiq olunmur
      const [
        satislar, satisSatirlar, alislar, alisSatirlar,
        mehsullar, stok, anbarlar,
        kontragentler, financeOps, xercler, kassalar, hesablar,
        istifadeciler, davamiyyet, maas, auditLog,
      ] = await Promise.all([
        prisma.satis_sifarisleri.findMany(w),
        prisma.satis_sifaris_satirlari.findMany(w),
        prisma.alis_sifarisleri.findMany(w),
        prisma.alis_sifaris_satirlari.findMany(w),
        prisma.mehsullar.findMany(w),
        prisma.stok.findMany(w),
        prisma.anbarlar.findMany(w),
        prisma.kontragentler.findMany(w),
        prisma.finance_operations.findMany(w),
        prisma.xercl_r.findMany(w),
        prisma.kassalar.findMany(w),
        prisma.maliye_hesablari.findMany(w),
        prisma.istifadeciler.findMany({
          ...w,
          // Şifrə hash-ı eksport etmə — təhlükəsizlik
          select: {
            id: true, ad_soyad: true, email: true, telefon: true, rol_id: true,
            aktiv: true, vezife: true, aylik_maas: true, ise_baslama: true,
            dogum_tarixi: true, fin_kod: true, unvan: true, profil_sekil: true,
            yaradildi: true, isden_cixdi: true,
          },
        }),
        prisma.davamiyyet.findMany(w),
        prisma.maas_hesablamalar.findMany(w),
        prisma.audit_log.findMany({ ...w, take: 5000, orderBy: { yaradildi: "desc" } }),
      ]);

      return {
        meta: {
          format_version: "1.0",
          eksport_tarixi: new Date().toISOString(),
          sahibkar_id: sahibkarId,
          stealth_mode: false, // backup həmişə real data
          istifadeci: session.user.email,
        },
        cedvellar: {
          satis_sifarisleri: satislar,
          satis_sifaris_satirlari: satisSatirlar,
          alis_sifarisleri: alislar,
          alis_sifaris_satirlari: alisSatirlar,
          mehsullar,
          stok,
          anbarlar,
          kontragentler,
          finance_operations: financeOps,
          xercl_r: xercler,
          kassalar,
          maliye_hesablari: hesablar,
          istifadeciler,
          davamiyyet,
          maas_hesablamalar: maas,
          audit_log: auditLog,
        },
      };
    });

    // JSON-ifier — Decimal və BigInt-i string-ə çevir
    const json = JSON.stringify(data, (_, v) => {
      if (typeof v === "bigint") return v.toString();
      if (v && typeof v === "object" && "constructor" in v && v.constructor?.name === "Decimal") {
        return Number(v.toString());
      }
      return v;
    }, 2);

    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `360biznes-backup-${dateStr}.json`;

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[backup]", e);
    return NextResponse.json({ error: "Backup alınmadı" }, { status: 500 });
  }
}
