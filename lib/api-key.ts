import { createHash, randomBytes } from "node:crypto";

/**
 * Marketplace public API üçün açar yaradılması və yoxlanması.
 *
 * Format: `<sahibkar_id_short>.<random_secret>`
 *  - sahibkar_id_short: 8 baytlıq base64url (UUID-nin ilk 8 baytı)
 *  - random_secret: 24 bayt base64url (~32 simvol)
 *
 * Server-də yalnız SHA-256 hash saxlanılır (ayarlar cədvəlində).
 * Plaintext bir dəfə yaratma anında qaytarılır, sonra göstərilmir.
 */

const SECRET_BYTES = 24;

export function generateApiKey(sahibkarId: string): { plaintext: string; hash: string } {
  // sahibkar UUID-nin ilk 8 baytını base64url-də göstər ki, key-dən sahibkarı tapmaq tez olsun.
  const idShort = sahibkarId.replace(/-/g, "").slice(0, 16); // 8 bayt hex = 16 simvol
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const plaintext = `${idShort}.${secret}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Key-dən sahibkar_id-nin qısa hash-ını parse edir.
 * Tam UUID qaytarmır — yalnız axtarış sahəsini daraltmaq üçün.
 */
export function parseKeyPrefix(plaintext: string): string | null {
  const m = /^([0-9a-f]{16})\.([A-Za-z0-9_-]{20,})$/.exec(plaintext);
  return m ? m[1] : null;
}

/** UUID-ni 16-simvollu prefix-ə çevirir (axtarış üçün eyni format). */
export function uuidToPrefix(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 16);
}
