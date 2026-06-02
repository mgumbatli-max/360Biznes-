-- ============================================================================
-- M: kontragentler.getirdi_id — bonus filtri üçün "müştərini kim gətirdi"
-- ============================================================================
-- Bonus profili yeni filtr alternativi qazanır: "yalnız özü gətirdiyi müştərilərdən".
-- `menecer_id` təyinatdır (admin dəyişə bilər) — `getirdi_id` isə müştərinin
-- ilk yaradılma anında qeydiyyata düşür və sonradan dəyişmir (immutable by
-- convention — application-da update edilmir).
--
-- BACKFILL siyasəti: mövcud müştərilər üçün `getirdi_id` NULL qalır
-- (sistemdə "gətirən" qeyd edilməyib). Yeni gələn işçilərə köhnə müştərilərdən
-- bonus DÜŞMÜR, çünki NULL ≠ istifadəci.id.
-- ============================================================================

BEGIN;

ALTER TABLE kontragentler
  ADD COLUMN IF NOT EXISTS getirdi_id UUID;

-- FK — istifadəçi silinsə də, müştəri qalsın (audit izi pozulmasın)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kontragentler_getirdi_id_fkey'
  ) THEN
    ALTER TABLE kontragentler
      ADD CONSTRAINT kontragentler_getirdi_id_fkey
      FOREIGN KEY (getirdi_id) REFERENCES istifadeciler (id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END$$;

-- Bonus hesablamasında `WHERE getirdi_id = $1` çağırılır — index kritikdir.
CREATE INDEX IF NOT EXISTS idx_kontragentler_getirdi
  ON kontragentler (getirdi_id)
  WHERE getirdi_id IS NOT NULL;

COMMIT;
