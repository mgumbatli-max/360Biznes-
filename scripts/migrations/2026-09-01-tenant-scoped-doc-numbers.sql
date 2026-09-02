-- ============================================================================
-- 2026-09-01 · Sənəd nömrələrini tenant-scoped et  (TRANSAKSİYALI YOL)
-- Audit tapıntısı: "Sənəd nömrəsi qlobal unikal, sayğac isə tenant-üzrə"
-- ============================================================================
--
-- PROBLEM
--   8 cədvəldə `nomre` sütunu tək-sütunlu QLOBAL UNIQUE constraint daşıyır,
--   nömrə generatoru isə (`sened_nomre_counter`, açar: sahibkar_id+prefix+il)
--   tenant-üzrədir və nömrə mətnində tenantı fərqləndirən komponent yoxdur.
--   Nəticə: ikinci kirayəçinin ilk sənədi determinist P2002 ilə sınır.
--
-- HƏLL
--   UNIQUE(nomre) → UNIQUE(sahibkar_id, nomre)
--
-- ────────────────────────────────────────────────────────────────────────────
-- BU FAYL NƏ EDİR — DƏQİQ DAVRANIŞ  (P5: əvvəlki versiyada bu bölmə qeyri-dəqiq idi)
-- ────────────────────────────────────────────────────────────────────────────
--   1. PREFLIGHT: 8 cədvəldə nömrə formatı inventarizasiyası. Sayğac seed
--      ediləcək cədvəllərdə parse olunmayan və ya tanınmayan prefiksli nömrə
--      varsa → EXCEPTION ilə DAYANIR və problemli sətirləri sadalayır.
--      Sayğac seed edilməyən cədvəllərdə (catdirmalar, rezervler) belə nömrə
--      varsa → NOTICE ilə xəbərdarlıq verir, dayanmır (o nömrələr generatora
--      təsir etmir, yalnız composite unique-in əhatəsinə düşür).
--   2. Hər 8 cədvələ `UNIQUE (sahibkar_id, nomre)` constraint ƏLAVƏ edir.
--   3. Köhnə tək-sütunlu `UNIQUE (nomre)` constraint-ini SİLİR.
--   4. `sened_nomre_counter` cədvəlinə sətir YAZIR və mövcud sətirləri
--      YENİLƏYİR (`ON CONFLICT DO UPDATE` + `GREATEST` → yalnız irəli gedir,
--      heç vaxt geri qayıtmır).
--
--   ⚠️ DƏQİQLƏŞDİRMƏ: bu migration `sened_nomre_counter` cədvəlində sətir
--   YENİLƏYİR. Biznes cədvəllərində (satış, alış, qaytarma, transfer, sayım,
--   servis, çatdırma, rezerv) HEÇ BİR sətir silinmir, yenilənmir, əlavə
--   edilmir və heç bir `nomre` dəyəri dəyişdirilmir.
--
-- ────────────────────────────────────────────────────────────────────────────
-- TƏHLÜKƏSİZLİK
-- ────────────────────────────────────────────────────────────────────────────
--   • DROP TABLE / DROP COLUMN / TRUNCATE / DELETE — YOXDUR.
--   • Yeni constraint köhnənin SUPERSET-idir: qlobal unikal olan hər dəst
--     avtomatik (sahibkar_id, nomre) üzrə də unikaldır → mövcud data ilə
--     konflikt riyazi olaraq mümkün deyil.
--   • Tam tranzaksiyalıdır: ya hamısı tətbiq olunur, ya heç biri.
--   • İdempotentdir: təkrar icra 0 dəyişiklik edir (yoxlamalar IF EXISTS).
--   • lock_timeout / statement_timeout təyin olunub — uzun ACCESS EXCLUSIVE
--     lock növbəsi yaratmaq əvəzinə migration təmiz şəkildə fail olur.
--
-- ⚠️ LOCK XƏBƏRDARLIĞI (P4)
--   `ALTER TABLE … ADD CONSTRAINT UNIQUE` cədvəli ACCESS EXCLUSIVE kilidləyir
--   və indeksi BLOKLAYARAQ qurur — bu müddətdə cədvələ SELECT daxil hər giriş
--   dayanır. Kiçik/orta cədvəllər üçün bu, millisaniyələrdir.
--   ⇒ Hər hansı hədəf cədvəl ~100k sətirdən böyükdürsə BU FAYLI İŞLƏTMƏYİN;
--     `2026-09-01-online-concurrent.sql` (CREATE INDEX CONCURRENTLY yolu)
--     istifadə edin. Ölçünü preflight A1 sorğusu göstərir.
--
-- ROLLBACK: `2026-09-01-rollback.sql`
-- ============================================================================

-- ── Lock mühafizəsi ─────────────────────────────────────────────────────────
-- Kilid 5 saniyədən çox gözlənilirsə migration fail olur (tranzaksiya geri
-- qayıdır) — beləliklə uzun sorğu arxasında növbə yaranıb bütün tətbiqi
-- dondurmur. Timeout-a düşsə: trafik azalanda təkrar işlədin.
SET lock_timeout = '5s';
SET statement_timeout = '120s';
SET idle_in_transaction_session_timeout = '60s';

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


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 1 — Composite UNIQUE(sahibkar_id, nomre) əlavə et                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
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
       WHERE conname = t || '_sah_nomre_uniq' AND conrelid = ('public.' || t)::regclass
    ) THEN
      -- Əvvəlki yarımçıq icradan qalmış eyniadlı sərbəst indeks varsa təmizlə
      -- (constraint yoxdur, amma indeks qalıb) — idempotentlik üçün.
      IF EXISTS (SELECT 1 FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace
                  WHERE i.relname = t || '_sah_nomre_uniq' AND n.nspname = 'public') THEN
        EXECUTE format('DROP INDEX IF EXISTS public.%I', t || '_sah_nomre_uniq');
        RAISE NOTICE 'təmizləndi (yarımçıq icra qalığı): %_sah_nomre_uniq', t;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (sahibkar_id, nomre)',
                     t, t || '_sah_nomre_uniq');
      RAISE NOTICE 'əlavə edildi: %_sah_nomre_uniq', t;
    ELSE
      RAISE NOTICE 'artıq mövcuddur: %_sah_nomre_uniq', t;
    END IF;
  END LOOP;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 2 — Köhnə qlobal UNIQUE(nomre) constraint-ini sil                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
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
       WHERE conname = t || '_nomre_key' AND conrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, t || '_nomre_key');
      RAISE NOTICE 'silindi: %_nomre_key (qlobal unikal)', t;
    ELSE
      RAISE NOTICE 'onsuz da yoxdur: %_nomre_key', t;
    END IF;
  END LOOP;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 3 — sened_nomre_counter seed  (P2: il NÖMRƏDƏN çıxarılır)          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- P2 DÜZƏLİŞİ: əvvəlki versiya ili `tarix`/`yaradildi` SÜTUNUNDAN götürürdü.
-- Sənədin tarixi ilə nömrəsindəki il fərqli ola bilər (geriyə tarixli sənəd,
-- ilin dönüşü, NULL tarix → CURRENT_DATE) → sayğac səhv ilə yazılır və doğru
-- il üçün 1-dən başlayır → tenant daxilində P2002. İndi il MƏHZ NÖMRƏDƏN
-- oxunur: `split_part(nomre,'-',2)::int`.
--
-- Həmçinin sayğac GÖRÜNƏN PREFİKSƏ görə qruplaşdırılır, cədvələ görə yox:
-- `satis_sifarisleri` cədvəlində həm `SATIS-`, həm `MARKET-`, həm `KREDIT-`
-- nömrələri var və onlar `sened_nomre_counter`-də AYRI sayğaclardır.
-- Əvvəlki versiya hamısını bir sayğaca yığırdı — bu, ayrıca qüsur idi.
WITH parsed AS (
  SELECT sahibkar_id, nomre FROM satis_sifarisleri
  UNION ALL SELECT sahibkar_id, nomre FROM alis_sifarisleri
  UNION ALL SELECT sahibkar_id, nomre FROM qaytarma_sifarisleri
  UNION ALL SELECT sahibkar_id, nomre FROM anbar_transferleri
  UNION ALL SELECT sahibkar_id, nomre FROM inventarizasiyalar
  UNION ALL SELECT sahibkar_id, nomre FROM servis_qeydleri
),
classified AS (
  SELECT sahibkar_id, nomre,
         COALESCE(substring(nomre from '^([A-Z]+)-'), '') AS pfx,
         -- Format 1: PREFIKS-İL-SIRA   Format 2: PREFIKS-SIRA (köhnə POS)
         CASE WHEN nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' THEN 3
              WHEN nomre ~ '^[A-Z]+-[0-9]+$'          THEN 2 END AS seqment_sayi,
         CASE WHEN nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' THEN split_part(nomre,'-',3)::bigint
              WHEN nomre ~ '^[A-Z]+-[0-9]+$'          THEN split_part(nomre,'-',2)::bigint END AS sira
    FROM parsed
),
mapped AS (
  SELECT sahibkar_id,
         -- Görünən prefiks → sayğac namespace-i.
         -- lib/db/sened-nomre.ts → SEQUENTIAL_PREFIX_MAP ilə EYNİ olmalıdır.
         CASE pfx
           WHEN 'SATIS'    THEN 'satis'
           WHEN 'S'        THEN 'satis'
           WHEN 'SS'       THEN 'satis'   -- köhnə sistem (miqrasiya datası)
           WHEN 'WS'       THEN 'satis'   -- köhnə sistem — web satış
           WHEN 'POS'      THEN 'satis'   -- köhnə sistem — iki seqmentli format
           WHEN 'MARKET'   THEN 'market'
           WHEN 'KREDIT'   THEN 'kredit'
           WHEN 'ALIS'     THEN 'alis'
           WHEN 'ALS'      THEN 'alis'
           WHEN 'AS'       THEN 'alis'    -- satınalma sifarişi = alış sənədi
           WHEN 'QAYTARMA' THEN 'qaytarma'
           WHEN 'QAY'      THEN 'qaytarma'
           WHEN 'TR'       THEN 'transfer'
           WHEN 'TRANSFER' THEN 'transfer'
           WHEN 'INV'      THEN 'sayim'
           WHEN 'SAYIM'    THEN 'sayim'
           WHEN 'SR'       THEN 'servis'
           WHEN 'SERVIS'   THEN 'servis'
         END AS prefix,
         -- İl HƏMİŞƏ nömrədən çıxarılır, sənədin tarix sütunundan DEYİL (P2).
         -- İki seqmentli formatda sıra `il×100000 + nömrə` sxemini daşıyır.
         CASE WHEN seqment_sayi = 3 THEN split_part(nomre,'-',2)::int
              WHEN seqment_sayi = 2 AND sira >= 100000000 THEN (sira / 100000)::int
         END AS il,
         sira
    FROM classified
   WHERE seqment_sayi IS NOT NULL
     -- EXTERNAL sinif sayğaca QƏTİYYƏN daxil edilmir: bu nömrələr kənar
     -- sistemə (WH: marketplace external_id) və ya təsadüfi dəyərə (LEAD, CT,
     -- RZ) bağlıdır. MAX(sira) onları saysaydı sayğac yüz minlərlə süni
     -- şəkildə irəli sıçrayardı — məs. RZ-2026-902190 → sayğac 902190.
     AND pfx NOT IN ('WH','LEAD','CT','RZ')
)
INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre, yenilendi)
SELECT sahibkar_id, prefix::varchar, il, MAX(sira)::int, NOW()
  FROM mapped
 WHERE prefix IS NOT NULL   -- naməlum prefiks preflight-də bloklanıb
   AND il IS NOT NULL       -- ili müəyyən edilə bilməyən nömrə sayğaca girmir
   AND sira <= 2147483647   -- integer həddi (preflight-də də yoxlanılıb)
 GROUP BY sahibkar_id, prefix, il
ON CONFLICT (sahibkar_id, prefix, il) DO UPDATE
   SET son_nomre = GREATEST(sened_nomre_counter.son_nomre, EXCLUDED.son_nomre),
       yenilendi = NOW();

COMMIT;

-- ============================================================================
-- TƏTBİQDƏN SONRA: `2026-09-01-verification-queries.sql` B bölməsini işlədin.
-- Xüsusilə B5 (sayğac ≥ mövcud maksimum) MÜTLƏQ 0 sətir qaytarmalıdır.
-- ============================================================================
