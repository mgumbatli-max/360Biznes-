import { NextRequest } from "next/server";
import { z } from "zod";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { openKassa, closeKassa } from "@/features/pos/session-actions";

const OpenSchema = z.object({
  ad: z.string().trim().min(1).max(100).default("Mobil kassa"),
  acilis_qaligi: z.coerce.number().min(0).default(0),
});

/** POST — kassa aç (POS sessiyası). openKassa öz tenant kontekstini reuse edir. */
export async function POST(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "pos.satis", "satis.idare")) {
      return { ok: false, error: "Kassa açmaq üçün icazə yoxdur" };
    }
    const body = await req.json().catch(() => ({}));
    const parsed = OpenSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
    return openKassa(parsed.data);
  });
}

const CloseSchema = z.object({
  kassa_id: z.string().uuid(),
  hesablanan_qaliq: z.coerce.number().min(0),
  qeyd: z.string().max(2000).optional(),
});

/** PATCH — kassa bağla (gün sonu). */
export async function PATCH(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "pos.satis", "satis.idare")) {
      return { ok: false, error: "Kassa bağlamaq üçün icazə yoxdur" };
    }
    const body = await req.json().catch(() => ({}));
    const parsed = CloseSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
    const { kassa_id, ...rest } = parsed.data;
    return closeKassa(kassa_id, rest);
  });
}
