-- ============================================================================
-- 2026-09-01 · PREFLIGHT — standalone format inventarizasiyası və yoxlama
-- ============================================================================
--
-- YALNIZ OXU. Heç bir dəyişiklik etmir.
--
-- Nə edir:
--   • 8 cədvəldə nömrə formatlarını sadalayır (prefiks × say × nümunə)
--   • Sayğac seed ediləcək cədvəllərdə parse olunmayan / tanınmayan prefiksli /
--     integer həddini aşan nömrə varsa → EXCEPTION ilə DAYANIR və problemli
--     sətirləri tək-tək sadalayır
--   • Sayğacsız cədvəllərdə (catdirmalar, rezervler) belə nömrələri yalnız
--     XƏBƏRDARLIQ kimi göstərir
--   • NULL sahibkar_id / boş nomre və tenant-daxili təkrarları yoxlayır
--
-- Bu yoxlama tranzaksiyalı migration faylının içində DƏ var (atlanıla bilməz).
-- Bu standalone nüsxə ONLINE (CONCURRENTLY) yolu üçün və istənilən vaxt
-- vəziyyəti yoxlamaq üçündür.
--
-- İşlətmə:
--   psql "$DIRECT_URL" -f scripts/migrations/2026-09-01-preflight.sql
-- ============================================================================

SET statement_timeout = '120s';

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 0 — PREFLIGHT: format inventarizasiyası (P2 + P3)                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
  -- Sayğac seed EDİLƏN cədvəllər — burada NAMƏLUM format BLOKEDİCİDİR,
  -- çünki səhv parse sayğacı aşağı qoyur və növbəti sənəd toqquşur.
  strict_tables text[] := ARRAY[
    'satis_sifarisleri', 'alis_sifarisleri', 'qaytarma_sifarisleri',
    'anbar_transferleri', 'inventarizasiyalar', 'servis_qeydleri'
  ];
  -- Sayğac seed EDİLMƏYƏN cədvəllər — naməlum format yalnız xəbərdarlıqdır.
  lax_tables text[] := ARRAY['catdirmalar', 'rezervler'];
  t text;
  bad_cnt bigint;
  ext_cnt bigint;
  total_bad bigint := 0;
  rec record;
BEGIN
  RAISE NOTICE '─── PREFLIGHT: nömrə formatı inventarizasiyası (sinif üzrə) ───';
  RAISE NOTICE '    sequential = mərkəzi sayğacdan, MAX hesablamasına daxildir';
  RAISE NOTICE '    external   = kənar/təsadüfi mənbə, sayğaca DAXİL EDİLMİR';
  RAISE NOTICE '    unknown    = nə parse olunur, nə tanınır → BLOKEDİCİ';

  -- (a) BLOKEDİCİ cədvəllər
  FOREACH t IN ARRAY strict_tables LOOP
    -- Sinif üzrə inventar (lib/db/sened-nomre.ts parseri ilə EYNİ qaydalar)
    FOR rec IN EXECUTE format($q$
      SELECT %L AS tbl, sinif, prefiks, COUNT(*)::bigint AS say, MIN(nomre) AS numune,
             MAX(sira) AS max_sira
        FROM (
          SELECT nomre,
                 COALESCE(substring(nomre from '^([A-Z]+)-'), '') AS prefiks,
                 CASE
                   WHEN COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN ('WH','LEAD','CT','RZ')
                     THEN 'external'
                   WHEN COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN
                        ('SATIS','S','SS','WS','POS','MARKET','KREDIT','ALIS','ALS','AS',
                         'QAYTARMA','QAY','TR','TRANSFER','INV','SAYIM','SR','SERVIS','TEKLIF','MEXARIC')
                    AND (nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' OR nomre ~ '^[A-Z]+-[0-9]+$')
                     THEN 'sequential'
                   ELSE 'unknown'
                 END AS sinif,
                 CASE
                   WHEN nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' THEN split_part(nomre,'-',3)::bigint
                   WHEN nomre ~ '^[A-Z]+-[0-9]+$'          THEN split_part(nomre,'-',2)::bigint
                 END AS sira
            FROM public.%I
        ) z GROUP BY sinif, prefiks ORDER BY sinif, say DESC
    $q$, t, t) LOOP
      RAISE NOTICE '  % · [%] %  × %  max_sıra=%  (məs. %)',
        rec.tbl, rec.sinif, rec.prefiks, rec.say, COALESCE(rec.max_sira::text,'—'), rec.numune;
    END LOOP;

    -- NAMƏLUM sinif — blokedici
    EXECUTE format($q$
      SELECT COUNT(*) FROM public.%I
       WHERE NOT (
         COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN ('WH','LEAD','CT','RZ')
         OR (COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN
             ('SATIS','S','SS','WS','POS','MARKET','KREDIT','ALIS','ALS','AS',
              'QAYTARMA','QAY','TR','TRANSFER','INV','SAYIM','SR','SERVIS','TEKLIF','MEXARIC')
             AND (nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' OR nomre ~ '^[A-Z]+-[0-9]+$'))
       )
    $q$, t) INTO bad_cnt;
    IF bad_cnt > 0 THEN
      total_bad := total_bad + bad_cnt;
      RAISE WARNING '  ✗ %: % sətir NAMƏLUM formatdadır (nə sequential, nə external)', t, bad_cnt;
      FOR rec IN EXECUTE format($q$
        SELECT sahibkar_id, nomre FROM public.%I
         WHERE NOT (
           COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN ('WH','LEAD','CT','RZ')
           OR (COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN
               ('SATIS','S','SS','WS','POS','MARKET','KREDIT','ALIS','ALS','AS',
                'QAYTARMA','QAY','TR','TRANSFER','INV','SAYIM','SR','SERVIS','TEKLIF','MEXARIC')
               AND (nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' OR nomre ~ '^[A-Z]+-[0-9]+$'))
         ) ORDER BY nomre LIMIT 20
      $q$, t) LOOP
        RAISE WARNING '      tenant=% nomre=«%»', rec.sahibkar_id, rec.nomre;
      END LOOP;
    END IF;

    -- EXTERNAL sinif — məlumat üçün (sayğaca daxil edilmir, dayandırmır)
    EXECUTE format($q$
      SELECT COUNT(*) FROM public.%I
       WHERE COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN ('WH','LEAD','CT','RZ')
    $q$, t) INTO ext_cnt;
    IF ext_cnt > 0 THEN
      RAISE NOTICE '  ℹ %: % external nömrə — sayğac MAX hesablamasına DAXİL EDİLMİR', t, ext_cnt;
    END IF;

    -- Sıra hissəsi integer həddini aşır (yalnız sequential üçün)
    EXECUTE format($q$
      SELECT COUNT(*) FROM public.%I
       WHERE (nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' AND split_part(nomre,'-',3)::bigint > 2147483647)
          OR (nomre ~ '^[A-Z]+-[0-9]+$'          AND split_part(nomre,'-',2)::bigint > 2147483647)
    $q$, t) INTO bad_cnt;
    IF bad_cnt > 0 THEN
      total_bad := total_bad + bad_cnt;
      RAISE WARNING '  ✗ %: % sətirdə sıra nömrəsi integer həddini aşır', t, bad_cnt;
    END IF;
  END LOOP;

  -- (b) XƏBƏRDARLIQ cədvəlləri — dayanmır
  FOREACH t IN ARRAY lax_tables LOOP
    EXECUTE format($q$
      SELECT COUNT(*) FROM public.%I
       WHERE NOT (
         COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN ('WH','LEAD','CT','RZ')
         OR (COALESCE(substring(nomre from '^([A-Z]+)-'), '') IN
             ('SATIS','S','SS','WS','POS','MARKET','KREDIT','ALIS','ALS','AS',
              'QAYTARMA','QAY','TR','TRANSFER','INV','SAYIM','SR','SERVIS','TEKLIF','MEXARIC')
             AND (nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' OR nomre ~ '^[A-Z]+-[0-9]+$'))
       )
    $q$, t) INTO bad_cnt;
    IF bad_cnt > 0 THEN
      RAISE NOTICE '  ⚠ % (sayğacsız): % naməlum formatlı nömrə — migration dayanmır,', t, bad_cnt;
      RAISE NOTICE '     çünki bu cədvəl `sened_nomre_counter` istifadə etmir; nömrələr toxunulmur.';
      FOR rec IN EXECUTE format(
        'SELECT nomre FROM public.%I ORDER BY nomre LIMIT 10', t
      ) LOOP
        RAISE NOTICE '      «%»', rec.nomre;
      END LOOP;
    END IF;
  END LOOP;

  -- (c) NULL / boş nömrə — hər cədvəldə blokedici
  FOREACH t IN ARRAY (strict_tables || lax_tables) LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM public.%I WHERE sahibkar_id IS NULL OR nomre IS NULL OR nomre = ''''', t
    ) INTO bad_cnt;
    IF bad_cnt > 0 THEN
      total_bad := total_bad + bad_cnt;
      RAISE WARNING '  ✗ %: % sətirdə sahibkar_id və ya nomre NULL/boşdur', t, bad_cnt;
    END IF;
  END LOOP;

  -- (d) Tenant daxilində təkrar — composite constraint qurulmasını bloklayar
  FOREACH t IN ARRAY (strict_tables || lax_tables) LOOP
    EXECUTE format($q$
      SELECT COUNT(*) FROM (SELECT sahibkar_id, nomre FROM public.%I
                             GROUP BY 1,2 HAVING COUNT(*) > 1) z
    $q$, t) INTO bad_cnt;
    IF bad_cnt > 0 THEN
      total_bad := total_bad + bad_cnt;
      RAISE WARNING '  ✗ %: tenant daxilində % təkrar nömrə cütü', t, bad_cnt;
      FOR rec IN EXECUTE format($q$
        SELECT sahibkar_id, nomre, COUNT(*) AS c FROM public.%I
         GROUP BY 1,2 HAVING COUNT(*) > 1 LIMIT 20
      $q$, t) LOOP
        RAISE WARNING '      tenant=% nomre=«%» × %', rec.sahibkar_id, rec.nomre, rec.c;
      END LOOP;
    END IF;
  END LOOP;

  IF total_bad > 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT DAYANDIRDI: % problemli sətir aşkarlandı. Migration TƏTBİQ EDİLMƏDİ. '
      'Yuxarıdakı WARNING sətirlərinə baxın; problemli qeydləri əl ilə həll edin '
      '(bu migration heç bir mövcud nömrəni avtomatik dəyişmir).', total_bad;
  END IF;

  RAISE NOTICE '─── PREFLIGHT TƏMİZ: blokedici problem yoxdur ───';
END $$;

ROLLBACK;  -- yalnız oxu — heç nə commit edilmir
