-- ============================================================================
-- FIX: import_partiyalari köhnə CHECK constraint-ləri → BÜTÜN Excel importları çökürdü
-- ============================================================================
-- Problem (prod-da 23514 check_violation — "Verilənlər bazası qaydası pozuldu"):
--   `import_partiyalari_status_check`  yalnız köhnə status dəyərlərini qəbul edirdi
--     ('yuklendi','analiz_olunur','xeta','preview','icrada','tamamlandi','rollback','legv')
--     — kod isə create-də status='icra_edilir', update-də 'ugursuz' yazırdı.
--   `import_partiyalari_sablon_nov_check` yalnız KÖHNƏ məhsul-yönlü şablonları qəbul edirdi
--     ('mehsul_standart','stok_yenile','qiymet_yenile','topdan_qiymet','marketplace',
--      'alish_partiya','xarici_alish','barkod_yenile')
--     — kod isə sablon_nov=<template key> yazır: 'mehsul','musteri','techizatci',
--     'kassa-baslangic','emekdas','crm','stok' (HEÇ BİRİ icazəli deyildi).
--
-- `import_partiyalari.create` per-row loop-dan ƏVVƏL və try-dan KƏNARDA çağırılırdı,
-- ona görə hər iki constraint-dən biri pozulan kimi BÜTÜN import (məhsul, müştəri,
-- təchizatçı, ...) dərhal çökürdü ("hərşeyi xəta görür").
--
-- Bu cədvəl daxili idxal-izləmə (history/rollback) üçündür; status & sablon_nov
-- dəyərləri yalnız tətbiq kodu tərəfindən idarə olunur və şablon açarları zamanla
-- artır. DB-də sabit CHECK saxlamaq sinxronizasiya tələsidir (bu insident məhz
-- bundan yarandı) → stale constraint-ləri silirik. Tətbiq səviyyəsində dəyərlər
-- onsuz da idarə olunur. (Prisma `db push` CHECK-ləri idarə etmir, ona görə bu
-- migration LOKAL + PROD bazaya AYRICA tətbiq olunmalıdır.)
-- ============================================================================

BEGIN;

ALTER TABLE import_partiyalari
  DROP CONSTRAINT IF EXISTS import_partiyalari_status_check;

ALTER TABLE import_partiyalari
  DROP CONSTRAINT IF EXISTS import_partiyalari_sablon_nov_check;

COMMIT;
