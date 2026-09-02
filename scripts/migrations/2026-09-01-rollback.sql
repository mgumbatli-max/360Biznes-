-- ============================================================================
-- 2026-09-01 · ROLLBACK — tenant-scoped sənəd nömrələrini geri qaytar
-- ============================================================================
--
-- ⚠️ VAXT HƏSSASDIR
--   Bu rollback qlobal `UNIQUE (nomre)` constraint-ini bərpa edir. Migration
--   tətbiq olunandan sonra iki fərqli kirayəçi EYNİ nömrəni yarada bilər —
--   belə bir cüt yaranan kimi rollback ARTIQ MÜMKÜN OLMUR (constraint
--   qurulmayacaq). Ona görə rollback ancaq migration-dan DƏRHAL sonra,
--   yeni sənəd yaradılmadan əvvəl işləyir.
--
--   Addım 0 bunu əvvəlcədən yoxlayır: qlobal təkrar varsa DAYANIR və
--   problemli nömrələri sadalayır (heç nəyi zorla dəyişmir).
--
-- NƏ EDİR
--   1. Qlobal təkrar yoxlaması (blokedici)
--   2. Köhnə `UNIQUE (nomre)` constraint-ini bərpa edir
--   3. Composite `UNIQUE (sahibkar_id, nomre)` constraint-ini silir
--
-- NƏ ETMİR
--   • `sened_nomre_counter` seed-i GERİ QAYTARILMIR. Sayğacın irəli getməsi
--     zərərsizdir: yalnız nömrələrdə boşluq yaranır, toqquşma yaranmır.
--     Geri qaytarmaq daha risklidir (sayğacı aşağı salmaq = toqquşma).
--   • Heç bir biznes sətri silinmir/dəyişmir.
--
-- İDEMPOTENT: təkrar icra təhlükəsizdir (IF EXISTS / IF NOT EXISTS).
--
-- ⚠️ ONLINE (CONCURRENTLY) yolu ilə tətbiq edilmişdisə: bu rollback köhnə
--   constraint-i BLOKLAYARAQ qurur. Böyük cədvəldə bu, uzun ACCESS EXCLUSIVE
--   lock deməkdir. Belə halda əvvəlcə
--     CREATE UNIQUE INDEX CONCURRENTLY <tbl>_nomre_key_idx ON <tbl>(nomre);
--     ALTER TABLE <tbl> ADD CONSTRAINT <tbl>_nomre_key UNIQUE USING INDEX <tbl>_nomre_key_idx;
--   ardıcıllığını işlədin.
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;

-- ── ADDIM 0: rollback mümkündürmü? ─────────────────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['alis_sifarisleri','anbar_transferleri','catdirmalar',
                         'inventarizasiyalar','qaytarma_sifarisleri','rezervler',
                         'satis_sifarisleri','servis_qeydleri'];
  dup bigint;
  total bigint := 0;
  rec record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM (SELECT nomre FROM public.%I GROUP BY nomre HAVING COUNT(*) > 1) z', t
    ) INTO dup;
    IF dup > 0 THEN
      total := total + dup;
      RAISE WARNING '✗ %: % nömrə kirayəçilər arasında TƏKRARLANIR', t, dup;
      FOR rec IN EXECUTE format(
        'SELECT nomre, COUNT(*) c, array_agg(DISTINCT sahibkar_id) tenants
           FROM public.%I GROUP BY nomre HAVING COUNT(*) > 1 LIMIT 20', t
      ) LOOP
        RAISE WARNING '    «%» × % (tenantlar: %)', rec.nomre, rec.c, rec.tenants;
      END LOOP;
    END IF;
  END LOOP;

  IF total > 0 THEN
    RAISE EXCEPTION
      'ROLLBACK MÜMKÜN DEYİL: % qlobal təkrar nömrə var. Qlobal UNIQUE(nomre) '
      'bərpa edilə bilməz. Rollback yalnız migration-dan DƏRHAL sonra, yeni '
      'sənədlər yaradılmadan əvvəl mümkündür. İrəli getmək tövsiyə olunur.', total;
  END IF;
  RAISE NOTICE 'rollback mümkündür: qlobal təkrar yoxdur';
END $$;

-- ── ADDIM 1: köhnə qlobal constraint-i bərpa et ────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['alis_sifarisleri','anbar_transferleri','catdirmalar',
                         'inventarizasiyalar','qaytarma_sifarisleri','rezervler',
                         'satis_sifarisleri','servis_qeydleri'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = t || '_nomre_key' AND conrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (nomre)', t, t || '_nomre_key');
      RAISE NOTICE 'bərpa edildi: %_nomre_key', t;
    ELSE
      RAISE NOTICE 'artıq mövcuddur: %_nomre_key', t;
    END IF;
  END LOOP;
END $$;

-- ── ADDIM 2: composite constraint-i sil ────────────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['alis_sifarisleri','anbar_transferleri','catdirmalar',
                         'inventarizasiyalar','qaytarma_sifarisleri','rezervler',
                         'satis_sifarisleri','servis_qeydleri'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = t || '_sah_nomre_uniq' AND conrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, t || '_sah_nomre_uniq');
      RAISE NOTICE 'silindi: %_sah_nomre_uniq', t;
    ELSE
      RAISE NOTICE 'onsuz da yoxdur: %_sah_nomre_uniq', t;
    END IF;
    -- Online yolundan qalmış sərbəst indeks varsa o da təmizlənsin
    EXECUTE format('DROP INDEX IF EXISTS public.%I', t || '_sah_nomre_uniq');
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK-DAN SONRA: schema.prisma-nı da geri qaytarmaq lazımdır —
--   `@@unique([sahibkar_id, nomre])` sətirlərini silin,
--   `nomre String @unique` sahə atributunu bərpa edin,
--   sonra `npx prisma generate`.
-- Əks halda ORM sxemi DB ilə uyğunsuz qalar.
-- ============================================================================
