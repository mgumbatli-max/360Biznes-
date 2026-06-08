import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * AES-256-GCM ilə sirli string encryption.
 *
 * Marketplace API key, OAuth token kimi məlumatları DB-də şifrəli saxlamaq üçün.
 * Master key — `CRYPTO_SECRET` env (32+ simvol).
 *
 * Format: `enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>`
 *
 * Backward-compatible: əgər mətn `enc:` ilə başlamırsa, encrypt edilməmiş kimi
 * geri qaytarılır (köhnə plaintext token-lar oxunan kimi işləyir; yeni yazmalar
 * isə həmişə encrypt edilir).
 */

const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.CRYPTO_SECRET ?? process.env.AUTH_SECRET ?? "";
  if (!secret || secret.length < 16) {
    throw new Error("CRYPTO_SECRET (və ya AUTH_SECRET) ən azı 16 simvol olmalıdır");
  }
  // 32-byte key for AES-256
  cachedKey = scryptSync(secret, "360biznes-marketplace-token-salt", 32);
  return cachedKey;
}

export function encryptString(plain: string | null | undefined): string | null {
  if (!plain) return null;
  if (plain.startsWith(PREFIX)) return plain; // artıq şifrəlidir
  try {
    const key = getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  } catch (e) {
    console.error("[encryptString]", e);
    return plain; // fallback: encrypt mümkün deyilsə plaintext qaytar (xəbərdarlıq ilə)
  }
}

export function decryptString(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  if (!encrypted.startsWith(PREFIX)) return encrypted; // köhnə plaintext
  try {
    const key = getKey();
    const parts = encrypted.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const ciphertext = Buffer.from(parts[2], "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (e) {
    console.error("[decryptString]", e);
    return null;
  }
}

/**
 * Tokenin son 4 simvolunu göstər (audit üçün).
 */
export function maskSecret(s: string | null | undefined): string {
  if (!s) return "";
  const decrypted = s.startsWith(PREFIX) ? (decryptString(s) ?? "") : s;
  if (decrypted.length <= 8) return "****";
  return `****${decrypted.slice(-4)}`;
}
