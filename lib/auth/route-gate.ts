import "server-only";

/**
 * Mərkəzi route → icazə map.
 *
 * Layout (`app/(dashboard)/layout.tsx`) hər render-də cari path-i bu map ilə
 * yoxlayır; nəticə uyğun deyilsə `/icaze-yox` səhifəsinə redirect edir.
 *
 * Default davranış:
 *   - Sahibkar və admin rolları (rol_ad-da "sahibkar" / "admin") bütün modullara
 *     girir; map-ə baxılmır.
 *   - Naməlum prefix üçün default ALLOW (`/dashboard`, `/help` və s. kimi
 *     ümumi səhifələr bloklanmasın).
 *   - Tanınan prefix üçün uyğun icazə kodu yoxdursa DENY.
 *
 * Bu, mövcud səhifə-səviyyə yoxlamaları silmir — onlardan ƏVVƏL qoruyucu qatdır.
 */

type RouteRule = {
  /** prefix match — "/maliyye" tutur /maliyye, /maliyye/foo, /maliyye/bar/baz */
  prefix: string;
  /** ən azı birinə sahib olmaq lazımdır */
  anyOf: string[];
  /** istisna: bu yolaltı path-lər üçün rule keçərli deyil */
  except?: string[];
};

export const ROUTE_RULES: RouteRule[] = [
  // — Maliyyə (canonical maliyye.* + köhnə alias maliye.*)
  { prefix: "/maliyye", anyOf: ["maliyye.oxu", "maliyye.idare", "maliye.view", "maliye.gor", "maliye.idare"] },
  // — Hesabatlar
  { prefix: "/hesabatlar", anyOf: ["hesabat.view", "hesabat.gor", "hesabat.oxu", "hesabat.idare"] },
  // — Əməkdaşlar / İşçilər
  // QA-K1: kütləvi maaş bordrosu dar icazə tələb edir (ilk uyğun qayda qazandığı
  // üçün /iscilier-dən ƏVVƏL durmalıdır).
  { prefix: "/iscilier/maas", anyOf: ["maas.view", "maas.idare"] },
  { prefix: "/iscilier", anyOf: ["isci.view", "isci.idare", "hr.view"] },
  // — Anbar (canonical anbar.oxu + köhnə alias anbar.view/gor/idare)
  { prefix: "/anbar", anyOf: ["anbar.oxu", "anbar.view", "anbar.gor", "anbar.idare"] },
  // — Ticarət / Satış (canonical ticaret.oxu/satis.oxu + alias)
  { prefix: "/ticaret", anyOf: ["ticaret.oxu", "satis.oxu", "trade.view", "ticaret.view", "satis.gor"] },
  // — POS / İsti satış (canonical pos.access + alias)
  { prefix: "/pos", anyOf: ["pos.access", "pos.view", "pos.istifade", "trade.view"] },
  { prefix: "/market-pos", anyOf: ["pos.access", "pos.view", "pos.istifade", "trade.view"] },
  // — CRM / Mesaj mərkəzi
  { prefix: "/crm", anyOf: ["crm.oxu", "crm.idare", "mesaj.cevab", "mesaj.idare", "lead.idare"] },
  // — Servis
  { prefix: "/servis", anyOf: ["servis.view", "servis.idare"] },
  // — Marketplace (canonical marketplace.oxu + alias)
  { prefix: "/marketplace", anyOf: ["marketplace.oxu", "marketplace.view", "marketplace.idare"] },
  // — Webhook
  { prefix: "/webhook", anyOf: ["webhook.view", "marketplace.idare"] },
  // — Avtomatlaşdırma / Təsdiq / Audit / Nəzarət
  { prefix: "/avtomatlasdirma", anyOf: ["avto.view", "avto.idare"] },
  { prefix: "/tesdiq", anyOf: ["tesdiq.view", "tesdiq.tesdiq", "tesdiq.oxu"] },
  { prefix: "/audit-log", anyOf: ["audit.view"] },
  { prefix: "/nezaret-merkezi", anyOf: ["nezaret.oxu", "nezaret.dashboard", "audit.view"] },
  // — Ayarlar (yalnız admin / sahibkar; map-də sahibkar/admin bypass-ed olunduğu üçün burada dar saxlayırıq)
  { prefix: "/ayarlar", anyOf: ["ayar.view", "ayar.idare"] },
  // — Kampaniyalar (audit #minor: gate perm-i modulun faktiki kodları ilə uyğunlaşdır —
  // əvvəl yalnız kampaniya.view/marketing.view idi, modul isə kampaniya.oxu/idare +
  // loyalty/gift/marketing kodlarını işlədir; oxu-olub-view-olmayan rollar bloklanırdı)
  { prefix: "/kampaniyalar", anyOf: ["kampaniya.view", "marketing.view", "kampaniya.oxu", "kampaniya.idare", "marketing.broadcast", "loyalty.idare", "loyalty.balans", "gift.yarat", "gift.idare"] },
  // — Satınalma planlama (anbar daxili gərək olardı, amma URL var)
  { prefix: "/satinalma", anyOf: ["anbar.oxu", "anbar.view", "satinalma.oxu", "satinalma.view", "trade.view"] },
  // — Sahibkar bölməsi (PIN guard onsuz da var, amma rol kontrolü də etsən pis olmaz)
  { prefix: "/sahibkar", anyOf: ["sahibkar.access"] },
  // — Platform admin (səhifə guard-ı requirePlatformAdmin/isSuperAdmin onsuz da
  //   yoxlayır — super-admin yalnız konkret profildir, rolla verilmir)
  { prefix: "/platform-admin", anyOf: ["platform.admin"] },
  // — 360 LAB (yalnız sahibkar/admin; bunlar onsuz da bypass olur)
  { prefix: "/360-lab", anyOf: ["lab.view"] },
];

const BYPASS_PREFIXES = [
  "/dashboard",
  "/icaze-yox",
  "/komekci", // help
  "/elaqe", // contacts — geniş istifadə, view default
  "/tapshiriqlar", // hər kəsin öz tapşırığı var
  "/team", // söhbət
  "/ai", // ai köməkçi — view default
  "/xeberdarliqlar", // hər kəs öz xəbərdarlığını görür
];

export type GateResult =
  | { allowed: true }
  | { allowed: false; rule: RouteRule };

/**
 * Path-i qaydalara uyğun yoxla.
 * Sahibkar/admin/owner rolları üçün həmişə icazə verilir.
 */
export function gateRoute(
  pathname: string,
  rolAd: string | undefined,
  icazeler: string[],
): GateResult {
  const r = (rolAd ?? "").toLowerCase();
  // Sahibkar və admin hər şeyə girir
  if (r.includes("sahibkar") || r.includes("admin") || r.includes("owner")) {
    return { allowed: true };
  }
  // Bypass prefiksləri (default-allow)
  for (const p of BYPASS_PREFIXES) {
    if (pathname === p || pathname.startsWith(p + "/")) return { allowed: true };
  }
  // Modul qaydaları
  for (const rule of ROUTE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
      if (rule.except?.some((e) => pathname.startsWith(e))) continue;
      const hasOne = rule.anyOf.some((c) => icazeler.includes(c));
      if (!hasOne) return { allowed: false, rule };
      return { allowed: true };
    }
  }
  // Tanınmayan prefix — default-allow (sehifəni tək başına gating etmiş ola bilər)
  return { allowed: true };
}
