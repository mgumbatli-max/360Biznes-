-- ============================================================================
-- 2026-09-02 · zemanetler.unikal_kod-u tenant-scoped et
-- Audit 2026-09-02: "unikal_kod qlobal UNIQUE, generatorlar race-unsafe"
-- ============================================================================
--
-- PROBLEM
--   `zemanetler.unikal_kod` tək-sütunlu QLOBAL UNIQUE constraint daşıyır,
--   halbuki auditlə sübut olundu ki, o, qlobal identifikator DEYİL:
--     • public zəmanət yoxlaması `qr_token` ilə gedir (queries.ts:getZemanetByToken)
--     • `unikal_kod` heç bir lookup/update/delete-də açar kimi işlədilmir
--     • ona istinad edən FOREIGN KEY yoxdur
--     • istifadəsi 100% ekranda göstərməkdir
--   İki generator uyğunsuz format verirdi və hər ikisi qüsurlu idi:
--     1) `nextUnikalKod()` — findFirst+max+1: 20 paralel çağırışda 1/20 unikal
--     2) POS `Math.random().toString(36)` — 36^6 məkan, `skipDuplicates:true`
--        ilə toqquşma səssizcə udulurdu (müştəri zəmanətsiz qalırdı)
--
-- HƏLL
--   UNIQUE(unikal_kod) → UNIQUE(sahibkar_id, unikal_kod)
--   Kod tərəfdə hər iki generator `nextDocNumber(tx, sahibkarId, "zemanet")`-ə
--   keçirilib (atomik `sened_nomre_counter` UPSERT, format `Z-YYYY-NNNNN` qorunur).
--
-- ⚠️ `qr_token` QLOBAL UNIQUE OLARAQ QALIR — o, public verification açarıdır
--    və bu migration ona TOXUNMUR.
--
-- ────────────────────────────────────────────────────────────────────────────
-- BU FAYL NƏ EDİR — DƏQİQ DAVRANIŞ
-- ────────────────────────────────────────────────────────────────────────────
--   1. PREFLIGHT: format/NULL/duplicate yoxlaması. Naməlum formatlı kod
--      varsa EXCEPTION ilə DAYANIR (səssiz davam etmir).
--   2. `UNIQUE (sahibkar_id, unikal_kod)` constraint ƏLAVƏ edir.
--   3. YALNIZ 2 uğurlu olduqdan sonra köhnə `UNIQUE (unikal_kod)`-u SİLİR.
--      (eyni tranzaksiyada — 2 fail olarsa 3-ə heç vaxt çatılmır)
--   4. `sened_nomre_counter`-ə `zemanet` prefiksi üçün sətir yazır/yeniləyir
--      (`GREATEST` — yalnız irəli).
--
--   Biznes cədvəllərində HEÇ BİR sətir silinmir, yenilənmir, əlavə edilmir;
--   heç bir `unikal_kod` və ya `qr_token` dəyəri dəyişdirilmir.
--   `sened_nomre_counter` cədvəlində sətir YAZILIR/YENİLƏNİR.
--
-- TƏHLÜKƏSİZLİK
--   • DROP TABLE / DROP COLUMN / TRUNCATE / DELETE — YOXDUR
--   • Yeni constraint köhnənin SUPERSET-idir → mövcud data ilə konflikt
--     riyazi olaraq mümkün deyil
--   • Tam tranzaksiyalı, idempotent, lock_timeout qoruyucusu ilə
--
-- ROLLBACK: `2026-09-02-zemanet-rollback.sql`
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '120s';
SET idle_in_transaction_session_timeout = '60s';

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 0 — PREFLIGHT                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
  bad_cnt bigint;
  total_bad bigint := 0;
  rec record;
BEGIN
  RAISE NOTICE '─── PREFLIGHT: zemanetler.unikal_kod ───';

  -- Format inventarı
  FOR rec IN
    SELECT CASE
             WHEN unikal_kod ~ '^Z-[0-9]{4}-[0-9]+$'      THEN 'sequential (Z-İL-RƏQƏM)'
             WHEN unikal_kod ~ '^Z-[0-9]{4}-[0-9A-Z]{6}$' THEN 'köhnə POS random'
             ELSE 'naməlum'
           END AS sinif,
           COUNT(*)::bigint AS say, MIN(unikal_kod) AS numune,
           MAX(CASE WHEN unikal_kod ~ '^Z-[0-9]{4}-[0-9]+$'
                    THEN split_part(unikal_kod,'-',3)::bigint END) AS max_sira
      FROM zemanetler GROUP BY 1 ORDER BY 2 DESC
  LOOP
    RAISE NOTICE '  [%] × %  max_sıra=%  (məs. %)',
      rec.sinif, rec.say, COALESCE(rec.max_sira::text,'—'), rec.numune;
  END LOOP;

  -- NULL / boş
  SELECT COUNT(*) INTO bad_cnt FROM zemanetler
   WHERE sahibkar_id IS NULL OR unikal_kod IS NULL OR unikal_kod = ''
      OR qr_token IS NULL OR qr_token = '';
  IF bad_cnt > 0 THEN
    total_bad := total_bad + bad_cnt;
    RAISE WARNING '  ✗ % sətirdə sahibkar_id/unikal_kod/qr_token NULL və ya boşdur', bad_cnt;
  END IF;

  -- Tenant daxilində təkrar — composite constraint-i bloklayar
  SELECT COUNT(*) INTO bad_cnt FROM (
    SELECT sahibkar_id, unikal_kod FROM zemanetler GROUP BY 1,2 HAVING COUNT(*) > 1) z;
  IF bad_cnt > 0 THEN
    total_bad := total_bad + bad_cnt;
    RAISE WARNING '  ✗ tenant daxilində % təkrar unikal_kod cütü', bad_cnt;
    FOR rec IN
      SELECT sahibkar_id, unikal_kod, COUNT(*) c FROM zemanetler
       GROUP BY 1,2 HAVING COUNT(*) > 1 LIMIT 20
    LOOP
      RAISE WARNING '      tenant=% kod=«%» × %', rec.sahibkar_id, rec.unikal_kod, rec.c;
    END LOOP;
  END IF;

  -- Naməlum format — sayğac seed-ini pozar
  SELECT COUNT(*) INTO bad_cnt FROM zemanetler
   WHERE unikal_kod !~ '^Z-[0-9]{4}-[0-9]+$'
     AND unikal_kod !~ '^Z-[0-9]{4}-[0-9A-Z]{6}$';
  IF bad_cnt > 0 THEN
    total_bad := total_bad + bad_cnt;
    RAISE WARNING '  ✗ % sətirdə NAMƏLUM formatlı unikal_kod', bad_cnt;
    FOR rec IN
      SELECT sahibkar_id, unikal_kod FROM zemanetler
       WHERE unikal_kod !~ '^Z-[0-9]{4}-[0-9]+$'
         AND unikal_kod !~ '^Z-[0-9]{4}-[0-9A-Z]{6}$' LIMIT 20
    LOOP
      RAISE WARNING '      tenant=% kod=«%»', rec.sahibkar_id, rec.unikal_kod;
    END LOOP;
  END IF;

  -- Sıra integer həddi
  SELECT COUNT(*) INTO bad_cnt FROM zemanetler
   WHERE unikal_kod ~ '^Z-[0-9]{4}-[0-9]+$'
     AND split_part(unikal_kod,'-',3)::bigint > 2147483647;
  IF bad_cnt > 0 THEN
    total_bad := total_bad + bad_cnt;
    RAISE WARNING '  ✗ % sətirdə sıra integer həddini aşır', bad_cnt;
  END IF;

  IF total_bad > 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT DAYANDIRDI: % problemli sətir. Migration TƏTBİQ EDİLMƏDİ. '
      'Yuxarıdakı WARNING sətirlərinə baxın; bu migration heç bir mövcud '
      'kodu avtomatik dəyişmir.', total_bad;
  END IF;

  RAISE NOTICE '─── PREFLIGHT TƏMİZ ───';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 1 — Composite UNIQUE(sahibkar_id, unikal_kod) ƏLAVƏ ET             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'zemanetler_sah_unikal_kod_uniq'
       AND conrelid = 'public.zemanetler'::regclass
  ) THEN
    -- Yarımçıq icradan qalmış eyniadlı sərbəst indeks varsa təmizlə
    IF EXISTS (SELECT 1 FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace
                WHERE i.relname = 'zemanetler_sah_unikal_kod_uniq' AND n.nspname = 'public') THEN
      DROP INDEX IF EXISTS public.zemanetler_sah_unikal_kod_uniq;
      RAISE NOTICE 'təmizləndi (yarımçıq icra qalığı): zemanetler_sah_unikal_kod_uniq';
    END IF;
    ALTER TABLE public.zemanetler
      ADD CONSTRAINT zemanetler_sah_unikal_kod_uniq UNIQUE (sahibkar_id, unikal_kod);
    RAISE NOTICE 'əlavə edildi: zemanetler_sah_unikal_kod_uniq';
  ELSE
    RAISE NOTICE 'artıq mövcuddur: zemanetler_sah_unikal_kod_uniq';
  END IF;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 2 — Köhnə qlobal UNIQUE(unikal_kod)-u SİL                          ║
-- ║   (yalnız ADDIM 1 uğurlu olduqdan sonra — eyni tranzaksiyadadır)         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
BEGIN
  -- Mühafizə: composite constraint yoxdursa köhnəni SİLMƏ
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'zemanetler_sah_unikal_kod_uniq'
       AND conrelid = 'public.zemanetler'::regclass
  ) THEN
    RAISE EXCEPTION 'DAYAN: composite constraint yaradılmayıb, köhnə constraint SİLİNMİR';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'zemanetler_unikal_kod_key'
       AND conrelid = 'public.zemanetler'::regclass
  ) THEN
    ALTER TABLE public.zemanetler DROP CONSTRAINT zemanetler_unikal_kod_key;
    RAISE NOTICE 'silindi: zemanetler_unikal_kod_key (qlobal unikal)';
  ELSE
    RAISE NOTICE 'onsuz da yoxdur: zemanetler_unikal_kod_key';
  END IF;

  -- qr_token qlobal unique OLARAQ QALMALIDIR — yoxla
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'zemanetler_qr_token_key'
       AND conrelid = 'public.zemanetler'::regclass
  ) THEN
    RAISE EXCEPTION 'DAYAN: qr_token qlobal UNIQUE constraint-i yoxdur — gözlənilməz vəziyyət';
  END IF;
  RAISE NOTICE 'qr_token qlobal UNIQUE toxunulmadı ✓';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ADDIM 3 — sened_nomre_counter seed (prefix = 'zemanet')                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- İl NÖMRƏDƏN çıxarılır (sənədin tarix sütunundan yox). Yalnız ardıcıl
-- formatlı kodlar sayılır — köhnə POS random kodları (`Z-YYYY-XXXXXX`)
-- sayğaca DAXİL EDİLMİR, çünki onların sıra komponenti yoxdur və `MAX()`
-- onları saysaydı nəticə mənasız olardı.
INSERT INTO sened_nomre_counter (sahibkar_id, prefix, il, son_nomre, yenilendi)
SELECT sahibkar_id,
       'zemanet'::varchar,
       split_part(unikal_kod,'-',2)::int,
       MAX(split_part(unikal_kod,'-',3)::bigint)::int,
       NOW()
  FROM zemanetler
 WHERE unikal_kod ~ '^Z-[0-9]{4}-[0-9]+$'
   AND split_part(unikal_kod,'-',3)::bigint <= 2147483647
 GROUP BY sahibkar_id, split_part(unikal_kod,'-',2)::int
ON CONFLICT (sahibkar_id, prefix, il) DO UPDATE
   SET son_nomre = GREATEST(sened_nomre_counter.son_nomre, EXCLUDED.son_nomre),
       yenilendi = NOW();

COMMIT;

-- ============================================================================
-- TƏTBİQDƏN SONRA yoxla:
--   • zemanetler_sah_unikal_kod_uniq (sahibkar_id, unikal_kod) mövcuddur
--   • zemanetler_unikal_kod_key YOXDUR
--   • zemanetler_qr_token_key (qr_token) HƏLƏ DƏ mövcuddur
--   • sayğac heç bir (tenant, il) qrupunda mövcud maksimumdan aşağı deyil
-- ============================================================================
