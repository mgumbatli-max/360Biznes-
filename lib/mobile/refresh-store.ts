import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prismaUnscoped } from "@/lib/db/prisma";

const REFRESH_TTL_DAYS = 30;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function issueRefreshToken(sahibkarId: string, istifadeciId: string, cihaz?: string | null): Promise<string> {
  const raw = randomBytes(48).toString("base64url");
  await prismaUnscoped.mobil_refresh_tokens.create({
    data: {
      sahibkar_id: sahibkarId,
      istifadeci_id: istifadeciId,
      token_hash: hash(raw),
      // cihaz sütunu VarChar(120) — real user-agent çox uzun olur, kəsirik (login 500-ün qarşısı)
      cihaz: cihaz ? String(cihaz).slice(0, 120) : null,
      expires_at: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
    },
  });
  return raw;
}

/** Köhnəni revoke edib yenisini verir (rotation). Tapılmaz/bitmiş/revoke → null. */
export async function rotateRefreshToken(raw: string): Promise<{ sahibkarId: string; istifadeciId: string; cihaz: string | null; newRaw: string } | null> {
  const row = await prismaUnscoped.mobil_refresh_tokens.findUnique({ where: { token_hash: hash(raw) } });
  if (!row || row.revoked_at || row.expires_at < new Date()) return null;
  await prismaUnscoped.mobil_refresh_tokens.update({ where: { id: row.id }, data: { revoked_at: new Date() } });
  const newRaw = await issueRefreshToken(row.sahibkar_id, row.istifadeci_id, row.cihaz);
  return { sahibkarId: row.sahibkar_id, istifadeciId: row.istifadeci_id, cihaz: row.cihaz, newRaw };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prismaUnscoped.mobil_refresh_tokens.updateMany({ where: { token_hash: hash(raw) }, data: { revoked_at: new Date() } });
}
