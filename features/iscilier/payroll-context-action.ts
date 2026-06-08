"use server";

import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export type PayrollContext = {
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  aylik_maas: number;
  /** Bu və əvvəlki aylar üzrə ödənilməmiş bordro cəmi */
  qaliq_odenilmeli: number;
  son_odenis: { tarix: Date; mebleg: number; ay: number; il: number } | null;
  /** Cari il/ay üçün cədvəl */
  cari_ay: {
    il: number;
    ay: number;
    hesablanmis: number;
    odenilib: number;
    qaliq: number;
    bonus: number;
    cerime: number;
    avans: number;
    status: string;
  } | null;
};

export async function getPayrollContext(istifadeciId: string): Promise<PayrollContext | null> {
  if (!istifadeciId) return null;

  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const u = await prisma.istifadeciler.findFirst({
      where: { id: istifadeciId, sahibkar_id: sahibkarId },
      select: { id: true, ad_soyad: true, vezife: true, aylik_maas: true },
    });
    if (!u) return null;

    const now = new Date();
    const cariIl = now.getFullYear();
    const cariAy = now.getMonth() + 1;

    // Cari ay bordrosu
    const cariBordro = await prisma.maas_hesablamalar.findFirst({
      where: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        il: cariIl,
        ay: cariAy,
      },
      select: {
        son_meblegh: true,
        kpi_bonus: true,
        manual_bonus: true,
        cerime: true,
        avans: true,
        status: true,
      },
    }).catch(() => null);

    // Cari ay üçün ödənişlər
    const cariOdenisAgg = cariBordro
      ? await prisma.isci_odenisleri.aggregate({
          where: {
            sahibkar_id: sahibkarId,
            istifadeci_id: istifadeciId,
            yaradildi: {
              gte: new Date(cariIl, cariAy - 1, 1),
              lt: new Date(cariIl, cariAy, 1),
            },
          },
          _sum: { meblegh: true },
        }).catch(() => null)
      : null;

    const cariOdenilib = Number(cariOdenisAgg?._sum.meblegh ?? 0);
    const cariHesablanmis = Number(cariBordro?.son_meblegh ?? 0);

    // Bütün ödənilməmiş bordrolar (qaliq)
    const allUnpaidBordros = await prisma.maas_hesablamalar.findMany({
      where: {
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        status: { not: "odenilib" },
      },
      select: { son_meblegh: true, il: true, ay: true },
    }).catch(() => []);
    const qaliqOdenilmeli = allUnpaidBordros.reduce(
      (sum, b) => sum + Number(b.son_meblegh ?? 0),
      0,
    );

    // Son ödəniş
    const sonOdenisRow = await prisma.isci_odenisleri.findFirst({
      where: { sahibkar_id: sahibkarId, istifadeci_id: istifadeciId },
      orderBy: { yaradildi: "desc" },
      select: {
        meblegh: true, yaradildi: true,
        maas_hesablamalar: { select: { il: true, ay: true } },
      },
    }).catch(() => null);

    return {
      istifadeci_id: u.id,
      ad_soyad: u.ad_soyad,
      vezife: u.vezife,
      aylik_maas: Number(u.aylik_maas ?? 0),
      qaliq_odenilmeli: +qaliqOdenilmeli.toFixed(2),
      son_odenis: sonOdenisRow ? {
        tarix: sonOdenisRow.yaradildi ?? new Date(),
        mebleg: Number(sonOdenisRow.meblegh ?? 0),
        ay: sonOdenisRow.maas_hesablamalar?.ay ?? 0,
        il: sonOdenisRow.maas_hesablamalar?.il ?? 0,
      } : null,
      cari_ay: cariBordro ? {
        il: cariIl,
        ay: cariAy,
        hesablanmis: cariHesablanmis,
        odenilib: cariOdenilib,
        qaliq: +Math.max(0, cariHesablanmis - cariOdenilib).toFixed(2),
        bonus: Number(cariBordro.kpi_bonus ?? 0) + Number(cariBordro.manual_bonus ?? 0),
        cerime: Number(cariBordro.cerime ?? 0),
        avans: Number(cariBordro.avans ?? 0),
        status: cariBordro.status ?? "cernovik",
      } : null,
    };
  });
}
