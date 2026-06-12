import "server-only";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Vahid fayl saxlama qatı — bütün upload route-ları bunu istifadə edir.
 *
 * KRİTİK: Vercel serverless-də `process.cwd()/public` READ-ONLY-dir —
 * lokal `writeFile` orada həmişə xəta verir (şəkil/sənəd yükləmələrinin
 * prod-da "edə bilmir" olmasının kök səbəbi). Prod-da Vercel Blob-a
 * yazırıq (BLOB_READ_WRITE_TOKEN avtomatik mövcuddur), lokal dev-də
 * isə köhnə qaydada `public/uploads`-a.
 */

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Faylı saxla və PUBLIC URL qaytar.
 *
 * @param key  "uploads/" altındakı yol, məs. `mehsul/ai-<uuid>.png` və ya
 *             `elaqe/<id>/<uuid>.pdf` — Blob-da da eyni açar istifadə olunur.
 * @returns Blob-da tam `https://...public.blob.vercel-storage.com/...` URL,
 *          lokalda `/uploads/<key>` (next.config remotePatterns hər ikisini örtür).
 */
export async function saveUploadFile(
  buf: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  // Blob YALNIZ prod-da işlədilir. Lokal dev özünə-yetərlidir (public/uploads),
  // beləcə .env.local-a prod blob tokeni pull olunsa belə dev cloud store-dan
  // (suspend/limit/şəbəkə) asılı qalmır.
  if (hasBlob() && process.env.NODE_ENV === "production") {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, buf, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return blob.url;
  }
  // Lokal dev fallback — public/uploads
  const rel = key.split("/").filter(Boolean);
  const dir = path.join(process.cwd(), "public", "uploads", ...rel.slice(0, -1));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, rel[rel.length - 1]), buf);
  return `/uploads/${rel.join("/")}`;
}

/**
 * Faylı sil (best-effort) — Blob URL-i `del()`, lokal `/uploads/...` isə unlink.
 * Xəta atmır: saxlama mənbəyi itibsə sənəd qeydi yenə silinməlidir.
 */
export async function deleteUploadFile(url: string): Promise<void> {
  try {
    if (/^https:\/\/[^/]*blob\.vercel-storage\.com\//.test(url)) {
      const { del } = await import("@vercel/blob");
      await del(url);
      return;
    }
    if (url.startsWith("/uploads/")) {
      const rel = url.replace(/^\//, "");
      // path traversal qoruması
      if (rel.includes("..")) return;
      await unlink(path.join(process.cwd(), "public", rel)).catch(() => {});
    }
  } catch {
    /* best-effort */
  }
}
