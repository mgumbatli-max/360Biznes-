-- ============================================================================
-- TƏCİLİ: Sənəd nömrəsi generatoru — `next_sened_nomre` funksiyası və
-- `sened_nomre_counter` cədvəli mövcudluğunu təmin et (idempotent).
--
-- Bu migration `2026-05-26-critical-fixes.sql`-də olan eyni funksiyanı
-- yenidən təyin edir. Əgər köhnə migration tətbiq olunmayıbsa, bu satışları
-- tamamilə bloklayan `function next_send_num(...) does not exist` xətasını
-- aradan qaldırır.
-- ============================================================================

BEGIN;

-- 1. Counter cədvəli
CREATE TABLE IF NOT EXISTS sened_nomre_counter (
  sahibkar_id UUID NOT NULL,
  prefix      VARCHAR(20) NOT NULL,
  il          INTEGER NOT NULL,
  son_nomre   INTEGER NOT NULL DEFAULT 0,
  yenilendi   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (sahibkar_id, prefix, il)
);

-- 2. Atomic next-number funksiyası (CREATE OR REPLACE — re-deploy-safe)
CREATE OR REPLACE FUNCTION next_sened_nomre(
  p_sahibkar_id UUID,
  p_prefix      VARCHAR,
  p_il          INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_il  INTEGER := COALESCE(p_il, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_num INTEGER;
BEGIN
  INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre, yenilendi)
  VALUES (p_sahibkar_id, p_prefix, v_il, 1, NOW())
  ON CONFLICT (sahibkar_id, prefix, il) DO UPDATE
    SET son_nomre = sened_nomre_counter.son_nomre + 1,
        yenilendi = NOW()
  RETURNING son_nomre INTO v_num;
  RETURN v_num;
END $$ LANGUAGE plpgsql;

-- 3. Mövcud satışlardan counter-i seed et (tək dəfə — ON CONFLICT DO NOTHING)
INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre)
SELECT sahibkar_id, 'satis', EXTRACT(YEAR FROM tarix)::INTEGER,
       COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(SPLIT_PART(nomre, '-', 3), '\D', '', 'g'), '') AS INTEGER)), 0)
  FROM satis_sifarisleri
 WHERE nomre IS NOT NULL AND nomre ~ '[0-9]'
 GROUP BY sahibkar_id, EXTRACT(YEAR FROM tarix)
ON CONFLICT DO NOTHING;

INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre)
SELECT sahibkar_id, 'alis', EXTRACT(YEAR FROM tarix)::INTEGER,
       COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(SPLIT_PART(nomre, '-', 3), '\D', '', 'g'), '') AS INTEGER)), 0)
  FROM alis_sifarisleri
 WHERE nomre IS NOT NULL AND nomre ~ '[0-9]'
 GROUP BY sahibkar_id, EXTRACT(YEAR FROM tarix)
ON CONFLICT DO NOTHING;

INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre)
SELECT sahibkar_id, 'qaytarma', EXTRACT(YEAR FROM tarix)::INTEGER,
       COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(SPLIT_PART(nomre, '-', 3), '\D', '', 'g'), '') AS INTEGER)), 0)
  FROM qaytarma_sifarisleri
 WHERE nomre IS NOT NULL AND nomre ~ '[0-9]'
 GROUP BY sahibkar_id, EXTRACT(YEAR FROM tarix)
ON CONFLICT DO NOTHING;

INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre)
SELECT sahibkar_id, 'teklif', EXTRACT(YEAR FROM tarix)::INTEGER,
       COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(SPLIT_PART(nomre, '-', 3), '\D', '', 'g'), '') AS INTEGER)), 0)
  FROM teklifler
 WHERE nomre IS NOT NULL AND nomre ~ '[0-9]'
 GROUP BY sahibkar_id, EXTRACT(YEAR FROM tarix)
ON CONFLICT DO NOTHING;

COMMIT;
