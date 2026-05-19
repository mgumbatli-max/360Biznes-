-- ============================================================================
-- Sahibkar bölmələri üçün cross-modul linking sütunları
-- ============================================================================
-- Bu SQL idempotent-dir (bir neçə dəfə icra etmək təhlükəsizdir — IF NOT EXISTS).
-- Workflow: psql ilə icra → sonra `npm run db:pull && npm run db:generate`
--
-- Tətbiq edir:
--   1) sahibkar_qeyd      — şəxsi qeydləri başqa entity-ə bağlamaq (#3 tapşırıq)
--   2) sahibkar_tapshiriq — tapşırıqları başqa entity-ə bağlamaq (#7 tapşırıq)
--   3) sahibkar_gizli_elaqe — gizli əlaqələri əntity-ə bağlamaq (#10 tapşırıq)
--
-- Polymorphic link sxemi: link_nov + link_id + link_label (cache-lənmiş ad).
--   link_nov: 'satinalma' | 'satis' | 'mehsul' | 'musteri' | 'techizatci'
--             | 'partiya' | 'tapshiriq' | 'qaime' | 'qeyd' | 'diger'
--   link_id:  uuid və ya integer-i string kimi saxlayır (cross-tip)
--   link_label: UI-da display üçün cache-lənmiş etiket
-- ============================================================================

BEGIN;

-- 1) sahibkar_qeyd
ALTER TABLE sahibkar_qeyd ADD COLUMN IF NOT EXISTS link_nov   VARCHAR(20);
ALTER TABLE sahibkar_qeyd ADD COLUMN IF NOT EXISTS link_id    VARCHAR(100);
ALTER TABLE sahibkar_qeyd ADD COLUMN IF NOT EXISTS link_label VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_sah_qeyd_link
  ON sahibkar_qeyd (sahibkar_id, link_nov, link_id)
  WHERE link_nov IS NOT NULL;

-- 2) sahibkar_tapshiriq
ALTER TABLE sahibkar_tapshiriq ADD COLUMN IF NOT EXISTS link_nov   VARCHAR(20);
ALTER TABLE sahibkar_tapshiriq ADD COLUMN IF NOT EXISTS link_id    VARCHAR(100);
ALTER TABLE sahibkar_tapshiriq ADD COLUMN IF NOT EXISTS link_label VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_sah_tapshiriq_link
  ON sahibkar_tapshiriq (sahibkar_id, link_nov, link_id)
  WHERE link_nov IS NOT NULL;

-- 3) sahibkar_gizli_elaqe (cədvəlin gerçək adı yoxlanmalıdır — db pull-dan
--    sonra düzəltməyə hazır ol)
-- Qeyd: yalnız cədvəl mövcuddursa icra et — pg_class yoxlaması.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sahibkar_gizli_elaqe') THEN
    EXECUTE 'ALTER TABLE sahibkar_gizli_elaqe ADD COLUMN IF NOT EXISTS link_nov   VARCHAR(20)';
    EXECUTE 'ALTER TABLE sahibkar_gizli_elaqe ADD COLUMN IF NOT EXISTS link_id    VARCHAR(100)';
    EXECUTE 'ALTER TABLE sahibkar_gizli_elaqe ADD COLUMN IF NOT EXISTS link_label VARCHAR(200)';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Tətbiq sonrası:
--   1) `npm run db:pull`     — Prisma schema-nı DB-dən yenidən oxu
--   2) `npm run db:generate` — Prisma client-i regenerate et
--   3) Server-i restart et   — yeni sütunlar TypeScript-də tanınsın
-- ============================================================================
