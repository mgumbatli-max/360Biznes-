import "server-only";
import jwt from "jsonwebtoken";

const RAW_SECRET = process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET;
// Prod-da real secret olmadan işləmə (forge riski) — dev-də fallback ok.
if (!RAW_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("MOBILE_JWT_SECRET və ya AUTH_SECRET prod-da təyin olunmalıdır");
}
const SECRET = RAW_SECRET || "dev-only-secret";
const ACCESS_TTL = "15m";

export type MobileTokenPayload = {
  sahibkar_id: string;
  istifadeci_id: string;
  rol_id: number;
  rol_ad: string;
};

export function signAccessToken(p: MobileTokenPayload): string {
  return jwt.sign(p, SECRET, { algorithm: "HS256", expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): MobileTokenPayload | null {
  try {
    const d = jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as MobileTokenPayload & { iat: number; exp: number };
    return { sahibkar_id: d.sahibkar_id, istifadeci_id: d.istifadeci_id, rol_id: d.rol_id, rol_ad: d.rol_ad };
  } catch {
    return null;
  }
}
