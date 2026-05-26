-- ============================================================================
-- H2: Məhsul filter/sort SQL-də olsun
-- ============================================================================
-- Audit aşkarladı ki, stok_status (var/az/yox) və marja sıralaması fetch
-- edildikdən sonra in-memory tətbiq olunur → paginasiya pozulur, total yanlış,
-- page 2-də 50-dən az nəticə görünür.
--
-- Həll: mehsullar.stok_cemi sütununu denormalizə et + stok cədvəlində trigger
-- ilə avtomatik yenilə. Beləliklə Prisma WHERE/ORDER BY səviyyəsində filter
-- edə bilər.
-- ============================================================================

BEGIN;

-- 1. Sütun əlavə et (DECIMAL — fraction stok dəstəkləyə bilər)
ALTER TABLE mehsullar
  ADD COLUMN IF NOT EXISTS stok_cemi DECIMAL(14, 3) DEFAULT 0;

-- 2. Mövcud datadan dəyər doldur
UPDATE mehsullar m
   SET stok_cemi = COALESCE(s.cemi, 0)
  FROM (
    SELECT mehsul_id, SUM(miqdar) AS cemi
      FROM stok
     GROUP BY mehsul_id
  ) s
 WHERE m.id = s.mehsul_id;

-- 3. Trigger funksiyası — stok cədvəlində dəyişdiyi vaxt mehsullar.stok_cemi
--    təzələnir.
CREATE OR REPLACE FUNCTION fn_mehsul_stok_cemi_yenile()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE mehsullar SET stok_cemi = COALESCE((SELECT SUM(miqdar) FROM stok WHERE mehsul_id = NEW.mehsul_id), 0)
      WHERE id = NEW.mehsul_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE mehsullar SET stok_cemi = COALESCE((SELECT SUM(miqdar) FROM stok WHERE mehsul_id = NEW.mehsul_id), 0)
      WHERE id = NEW.mehsul_id;
    IF (OLD.mehsul_id != NEW.mehsul_id) THEN
      UPDATE mehsullar SET stok_cemi = COALESCE((SELECT SUM(miqdar) FROM stok WHERE mehsul_id = OLD.mehsul_id), 0)
        WHERE id = OLD.mehsul_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE mehsullar SET stok_cemi = COALESCE((SELECT SUM(miqdar) FROM stok WHERE mehsul_id = OLD.mehsul_id), 0)
      WHERE id = OLD.mehsul_id;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stok_cemi_yenile ON stok;
CREATE TRIGGER trg_stok_cemi_yenile
AFTER INSERT OR UPDATE OR DELETE ON stok
FOR EACH ROW EXECUTE FUNCTION fn_mehsul_stok_cemi_yenile();

-- 4. Index — sort/filter performance üçün
CREATE INDEX IF NOT EXISTS idx_mehsul_stok_cemi
  ON mehsullar (sahibkar_id, stok_cemi);

-- 5. Marja sıralaması üçün computed column da əlavə edək — sort lazımdırsa
--    Prisma raw orderBy ola bilər, hələ qoymuruq, son_qiymet/satis_qiymeti
--    fərqi əsasında sort SQL-də bunda işlədəcəyik.

COMMIT;
