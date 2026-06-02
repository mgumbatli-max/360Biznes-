/**
 * Audit log üçün insanın oxuya biləcəyi etiketlər və rənglər.
 * audit-detail-modal.tsx həm audit-log/page.tsx həm digər audit feed-lər
 * eyni adlandırma istifadə etsin.
 */

export type AuditTone = "success" | "info" | "danger" | "warning" | "primary" | "neutral";

export const OP_META: Record<string, { label: string; tone: AuditTone; verb: string }> = {
  // Yeni audit() helper kiçik hərflərlə yazır
  yarat: { label: "Yaratma", tone: "success", verb: "yaradıldı" },
  yarad: { label: "Yaratma", tone: "success", verb: "yaradıldı" },
  yenile: { label: "Yeniləmə", tone: "info", verb: "yeniləndi" },
  sil: { label: "Silmə", tone: "danger", verb: "silindi" },
  berpa: { label: "Bərpa", tone: "info", verb: "bərpa edildi" },
  tesdiq: { label: "Təsdiq", tone: "success", verb: "təsdiqləndi" },
  redd: { label: "Rədd", tone: "danger", verb: "rədd edildi" },
  legv: { label: "Ləğv", tone: "warning", verb: "ləğv edildi" },
  giris: { label: "Giriş", tone: "primary", verb: "sistemə girdi" },
  yeni_cihaz_giris: { label: "🆕 Yeni cihaz", tone: "warning", verb: "YENİ cihazdan sistemə girdi" },
  cixis: { label: "Çıxış", tone: "primary", verb: "sistemdən çıxdı" },
  "uğursuz_giris": { label: "Uğursuz giriş", tone: "danger", verb: "uğursuz giriş cəhdi etdi" },
  pin_giris: { label: "PIN girişi", tone: "primary", verb: "PIN ilə girdi" },
  pin_lockout: { label: "PIN lockout", tone: "danger", verb: "PIN lockout aktivləşdi" },
  pin_qur: { label: "PIN qurma", tone: "info", verb: "PIN qurdu" },
  pin_yenile: { label: "PIN yeniləmə", tone: "info", verb: "PIN-i yenilədi" },
  pin_cixis: { label: "PIN çıxışı", tone: "primary", verb: "sahibkar bölməsindən çıxdı" },
  gizli_giris: { label: "Gizli giriş", tone: "warning", verb: "gizli kodla girdi" },
  import: { label: "Import", tone: "info", verb: "idxal etdi" },
  export: { label: "Export", tone: "warning", verb: "ixrac etdi" },
  "icaze_dəyişdir": { label: "İcazə dəyişdi", tone: "warning", verb: "icazələri dəyişdi" },
  "ayar_dəyiş": { label: "Ayar dəyişdi", tone: "warning", verb: "ayar dəyişdi" },
  // Köhnə UPPERCASE — backward-compat
  YARAT: { label: "Yaratma", tone: "success", verb: "yaradıldı" },
  YENILE: { label: "Yeniləmə", tone: "info", verb: "yeniləndi" },
  SIL: { label: "Silmə", tone: "danger", verb: "silindi" },
  GIRIS: { label: "Giriş", tone: "primary", verb: "sistemə girdi" },
  TESDIQLENDI: { label: "Təsdiq", tone: "success", verb: "təsdiqləndi" },
};

export const RESOURCE_LABEL: Record<string, string> = {
  mehsul: "Məhsul",
  mehsul_bulk: "Məhsullar (toplu)",
  marka: "Marka",
  kateqoriya: "Kateqoriya",
  stok: "Stok",
  stok_transfer: "Stok transferi",
  kontragent: "Kontragent",
  kontragent_borc: "Müştəri borcu",
  satis_sifarisi: "Satış sifarişi",
  pos_satis: "POS satışı",
  marketplace_satis: "Marketplace satışı",
  alis_sifarisi: "Alış sifarişi",
  kredit_satis: "Kredit satışı",
  kredit_satis_odenis: "Kredit satışı ödənişi",
  kredit_bank_odenis: "Bank ödənişi (kredit)",
  qaytarma_sifarisi: "Qaytarma sifarişi",
  inventarizasiya: "Sayım",
  kassa: "Kassa",
  iscilier: "İşçi",
  istifadeci_sifre: "İstifadəçi şifrəsi",
  maas_hesablama: "Maaş hesablama",
  maas_odenis: "Maaş ödənişi",
  maas_odenis_bulk: "Toplu maaş ödənişi",
  rol: "Rol",
  tesdiq_telep: "Təsdiq sorğusu",
  tesdiq_telep_bulk: "Toplu təsdiq",
  sahibkar_ayar: "Sahibkar ayarı",
  session: "Sessiya",
  mehsul_import_preview: "Məhsul idxal preview",
  mehsul_import_execute: "Məhsul idxal icra",
  mehsul_import_partiya: "Məhsul idxal partiyası",
  mehsul_export: "Məhsul ixracı",
  satis_export: "Satış ixracı",
  alis_export: "Alış ixracı",
  stok_export: "Stok ixracı",
  audit_log_export: "Audit log ixracı",
  mesaj_sablon: "Mesaj şablonu",
  risk_qayda: "Risk qaydası",
  api_key: "API açar",
};

/**
 * Hər resurs növü hansı moduldadır — modul filter dropdown və daha geniş
 * istifadə üçün qruplaşdırma.
 */
export const RESOURCE_MODULES: { kod: string; ad: string; resurs: string[] }[] = [
  {
    kod: "anbar",
    ad: "Anbar",
    resurs: ["mehsul", "mehsul_bulk", "marka", "kateqoriya", "stok", "stok_transfer", "inventarizasiya", "mehsul_import_preview", "mehsul_import_execute", "mehsul_import_partiya", "mehsul_export", "stok_export"],
  },
  {
    kod: "ticaret",
    ad: "Ticarət / POS",
    resurs: ["satis_sifarisi", "pos_satis", "marketplace_satis", "alis_sifarisi", "kredit_satis", "kredit_satis_odenis", "kredit_bank_odenis", "qaytarma_sifarisi", "kassa", "satis_export", "alis_export"],
  },
  {
    kod: "elaqe",
    ad: "Əlaqələr",
    resurs: ["kontragent", "kontragent_borc"],
  },
  {
    kod: "iscilier",
    ad: "Əməkdaşlar",
    resurs: ["iscilier", "istifadeci_sifre", "maas_hesablama", "maas_odenis", "maas_odenis_bulk"],
  },
  {
    kod: "tesdiq",
    ad: "Təsdiq mərkəzi",
    resurs: ["tesdiq_telep", "tesdiq_telep_bulk"],
  },
  {
    kod: "ayarlar",
    ad: "Ayarlar / Sahibkar",
    resurs: ["rol", "sahibkar_ayar", "session", "mesaj_sablon", "risk_qayda", "api_key", "audit_log_export"],
  },
];

export function moduleOfResource(resurs: string): string {
  for (const m of RESOURCE_MODULES) {
    if (m.resurs.includes(resurs)) return m.ad;
  }
  return "Digər";
}
