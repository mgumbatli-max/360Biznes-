/**
 * Universal "Blocker" pattern — bütün modul boyu istifadə.
 *
 * Bir əməliyyat (silmə, ləğv, status dəyişdirmə) həyata keçirilə bilmirsə,
 * cavabda yalnız mətn xəta deyil, STRUKTURLU bağlantı veririk ki istifadəçi
 * birbaşa o sənədə keçə bilsin və lazımdırsa oradan həll etsin.
 *
 * İstifadə nümunəsi (server action):
 *   return {
 *     ok: false,
 *     error: "Bu satışı silmək olmur — bağlı ödənişlər var",
 *     blockers: [
 *       { type: "odenis", id: "uuid", label: "30 AZN — 2025-06-06", href: "/maliyye/emeliyyat/uuid" }
 *     ],
 *     hint: "Əvvəlcə bu ödənişləri silin və ya səbəbdə qeyd edin."
 *   };
 *
 * Frontend yan tərəfdə `<ActionErrorToast>` bu blockerları klik edilə bilən
 * link kimi göstərir.
 */

export type BlockerType =
  // Maliyyə
  | "odenis"            // Müştəri / təchizatçı ödənişi
  | "kassa_emeliyyati"  // Kassa hərəkəti
  | "hesab_emeliyyati"  // Bank hesab hərəkəti
  // Ticarət
  | "satis"             // Satış sənədi
  | "alis"              // Alış sənədi
  | "qaytarma"          // Qaytarma sənədi
  | "teklif"            // Qiymət təklifi
  | "kredit_satis"      // Kredit satışı
  // Anbar
  | "transfer"
  | "stok_duzelis"
  | "defekt"
  // CRM / Servis
  | "musteri"
  | "techizatci"
  | "servis"
  | "leyd"
  | "kampaniya"
  // HR / Tapşırıq
  | "tapsiriq"
  | "iscik";

export type Blocker = {
  /** Blocker növü — UI ikonu və mətn üçün */
  type: BlockerType;
  /** Resursun unikal id-si */
  id: string;
  /** UI-də göstəriləcək qısa label, məs. "S-2025-001 — 50 AZN" */
  label: string;
  /** Klik ilə yönləndirmə */
  href: string;
  /** İstəyə görə məbləğ (məs. ödəniş) */
  amount?: number;
  /** İstəyə görə tarix */
  tarix?: string | Date;
  /** İstəyə görə statusa görə badge */
  badge?: string;
};

export type ActionFailureWithBlockers = {
  ok: false;
  error: string;
  blockers?: Blocker[];
  /** İstifadəçiyə həll yolu — "Əvvəlcə ödənişləri silin" və s. */
  hint?: string;
  /** İstəyə görə zorla davam etmə açarı (UI "məcburi sil" düyməsi üçün) */
  forceAvailable?: boolean;
};
