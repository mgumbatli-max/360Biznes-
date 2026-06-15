import "server-only";

import { prismaUnscoped } from "@/lib/db/prisma";

/**
 * Per-tenant MODUL entitlement gate.
 *
 * Hər şirkət (sahibkar) modul dəstinə sahibdir; super-admin onları açıb-bağlaya
 * və qiymət təyin edə bilər (`/platform-admin`). Bağlı modul = bloklanır + gizlədilir.
 * 1 aylıq demo (`bitme`) bitəndə də modul avtomatik bağlanır.
 *
 * Bu fayl SAF + təsirsizdir: yalnız tenant-ın bağlı modullarını qaytarır.
 * Real bloklama/redirect üçün layout/route-gate bunu çağırır.
 *
 * VACİB: `GATEABLE_MODULES` `modul_kod` dəyərlərini saxlayır (route prefiksini YOX).
 * Route seqmentindən kod-a keçid üçün `SEGMENT_TO_MODULE` map + `isGateableModule`
 * köməkçisindən istifadə et.
 */

/**
 * Bloklana bilən ÖDƏNİŞLİ/biznes modullarının `modul_kod` dəsti.
 *
 * Yalnız route-u olan biznes modulları daxildir (super-admin onları toggle edir).
 * Real `modullar.kod` dəyərləri ilə uyğunlaşdırılıb:
 *   anbar, satis, alis, maliyye, hesabat, elaqe, servis, iscilier,
 *   tapshiriq, marketplace
 *
 * CORE/infra modulları (bloklanMIR): dashboard, pos, ai, xeberdarliq, kpi,
 * bank_sinxron, idxal, white_label, api, audit_log — bunlar əsas iş axını və ya
 * add-on imkanlardır; route-gate səviyyəsində qadağan edilmir.
 */
export const GATEABLE_MODULES: ReadonlySet<string> = new Set([
  "anbar",
  "satis",
  "alis",
  "maliyye",
  "hesabat",
  "elaqe",
  "servis",
  "iscilier",
  "tapshiriq",
  "marketplace",
]);

/**
 * Route ilk-seqmenti → `modul_kod`.
 *
 * Route adları bəzən kod-dan fərqlənir (məs. `/ticaret` → `satis`,
 * `/satinalma` → `alis`, `/hesabatlar` → `hesabat`, `/crm`+`/elaqe` → `elaqe`,
 * `/tapshiriqlar` → `tapshiriq`). Yalnız gateable modullar üçün giriş var.
 */
export const SEGMENT_TO_MODULE: Readonly<Record<string, string>> = {
  anbar: "anbar",
  ticaret: "satis",
  satinalma: "alis",
  maliyye: "maliyye",
  hesabatlar: "hesabat",
  elaqe: "elaqe",
  crm: "elaqe",
  servis: "servis",
  iscilier: "iscilier",
  tapshiriqlar: "tapshiriq",
  marketplace: "marketplace",
};

/**
 * Verilən route seqmenti gateable modula aiddirmi?
 *
 * Seqment (məs. "ticaret") modul koduna (məs. "satis") çevrilir və
 * `GATEABLE_MODULES`-da olub-olmaması yoxlanılır. Leading slash-lar təmizlənir.
 */
export function isGateableModule(seg: string): boolean {
  const clean = seg.replace(/^\/+/, "").split("/")[0]?.toLowerCase() ?? "";
  const kod = SEGMENT_TO_MODULE[clean];
  return kod !== undefined && GATEABLE_MODULES.has(kod);
}

/**
 * Tenant-ın BAĞLI (deaktiv və ya demosu bitmiş) gateable modullarının `modul_kod` dəsti.
 *
 * TƏK sorğu: `sahibkar_modullar.findMany({ where: { sahibkar_id } })`.
 * Bir kod bağlı sayılır əgər:
 *   - `aktiv === false`, VƏ YA
 *   - `bitme` təyin olunub və keçmişdədir (`bitme < now`)
 * VƏ kod `GATEABLE_MODULES`-dadır.
 *
 * Aktiv sətir və ya ümumiyyətlə sətir olmaması → bağlı DEYİL (default-allow).
 */
export async function getTenantDisabledModules(
  sahibkarId: string,
): Promise<Set<string>> {
  const rows = await prismaUnscoped.sahibkar_modullar.findMany({
    where: { sahibkar_id: sahibkarId },
    select: { modul_kod: true, aktiv: true, bitme: true },
  });

  const now = Date.now();
  const disabled = new Set<string>();

  for (const row of rows) {
    if (!GATEABLE_MODULES.has(row.modul_kod)) continue;
    const inactive = row.aktiv === false;
    const expired = row.bitme != null && row.bitme.getTime() < now;
    if (inactive || expired) disabled.add(row.modul_kod);
  }

  return disabled;
}

/**
 * `modul_kod` → route ilk-seqmenti tərs map (`SEGMENT_TO_MODULE`-dan qurulur).
 * Bir kod birdən çox seqmentə uyğun gələ bilər (məs. `elaqe` → `elaqe` + `crm`).
 * Naviqasiya gizlətməsi (`hiddenModules`) route-seqment namespace-ində işlədiyi
 * üçün lazımdır (kod ≠ seqment olduqda — satis/ticaret, hesabat/hesabatlar...).
 */
const MODULE_TO_SEGMENTS: Readonly<Record<string, string[]>> = (() => {
  const map: Record<string, string[]> = {};
  for (const [seg, kod] of Object.entries(SEGMENT_TO_MODULE)) {
    (map[kod] ??= []).push(seg);
  }
  return map;
})();

/**
 * `getTenantDisabledModules`-un nəticəsini (`modul_kod` dəsti) naviqasiyada
 * gizlədilməli route SEQMENTLƏRİnə çevirir (sidebar/lite-menu/command-palette
 * `href.split("/")[1]` ilə müqayisə edir). Layout bunu `hiddenModules`-a merge edir.
 */
export function disabledModuleSegments(disabledKods: Set<string>): string[] {
  const segs: string[] = [];
  for (const kod of disabledKods) {
    for (const seg of MODULE_TO_SEGMENTS[kod] ?? [kod]) segs.push(seg);
  }
  return segs;
}

/** Route ilk-seqmentini `modul_kod`-a çevir (yoxdursa null). Enforcement üçün. */
export function segmentToModuleKod(seg: string): string | null {
  const clean = seg.replace(/^\/+/, "").split("/")[0]?.toLowerCase() ?? "";
  return SEGMENT_TO_MODULE[clean] ?? null;
}
