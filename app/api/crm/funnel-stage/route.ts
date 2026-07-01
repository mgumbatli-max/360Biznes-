import { NextResponse } from "next/server";
import { getFunnelLeadsForStage } from "@/features/crm/funnel-queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { requireCrmActionPerm } = await import("@/features/crm/access-guard");
  const permCheck = await requireCrmActionPerm("crm.oxu");
  if (!permCheck.ok) return NextResponse.json({ ok: false, error: permCheck.error }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  if (!status) return NextResponse.json({ ok: false, error: "status required" }, { status: 400 });
  const menecer = url.searchParams.get("menecer");
  const menbe = url.searchParams.get("menbe");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  try {
    const rows = await getFunnelLeadsForStage(status, {
      menecer_id: menecer || null,
      menbe: menbe || null,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    console.error("[funnel-stage]", e);
    return NextResponse.json({ ok: false, error: "fetch failed" }, { status: 500 });
  }
}
