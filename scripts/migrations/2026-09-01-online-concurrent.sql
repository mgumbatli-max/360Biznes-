-- ============================================================================
-- 2026-09-01 · Sənəd nömrələrini tenant-scoped et  (ONLINE / CONCURRENT YOL)
-- ============================================================================
--
-- NƏ VAXT BU FAYLI İŞLƏDİN
--   Hədəf cədvəllərdən hər hansı biri ~100k sətirdən böyükdürsə. Ölçünü
--   `2026-09-01-verification-queries.sql` A1 sorğusu göstərir.
--   Kiçik/orta cədvəllər üçün tranzaksiyalı variant daha sadədir:
--   `2026-09-01-tenant-scoped-doc-numbers.sql`.
--
-- NİYƏ AYRI FAYL — TRANSAKSİYA MƏHDUDİYYƏTİ
--   `CREATE INDEX CONCURRENTLY` tranzaksiya blokunda İŞLƏMİR (PostgreSQL
--   məhdudiyyəti). Ona görə bu fayl BİR tranzaksiya deyil — hər addım öz
--   avtomatik commit-i ilə icra olunur. Nəticə: atomik deyil, LAKİN hər addım
--   ayrıca idempotentdir və yarımçıq qalmış vəziyyət təhlükəsizdir
--   (aşağıdakı «YARIMÇIQ İCRA» bölməsinə bax).
--
-- LOCK PROFİLİ
--   Addım 2 (CREATE UNIQUE INDEX CONCURRENTLY): cədvəli BLOKLAMIR —
--     yazma və oxu davam edir; əvəzində iki dəfə skan edir və daha uzun çəkir.
--   Addım 3 (ADD CONSTRAINT … USING INDEX): ACCESS EXCLUSIVE, lakin indeks
--     ARTIQ hazır olduğu üçün yalnız katalog yeniləməsidir — millisaniyələr.
--   Addım 4 (DROP CONSTRAINT): ACCESS EXCLUSIVE, katalog əməliyyatı —
--     millisaniyələr.
--   Yəni uzun iş kilidsiz, kilidli iş qısadır.
--
-- ⚠️ NEON QEYDİ: pooled (`-pooler`) URL `CONCURRENTLY`-ni dəstəkləmir.
--   UNPOOLED / DIRECT URL istifadə edin (layihədə `DATABASE_URL_UNPOOLED`
--   və ya `DIRECT_URL`) — eyni qayda `scripts/apply-perf-indexes-prod.mjs`
--   faylında da qeyd olunub.
--
-- İCRA QAYDASI
--   1) psql "$DIRECT_URL" -f scripts/migrations/2026-09-01-preflight.sql
--      (təmiz keçməlidir — əks halda DAYANIN)
--   2) psql "$DIRECT_URL" -f scripts/migrations/2026-09-01-online-concurrent.sql
--   3) psql "$DIRECT_URL" -f scripts/migrations/2026-09-01-verification-queries.sql
--
-- YARIMÇIQ İCRA — TƏHLÜKƏSİZLİK
--   • Addım 2-də fail: INVALID indeks qalır. O, sorğulara TƏSİR ETMİR
--     (planner istifadə etmir) və unikallıq tətbiq etmir. Addım 1 onu
--     avtomatik təmizləyir → faylı sadəcə yenidən işlədin.
--   • Addım 3-dən sonra, addım 4-dən əvvəl fail: cədvəldə HƏM composite,
--     HƏM köhnə qlobal constraint olur. Bu, ƏN MƏHDUDLAŞDIRICI vəziyyətdir —
--     data təhlükəsizdir, sadəcə köhnə qlobal qayda hələ qüvvədədir
--     (yəni problem hələ həll olunmayıb, amma heç nə pozulmayıb).
--     Faylı yenidən işlədin — addım 4 tamamlanacaq.
--   • Heç bir addım data yazmır/silmir (addım 5 yalnız sayğac cədvəlinə).
--
-- ROLLBACK: `2026-09-01-rollback.sql`
-- ============================================================================

\set ON_ERROR_STOP on

-- Kilidli addımlar üçün mühafizə. CONCURRENTLY addımı uzun çəkə bilər, ona
-- görə statement_timeout burada geniş, lock_timeout isə dar saxlanılır.
SET lock_timeout = '5s';
SET statement_timeout = '0';          -- CONCURRENTLY üçün limitsiz
SET idle_in_transaction_session_timeout = '60s';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 1 — Əvvəlki yarımçıq icradan qalmış INVALID indeksləri təmizlə     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- CREATE INDEX CONCURRENTLY fail olduqda arxada işlək olmayan (`indisvalid =
-- false`) indeks qalır. Onu silmədən `IF NOT EXISTS` yeni indeksin
-- yaradılmasını səhvən atlayardı.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT i.relname AS idx
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace AND n.nspname = 'public'
     WHERE NOT ix.indisvalid
       AND i.relname LIKE '%\_sah\_nomre\_uniq'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.idx);
    RAISE NOTICE 'INVALID indeks təmizləndi: %', r.idx;
  END LOOP;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 2 — Composite unique indeksi KİLİDSİZ qur                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Hər ifadə ayrıca icra olunur (CONCURRENTLY tranzaksiya qəbul etmir).
-- `IF NOT EXISTS` təkrar icranı təhlükəsiz edir.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS alis_sifarisleri_sah_nomre_uniq
    ON public.alis_sifarisleri (sahibkar_id, nomre);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS anbar_transferleri_sah_nomre_uniq
    ON public.anbar_transferleri (sahibkar_id, nomre);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS catdirmalar_sah_nomre_uniq
    ON public.catdirmalar (sahibkar_id, nomre);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS inventarizasiyalar_sah_nomre_uniq
    ON public.inventarizasiyalar (sahibkar_id, nomre);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS qaytarma_sifarisleri_sah_nomre_uniq
    ON public.qaytarma_sifarisleri (sahibkar_id, nomre);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS rezervler_sah_nomre_uniq
    ON public.rezervler (sahibkar_id, nomre);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS satis_sifarisleri_sah_nomre_uniq
    ON public.satis_sifarisleri (sahibkar_id, nomre);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS servis_qeydleri_sah_nomre_uniq
    ON public.servis_qeydleri (sahibkar_id, nomre);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 2b — Yaradılan indekslərin VALID olduğunu təsdiqlə                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- INVALID qalıbsa növbəti addımlar icra olunmamalıdır.
DO $$
DECLARE bad int;
BEGIN
  SELECT COUNT(*) INTO bad
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = i.relnamespace AND n.nspname = 'public'
   WHERE NOT ix.indisvalid AND i.relname LIKE '%\_sah\_nomre\_uniq';
  IF bad > 0 THEN
    RAISE EXCEPTION 'DAYAN: % INVALID composite indeks var. Addım 1-i yenidən '
                    'işlədib addım 2-ni təkrarlayın (səbəb adətən unikallıq '
                    'pozuntusu və ya kəsilmiş sessiyadır).', bad;
  END IF;
  RAISE NOTICE 'bütün composite indekslər VALID';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 3+4 — İndeksi constraint-ə çevir və köhnəni sil (qısa kilid)       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Bu iki addım BİR tranzaksiyada birləşdirilir: cədvəl bir anlıq kilidlənir,
-- hər iki katalog dəyişikliyi atomik tətbiq olunur, sonra kilid buraxılır.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['alis_sifarisleri','anbar_transferleri','catdirmalar',
                         'inventarizasiyalar','qaytarma_sifarisleri','rezervler',
                         'satis_sifarisleri','servis_qeydleri'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 3) indeks → constraint (yalnız constraint hələ yoxdursa)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = t || '_sah_nomre_uniq' AND conrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE USING INDEX %I',
        t, t || '_sah_nomre_uniq', t || '_sah_nomre_uniq');
      RAISE NOTICE 'constraint-ə çevrildi: %_sah_nomre_uniq', t;
    ELSE
      RAISE NOTICE 'artıq constraint-dir: %_sah_nomre_uniq', t;
    END IF;

    -- 4) köhnə qlobal constraint-i sil
    IF EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = t || '_nomre_key' AND conrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, t || '_nomre_key');
      RAISE NOTICE 'silindi: %_nomre_key', t;
    ELSE
      RAISE NOTICE 'onsuz da yoxdur: %_nomre_key', t;
    END IF;
  END LOOP;
END $$;

COMMIT;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 5 — sened_nomre_counter seed (tranzaksiyalı, P2 məntiqi ilə)       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
BEGIN;
SET LOCAL statement_timeout = '120s';

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
         substring(nomre from '^([A-Z]+)-') AS pfx,
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
