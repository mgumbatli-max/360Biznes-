// Auto-extracted from prisma/schema.prisma — 209 tenant-scoped models.
// Re-generate with: scripts/extract-tenant-models.ts (TODO) when schema changes.
// Models in this list automatically receive `sahibkar_id` filter on read,
// and `sahibkar_id` value on create, via the Prisma extension in `prisma.ts`.

export const TENANT_MODELS = new Set<string>([
  // Marketinq/loyallıq modelləri — cross-tenant sızma düzəlişi (audit #22/#23):
  // tenant filtri tətbiq olunmalı (hamısı sahibkar_id daşıyır).
  "campaigns",
  "coupons",
  "gift_cards",
  "loyalty_cards",
  "loyalty_tx",
  "campaign_usage",
  "abuneler",
  "ai_insiqht",
  "ai_sohbet_loq",
  "ai_sual",
  "alert_ai_insights",
  "alert_rules",
  "alerts",
  "alis_sifaris_satirlari",
  "alis_sifarisleri",
  "anbar_hereketleri",
  "anbar_transferleri",
  "anbarlar",
  "api_call_log",
  "api_keys",
  "audit_log",
  "auto_log",
  "avto_cavab_qaydalari",
  "avto_log",
  "avto_qayda",
  "axtaris_tarixce",
  "ayarlar",
  "backup_ayar",
  "backup_berpa_log",
  "backups",
  "bank_cixarisi_satirlari",
  "bank_cixarislari",
  "bank_eslesh_qaydalari",
  "barkod_tipleri",
  "bildiris_qaydalari",
  "bildiris_sakitlik",
  "bildiris_test_log",
  "bildirisler",
  "broadcast_kampaniyalari",
  "broadcast_log",
  "broadcast_sablonlari",
  "catdirmalar",
  "contact_communications",
  "contact_followups",
  "contact_merge_logs",
  "contact_people",
  "contact_tags",
  "contact_type_links",
  "data_saglamliq",
  "davamiyyet",
  "demo_trials",
  "etiket_sablonu",
  "filiallar",
  "finance_approval_requests",
  "finance_attachments",
  "finance_audit_logs",
  "finance_balance_adjustments",
  "finance_bank_statement_items",
  "finance_bank_statements",
  "finance_barter_operations",
  "finance_currency_exchanges",
  "finance_debt_writeoffs",
  "finance_dividends",
  "finance_expense_categories",
  "finance_internal_balances",
  "finance_marketplace_payments",
  "finance_operations",
  "finance_payment_allocations",
  "finance_recurring_rules",
  "gun_sonu",
  "hesab_emeliyyatlari",
  "import_partiyalari",
  "import_satirlari",
  "inbox_mesajlari",
  "inbox_sohbetler",
  "inventar_satirlari",
  "inventarizasiyalar",
  "ip_bloklari",
  "isci_grafik",
  "isci_mezuniyyet",
  "isci_odenisleri",
  "isci_senedleri",
  "istifadeci_giris_qaydalari",
  "istifadeci_isci_baglamasi",
  "istifadeci_preferences",
  "istifadeci_sessiya",
  "istifadeciler",
  "kassa_emeliyyatlari",
  "kassalar",
  "kateqoriyalar",
  "kompaniyalar",
  "konsiqnasiya",
  "kontragentler",
  "kpi_adjustments",
  "kpi_aylik_hesablamalar",
  "kpi_payments",
  "kpi_performans_log",
  "kpi_qaydalari",
  "kpi_result_items",
  "kredit_satislari",
  "kuryerler",
  "lab_ab_test",
  "lab_budget",
  "lab_clock_in",
  "lab_complaint",
  "lab_doc_expiry",
  "lab_funksiya",
  "lab_istek",
  "lab_kampaniya",
  "lab_kupon",
  "lab_loyalty",
  "lab_nps",
  "lab_public_dash",
  "lab_referral",
  "lab_rey",
  "lab_selfie_dav",
  "lab_subscription",
  "lab_supplier_score",
  "lab_voice_log",
  "lab_wishlist",
  "lab_workflow",
  "landed_paylama",
  "landed_xercl_r",
  "leads",
  "maas_hesablamalar",
  "maliye_hesablari",
  "markalar",
  "marketplace_giris_log",
  "marketplace_hesablari",
  "marketplace_komisyon",
  "marketplace_magaza_hesablari",
  "marketplace_platforma_kataloq",
  "marketplace_sifarisleri",
  "marketplace_sync_log",
  "mehsul_audit",
  "mehsul_barkodlar",
  "mehsul_custom_field",
  "mehsul_qiymet_tarixce",
  "mehsul_tipleri",
  "mehsullar",
  "mesaj_sablonlari",
  "musteri_qeydleri",
  "musteri_seqment",
  "musteri_seqment_link",
  "musteri_sohbetleri",
  "odenis_jurnali",
  "olcu_vahidleri",
  "pos_sessions",
  "qaytarma_satirlari",
  "qaytarma_sifarisleri",
  "qeydler",
  "qiymet_kanal",
  "qiymet_kanal_komissiya",
  "qiymet_log",
  "qiymet_min",
  "qiymet_novleri",
  "qiymet_platforma",
  "qiymet_strategiya",
  "qiymet_tarixce",
  "reqib_qiymet",
  "rezerv_satirlari",
  "rezervler",
  // "roles" — burada DEYİL: sahibkar_id nullable-dır (sistem rolları NULL).
  // Açıq şəkildə MANUAL_SCOPE_MODELS siyahısındadır (faylın sonuna bax).
  "sahibkar_alici",
  "sahibkar_audit",
  "sahibkar_ayar",
  "sahibkar_fayl",
  "sahibkar_isci_qiymet",
  "sahibkar_mal",
  "sahibkar_maliye_qeyd",
  "sahibkar_modullar",
  "sahibkar_partiya",
  "sahibkar_qeyd",
  "sahibkar_servis_qeyd",
  "sahibkar_sifre_berpa",
  "sahibkar_snapshot",
  "sahibkar_tapshiriq",
  "sahibkar_techizatci",
  "sahibkar_ticaret_qeyd",
  "satinalma_tovsiye",
  "satis_sifaris_satirlari",
  "satis_sifarisleri",
  "seher_briefing",
  "sened_sablonlari",
  "sened_sayicilari",
  "sened_yaradilan",
  "seri_nomreler",
  "servis_akt_sablonlari",
  "servis_defekt_kateq",
  "servis_qeydleri",
  "sosial_hesablar",
  "stok",
  "stok_bron",
  "tapshiriq_checklist",
  "tapshiriq_etiketleri",
  "tapshiriq_fayllari",
  "tapshiriq_kommentleri",
  "tapshiriq_obyektleri",
  "tapshiriq_performance_log",
  "tapshiriq_tekrar",
  "tapshiriq_xatirlatmalar",
  "tapshiriqlar",
  "teklifler",
  "tesdiq_sorgulari",
  "tesdiq_telep",
  "transfer_satirlari",
  "vergi_cekleri",
  "webhook_delivery",
  "webhook_endpoints",
  "webhook_log",
  "xarici_partiya_satirlari",
  "xarici_partiyalar",
  "xarici_saticlar",
  "xerc_kateqoriyalari",
  "xercl_r",
  "zemanet_sablonlari",
  "zemanetler",

  // ── 2026-09-01 audit fix: sahibkar_id daşıyırdılar, lakin siyahıda yox idilər.
  // Prisma extension tanınmayan model üçün FİLTRSİZ keçirdi (fail-open) →
  // cross-tenant oxu/dəyişmə/silmə mümkün idi (r2b regression testi ilə sübut edilib).
  "team_kanal",
  "team_mesaj_log",
  "team_ayar",
  "satinalma_teklif",
  "filial_mesaj",
  "filial_gorunush",
  "sened_nomre_counter",
  "audit_log_outbox",
  "vezifeler",
  "defekt_qeydleri",
  "mobil_refresh_tokens",
]);

export function isTenantModel(modelName: string | undefined): boolean {
  if (!modelName) return false;
  // Prisma extension passes model name in PascalCase or snake_case depending on
  // version; we normalize to lowercase snake_case for the lookup.
  const normalized = modelName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return TENANT_MODELS.has(normalized);
}

/**
 * Qəsdən tenant-scoped OLMAYAN modellər — açıq allowlist.
 *
 * `isTenantModel()` false qaytaranda Prisma extension artıq sorğunu SƏSSİZCƏ
 * buraxmır (əvvəlki fail-open davranış). Model bu siyahıda da yoxdursa
 * extension xəta atır — yəni sxemə yeni `sahibkar_id`-li model əlavə edən
 * developer onu qeydiyyatdan keçirməyə MƏCBURDUR.
 *
 * Siyahı iki qrupdan ibarətdir:
 *
 * A) PLATFORMA SƏVİYYƏSİ — həqiqətən qlobaldır, tenant-a aid deyil:
 *    abune_planlari, modullar, icazeler, schema_migrations, sahibkarlar,
 *    kpi_metric_kataloqu, alert_categories, finance_operation_types,
 *    lab_valyuta_kurs, landed_xerc_kateq, tapshiriq_tipleri
 *
 * B) VALİDEYN ÜZƏRİNDƏN BAĞLI — məntiqən tenant datasıdır, lakin cədvəldə
 *    `sahibkar_id` sütunu YOXDUR, ona görə ORM qatında filtr tətbiq edilə
 *    bilmir; izolyasiya valideyn sənədin yoxlanmasından asılıdır.
 *    ⚠️ AÇIQ RİSK — audit 2026-09-01 bu modellərdə cross-tenant sızma
 *    aşkarlayıb (məs. alert_comments, alert_escalations, tesdiq_log,
 *    giris_cehdleri, team_uzv, team_mesaj). Struktur həll: həmin cədvəllərə
 *    `sahibkar_id` sütunu əlavə edib bu siyahıdan TENANT_MODELS-ə köçürmək.
 *    Bu iş bu düzəliş paketinin ƏHATƏSİNDƏN KƏNARDADIR və ayrıca aparılmalıdır.
 */
export const GLOBAL_MODELS = new Set<string>([
  // A) platforma səviyyəsi
  "abune_planlari",
  "alert_categories",
  "finance_operation_types",
  "icazeler",
  "kpi_metric_kataloqu",
  "lab_valyuta_kurs",
  "landed_xerc_kateq",
  "modullar",
  "sahibkarlar",
  "schema_migrations",
  "tapshiriq_tipleri",

  // B) valideyn üzərindən bağlı (sahibkar_id sütunu yoxdur) — açıq risk
  "alert_comments",
  "alert_escalations",
  "alert_status_history",
  "alert_user_preferences",
  "bildiris_kanal_log",
  "contact_tag_links",
  "finance_operation_items",
  "giris_cehdleri",
  "istifadeci_filial",
  "lab_emergency_contact",
  "owner_widget_konfig",
  "rol_icazeleri",
  "sahibkar_partiya_magaza",
  "sahibkar_partiya_mehsul",
  "sahibkar_partiya_sened",
  "sahibkar_partiya_xerc",
  "satinalma_teklif_satir",
  "servis_fayllari",
  "servis_status_tarixce",
  "sohbet_kanallari",
  "tapshiriq_iscilier",
  "tapshiriq_status_tarixce",
  "team_mesaj",
  "team_uzv",
  "teklif_satirlari",
  "tesdiq_log",
  "user_pos_preferences",
]);

/** Model qəsdən tenant-scoped olmayanlar siyahısındadırmı? */
export function isGlobalModel(modelName: string | undefined): boolean {
  if (!modelName) return false;
  const normalized = modelName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return GLOBAL_MODELS.has(normalized);
}

/**
 * MANUAL_SCOPE_MODELS — sahibkar_id sütunu VAR, lakin NULL ola bilər.
 *
 * `roles` iki növ sətir saxlayır:
 *   • sistem rolları — `sistem = true`, `sahibkar_id IS NULL` (bütün kirayəçilər üçün şablon);
 *   • kirayəçi rolları — `sahibkar_id = <tenant>` (qeydiyyatda sistem rollarından klonlanır).
 *
 * Avtomatik `where.sahibkar_id = tenantId` inyeksiyası sistem rollarını gizlədir,
 * yəni qeydiyyat (`signup-action.ts` sistem rollarını klonlayır) və rol idarəetməsi
 * sınır. Ona görə bu modellər guard-dan filtrsiz keçir.
 *
 * ⚠️ ÇAĞIRICININ ÖHDƏLİYİ: filtr ƏL İLƏ yazılmalıdır —
 *    `where: { OR: [{ sahibkar_id: tenantId }, { sistem: true }] }`
 *    və ya yalnız kirayəçi sətirləri üçün `where: { sahibkar_id: tenantId }`.
 *
 * Bu siyahı AÇIQ elandır: fail-closed guard (lib/db/prisma.ts) yalnız burada,
 * TENANT_MODELS-də və ya GLOBAL_MODELS-də olan modelləri buraxır. Yeni model
 * əlavə edən şəxs üç siyahıdan birini seçməyə məcburdur.
 */
export const MANUAL_SCOPE_MODELS = new Set<string>([
  "roles",
]);

/** Model əl ilə filtrlənən (nullable sahibkar_id) siyahıdadırmı? */
export function isManualScopeModel(modelName: string | undefined): boolean {
  if (!modelName) return false;
  const normalized = modelName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return MANUAL_SCOPE_MODELS.has(normalized);
}
