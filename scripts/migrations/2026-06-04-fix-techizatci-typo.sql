-- ============================================================================
-- FIX: kontragentler.nov check constraint typo
-- ============================================================================
-- DB-də CHECK constraint `kontragent_nov_dogru` 'techiazatci' (yanlış yazılış)
-- saxlayırdı. Kod isə doğru `techizatci` istifadə edir. Bu səbəbdən:
--   - quickCreateSupplier server action 23514 (check_violation) verirdi
--   - kontragentler.nov sütununda mövcud təchizatçılar 'techiazatci' typo ilə
--     saxlanılıb, kod isə 'techizatci' axtarır → query-lərdə görünmürdülər.
--
-- 1) Mövcud data-da typo-nu düzəlt
-- 2) Köhnə CHECK constraint-i sil
-- 3) Doğru spelling ilə CHECK yenidən yarat
-- ============================================================================

BEGIN;

-- 1) Köhnə yanlış constraint-i sil (içində 'techiazatci' typo var)
ALTER TABLE kontragentler
  DROP CONSTRAINT IF EXISTS kontragent_nov_dogru;

-- 2) Mövcud sətirləri düzəlt (typo'lu nov-u doğru spelling-ə köçür)
UPDATE kontragentler
   SET nov = 'techizatci'
 WHERE nov = 'techiazatci';

-- 3) Düzgün CHECK constraint
ALTER TABLE kontragentler
  ADD CONSTRAINT kontragent_nov_dogru
  CHECK (nov IN ('musteri', 'techizatci', 'her_ikisi'));

COMMIT;
