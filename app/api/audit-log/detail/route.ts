import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuditRowDetail } from "@/features/audit-log/security-queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id yoxdur" }, { status: 400 });
  let big: bigint;
  try {
    big = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Id yanlışdır" }, { status: 400 });
  }

  const row = await getAuditRowDetail(big);
  if (!row) return NextResponse.json({ error: "Tapılmadı" }, { status: 404 });

  // Serialize bigint → string
  return NextResponse.json({
    id: row.id.toString(),
    yaradildi: row.yaradildi,
    istifadeci: row.istifadeciler
      ? { id: row.istifadeciler.id, ad_soyad: row.istifadeciler.ad_soyad, email: row.istifadeciler.email }
      : { ad_soyad: row.istifadeci_ad ?? "—" },
    emeliyyat: row.emeliyyat,
    resurs_nov: row.resurs_nov,
    resurs_id: row.resurs_id,
    url: row.url,
    metod: row.metod,
    status: row.status,
    sebeb: row.sebeb,
    ip_adres: row.ip_adres,
    user_agent: row.user_agent,
    brauzer: row.brauzer,
    os: row.os,
    cihaz: row.cihaz,
    sessiya_id: row.sessiya_id,
    evvelki_data: row.evvelki_data,
    yeni_data: row.yeni_data,
  });
}
