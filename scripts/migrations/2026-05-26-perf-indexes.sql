-- ============================================================================
-- M1: Performance index-lər (audit MEDIUM/SUGGESTION)
-- ============================================================================
-- Audit: EXTRACT(MONTH dogum_tarixi) full-scan edir — index yoxdur.
-- Plus: əlavə tez-tez query olunan kombinasiyalar üçün partial indekslər.
-- ============================================================================

BEGIN;

-- 1. Doğum ayı axtarışı üçün EXPRESSION INDEX
--    EXTRACT(MONTH FROM dogum_tarixi) sorğusu seq-scan-dan B-tree lookup-a keçir.
CREATE INDEX IF NOT EXISTS idx_kontragent_dogum_ay
  ON kontragentler ((EXTRACT(MONTH FROM dogum_tarixi)::INTEGER))
  WHERE dogum_tarixi IS NOT NULL AND aktiv = true;

-- 2. son_satis_de — sort by "ən gec satılan" query-lərində istifadə olunur
CREATE INDEX IF NOT EXISTS idx_mehsul_son_satis_de
  ON mehsullar (sahibkar_id, son_satis_de NULLS FIRST)
  WHERE aktiv = true;

-- 3. Aktiv qiymət_tipi axtarışları
CREATE INDEX IF NOT EXISTS idx_kontragent_qiymet_tipi
  ON kontragentler (sahibkar_id, qiymet_tipi)
  WHERE qiymet_tipi IS NOT NULL AND aktiv = true;

-- 4. Tapşırıq overdue üçün partial — deadline + status kombinasiyası
CREATE INDEX IF NOT EXISTS idx_tapshiriq_overdue
  ON tapshiriqlar (sahibkar_id, deadline)
  WHERE deadline IS NOT NULL AND status NOT IN ('tamamlandi', 'legv');

-- 5. Audit log outbox — pending retry-lər üçün
--    (gələcəkdə outbox table əlavə edəndə hazır olsun)

COMMIT;
