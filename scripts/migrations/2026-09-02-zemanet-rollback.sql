-- ============================================================================
-- 2026-09-02 · ROLLBACK — zemanetler.unikal_kod-u qlobal UNIQUE-ə qaytar
-- ============================================================================
-- ⚠️ VAXT HƏSSASDIR: migration-dan sonra iki tenant eyni `unikal_kod` yarada
--    bilər; belə cüt yaranan kimi rollback MÜMKÜN OLMUR. Addım 0 bunu yoxlayır.
-- `qr_token` bu faylda TOXUNULMUR.
-- İDEMPOTENT: təkrar icra təhlükəsizdir.
-- ============================================================================
SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;

DO $$
DECLARE dup bigint; rec record;
BEGIN
  SELECT COUNT(*) INTO dup FROM (
    SELECT unikal_kod FROM zemanetler GROUP BY 1 HAVING COUNT(*) > 1) z;
  IF dup > 0 THEN
    FOR rec IN SELECT unikal_kod, COUNT(*) c, array_agg(DISTINCT sahibkar_id) t
                 FROM zemanetler GROUP BY 1 HAVING COUNT(*) > 1 LIMIT 20
    LOOP
      RAISE WARNING '  «%» × % (tenantlar: %)', rec.unikal_kod, rec.c, rec.t;
    END LOOP;
    RAISE EXCEPTION
      'ROLLBACK MÜMKÜN DEYİL: % qlobal təkrar unikal_kod var. Qlobal UNIQUE '
      'bərpa edilə bilməz — rollback yalnız migration-dan DƏRHAL sonra mümkündür.', dup;
  END IF;
  RAISE NOTICE 'rollback mümkündür: qlobal təkrar yoxdur';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='zemanetler_unikal_kod_key'
                    AND conrelid='public.zemanetler'::regclass) THEN
    ALTER TABLE public.zemanetler ADD CONSTRAINT zemanetler_unikal_kod_key UNIQUE (unikal_kod);
    RAISE NOTICE 'bərpa edildi: zemanetler_unikal_kod_key';
  ELSE
    RAISE NOTICE 'artıq mövcuddur: zemanetler_unikal_kod_key';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname='zemanetler_sah_unikal_kod_uniq'
                AND conrelid='public.zemanetler'::regclass) THEN
    ALTER TABLE public.zemanetler DROP CONSTRAINT zemanetler_sah_unikal_kod_uniq;
    RAISE NOTICE 'silindi: zemanetler_sah_unikal_kod_uniq';
  ELSE
    RAISE NOTICE 'onsuz da yoxdur: zemanetler_sah_unikal_kod_uniq';
  END IF;
  DROP INDEX IF EXISTS public.zemanetler_sah_unikal_kod_uniq;
END $$;

COMMIT;

-- Rollback-dan sonra prisma/schema.prisma-nı da geri qaytarın:
--   `unikal_kod String @unique`, `@@unique([sahibkar_id, unikal_kod])` sil,
--   sonra `npx prisma generate`.
