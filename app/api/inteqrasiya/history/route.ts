import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const items = await withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.import_partiyalari.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: { yaradildi: "desc" },
      take: 100,
      include: {
        istifadeciler: { select: { ad_soyad: true, email: true } },
      },
    });
  });

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      sablon_nov: p.sablon_nov,
      fayl_adi: p.fayl_adi,
      status: p.status,
      cemi: p.cemi_satir,
      ugurlu: p.ugurlu_satir,
      yeni: p.yeni_satir,
      yenilenecek: p.yenilenecek,
      xeta: p.xeta_satir,
      yaradildi: p.yaradildi,
      tamamlandi_de: p.tamamlandi_de,
      istifadeci: p.istifadeciler?.ad_soyad ?? "—",
    })),
  });
}
