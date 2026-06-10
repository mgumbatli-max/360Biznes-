// zxing_reader.wasm-ı node_modules-dan public/wasm/-a kopyalayır.
// Barkod skaneri (barcode-detector ponyfill) WASM-ı CDN-dən yox, öz domenimizdən
// yükləsin deyə — prod-da xarici asılılıq və "fetch error" olmasın, lokal=prod 1-1.
// postinstall + build zamanı çağırılır, ona görə həmişə quraşdırılmış versiya ilə sinxrondur.
import { mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
const destDir = join(root, "public", "wasm");
const dest = join(destDir, "zxing_reader.wasm");

if (!existsSync(src)) {
  // barcode-detector quraşdırılmayıbsa səssiz keç (CI/partial install) — build-i sındırma.
  console.warn("[sync-wasm] mənbə tapılmadı, ötürülür:", src);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[sync-wasm] kopyalandı →", dest, `(${(statSync(dest).size / 1024).toFixed(0)} KB)`);
