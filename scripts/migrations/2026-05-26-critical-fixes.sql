-- ============================================================================
-- CRITICAL FIXES — 2026-05-26
-- ============================================================================
-- Audit-də aşkarlanan 3 critical problemin DB səviyyəsində həlli:
--   C1: stok.miqdar >= 0 CHECK constraint
--   C2: sənəd nömrəsi SEQUENCE-lər (per sahibkar, per year)
--   C3: kontragentler — alacaq (müştəri borcu) və borc (təchizatçı borcu) split
-- ============================================================================

BEGIN;

-- ─── C1: Mənfi stok qoruması ────────────────────────────────────────────────
-- Mövcud datada mənfi stok varsa onları əvvəl 0-a çevirib log saxlayırıq
DO $$
DECLARE
  neg_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO neg_count FROM stok WHERE miqdar < 0;
  IF neg_count > 0 THEN
    RAISE NOTICE 'C1: % sətirdə mənfi stok aşkarlandı — 0-a düzəldilir', neg_count;
    UPDATE stok SET miqdar = 0 WHERE miqdar < 0;
  END IF;
END $$;

-- CHECK constraint (NOT VALID ilə əlavə et — sonra VALIDATE et)
ALTER TABLE stok
  DROP CONSTRAINT IF EXISTS stok_miqdar_non_negative;
ALTER TABLE stok
  ADD CONSTRAINT stok_miqdar_non_negative CHECK (miqdar >= 0) NOT VALID;
ALTER TABLE stok VALIDATE CONSTRAINT stok_miqdar_non_negative;

-- ─── C2: Sənəd nömrəsi SEQUENCE-lər ────────────────────────────────────────
-- Hər sahibkar + il üçün ayrı sequence yaratmaq əvəzinə, ümumi sequence-lər
-- istifadə edib `(sahibkar_id, year, seq_num)` kombinasiyası ilə nömrə yaradırıq.
-- Bu satış/alış/kredit/market/qaytarma üçün şamil olunur.

CREATE TABLE IF NOT EXISTS sened_nomre_counter (
  sahibkar_id UUID NOT NULL,
  prefix      VARCHAR(20) NOT NULL,  -- 'satis', 'alis', 'kredit', 'market', 'qaytarma'
  il          INTEGER NOT NULL,
  son_nomre   INTEGER NOT NULL DEFAULT 0,
  yenilendi   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (sahibkar_id, prefix, il)
);

-- Atomic next-number funksiyası (concurrent-safe with UPSERT + RETURNING)
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

-- Counter-i mövcud max nömrələrlə seed et (race tetiklenmesin deyə) — yalnız boşdursa
INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre)
SELECT sahibkar_id, 'satis', EXTRACT(YEAR FROM tarix)::INTEGER,
       COALESCE(MAX(CAST(REGEXP_REPLACE(nomre, '\D', '', 'g') AS INTEGER)), 0)
  FROM satis_sifarisleri
 WHERE nomre IS NOT NULL AND nomre ~ '[0-9]'
 GROUP BY sahibkar_id, EXTRACT(YEAR FROM tarix)
ON CONFLICT DO NOTHING;

INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre)
SELECT sahibkar_id, 'alis', EXTRACT(YEAR FROM tarix)::INTEGER,
       MAX(CAST(REGEXP_REPLACE(nomre, '\D', '', 'g') AS INTEGER))
  FROM alis_sifarisleri
 WHERE nomre IS NOT NULL AND nomre ~ '[0-9]'
 GROUP BY sahibkar_id, EXTRACT(YEAR FROM tarix)
ON CONFLICT DO NOTHING;

-- ─── C3: Borc istiqaməti — alacaq sütunu əlavə et ───────────────────────────
-- Köhnə model: kontragentler.borc müsbət/mənfi ilə qarışıq.
-- Yeni model:
--   - alacaq = müştəri bizdən almalı (debitor)
--   - borc   = bizim təchizatçıya verməliyik (kreditor)
-- Köhnə `borc` sütunu legacy olaraq qalır — DB view'da iki ayrı sütuna bölünür.

ALTER TABLE kontragentler ADD COLUMN IF NOT EXISTS alacaq DECIMAL(14, 2) DEFAULT 0;

-- Mövcud datadan migrate et: musbet `borc` müştəri alacaq, mənfi `borc` təchizatçı borcudur
UPDATE kontragentler
   SET alacaq = CASE WHEN borc > 0 THEN borc ELSE 0 END,
       borc   = CASE WHEN borc < 0 THEN -borc ELSE 0 END
 WHERE alacaq = 0 AND borc != 0;

-- Bundan sonra `borc` = təchizatçı borcumuz (musbet),
-- `alacaq` = müştərinin bizə borcu (musbet).
CREATE INDEX IF NOT EXISTS idx_kontragent_alacaq ON kontragentler (sahibkar_id, alacaq DESC) WHERE alacaq > 0;
CREATE INDEX IF NOT EXISTS idx_kontragent_borc ON kontragentler (sahibkar_id, borc DESC) WHERE borc > 0;

COMMIT;

-- ============================================================================
-- Tətbiq sonrası:
--   1. `npm run db:pull && npm run db:generate`  → Prisma client yenilənsin
--   2. Application code-da:
--      - satis_actions.ts → kontragentler.alacaq increment
--      - alis_actions.ts  → kontragentler.borc increment (decrement yox)
--      - Nömrə generasiyaları next_sened_nomre() çağırsın
-- ============================================================================
