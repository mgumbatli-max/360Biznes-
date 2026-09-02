-- ============================================================================
-- 2026-09-01 migration — ƏVVƏL və SONRA işlədiləcək yoxlama sorğuları
-- ============================================================================
-- Hamısı YALNIZ OXU. Heç bir dəyişiklik etmir.
-- İşlətmə: psql "$DIRECT_URL" -f scripts/migrations/2026-09-01-verification-queries.sql
--
-- Əhatə: duplicate · NULL sahibkar_id · qeyri-standart nömrələr ·
--        tenant toqquşması · sayğac uyğunluğu · constraint/index vəziyyəti ·
--        orphan / problemli qeydlər
-- ============================================================================

-- Görünən prefiks → sayğac prefiksi map-i (migration ilə EYNİ olmalıdır).
-- Aşağıdakı sorğular bunu təkrar-təkrar istifadə edir.
-- TEMP view: yalnız cari sessiyada yaşayır, qalıcı schema dəyişikliyi DEYİL.
-- Sessiya bağlananda avtomatik yox olur → fayl tam read-only qalır.
CREATE TEMP VIEW v_2026_09_01_parsed_docs AS
  WITH raw AS (
    SELECT 'satis_sifarisleri'    AS cedvel, sahibkar_id, nomre FROM satis_sifarisleri
    UNION ALL SELECT 'alis_sifarisleri',     sahibkar_id, nomre FROM alis_sifarisleri
    UNION ALL SELECT 'qaytarma_sifarisleri', sahibkar_id, nomre FROM qaytarma_sifarisleri
    UNION ALL SELECT 'anbar_transferleri',   sahibkar_id, nomre FROM anbar_transferleri
    UNION ALL SELECT 'inventarizasiyalar',   sahibkar_id, nomre FROM inventarizasiyalar
    UNION ALL SELECT 'servis_qeydleri',      sahibkar_id, nomre FROM servis_qeydleri
    UNION ALL SELECT 'catdirmalar',          sahibkar_id, nomre FROM catdirmalar
    UNION ALL SELECT 'rezervler',            sahibkar_id, nomre FROM rezervler
  )
  SELECT cedvel, sahibkar_id, nomre,
         nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' AS standart,
         CASE WHEN nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' THEN split_part(nomre,'-',1) END AS gorunen_prefiks,
         CASE WHEN nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' THEN
           CASE split_part(nomre,'-',1)
             WHEN 'SATIS' THEN 'satis' WHEN 'S' THEN 'satis'
             WHEN 'MARKET' THEN 'market' WHEN 'KREDIT' THEN 'kredit'
             WHEN 'ALIS' THEN 'alis' WHEN 'ALS' THEN 'alis'
             WHEN 'QAYTARMA' THEN 'qaytarma' WHEN 'QAY' THEN 'qaytarma'
             WHEN 'TR' THEN 'transfer' WHEN 'TRANSFER' THEN 'transfer'
             WHEN 'INV' THEN 'sayim' WHEN 'SAYIM' THEN 'sayim'
             WHEN 'SR' THEN 'servis' WHEN 'SERVIS' THEN 'servis'
           END
         END AS sayğac_prefiksi,
         CASE WHEN nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' THEN split_part(nomre,'-',2)::int END AS il,
         CASE WHEN nomre ~ '^[A-Z]+-[0-9]{4}-[0-9]+$' THEN split_part(nomre,'-',3)::bigint END AS sira
    FROM raw;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  A. MIGRATION-DAN ƏVVƏL                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- A1. ⚠️ STRATEGİYA SEÇİMİ: cədvəl ölçüləri.
--     Hər hansı cədvəl > 100k sətirdirsə TRANZAKSİYALI faylı İŞLƏTMƏYİN —
--     `2026-09-01-online-concurrent.sql` istifadə edin.
SELECT c.relname AS cedvel, s.n_live_tup AS sətir,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS olcu,
       CASE WHEN s.n_live_tup > 100000 THEN '⚠ ONLINE yol tövsiyə olunur'
            ELSE 'tranzaksiyalı yol uyğundur' END AS strategiya
  FROM pg_stat_user_tables s JOIN pg_class c ON c.oid = s.relid
 WHERE c.relname IN ('alis_sifarisleri','anbar_transferleri','catdirmalar',
                     'inventarizasiyalar','qaytarma_sifarisleri','rezervler',
                     'satis_sifarisleri','servis_qeydleri')
 ORDER BY s.n_live_tup DESC;

-- A2. NULL sahibkar_id / boş nomre — BLOKEDİCİ. Gözlənilən: 0 sətir.
SELECT cedvel, COUNT(*) AS problemli
  FROM v_2026_09_01_parsed_docs
 WHERE sahibkar_id IS NULL OR nomre IS NULL OR nomre = ''
 GROUP BY cedvel;

-- A3. Tenant daxilində TƏKRAR nömrə — composite constraint-i bloklayar.
--     Gözlənilən: 0 sətir.
SELECT cedvel, sahibkar_id, nomre, COUNT(*) AS say
  FROM v_2026_09_01_parsed_docs
 GROUP BY 1,2,3 HAVING COUNT(*) > 1
 ORDER BY say DESC;

-- A4. QEYRİ-STANDART nömrələr (P3) — format inventarizasiyası.
--     Sayğac seed edilən 6 cədvəldə tapılarsa migration DAYANIR.
--     catdirmalar/rezervler-də yalnız xəbərdarlıqdır.
SELECT cedvel,
       COUNT(*) FILTER (WHERE NOT standart) AS parse_olunmur,
       COUNT(*) FILTER (WHERE standart AND sayğac_prefiksi IS NULL) AS taninmayan_prefiks,
       COUNT(*) FILTER (WHERE standart AND sira > 2147483647) AS sira_hedden_boyuk,
       CASE WHEN cedvel IN ('catdirmalar','rezervler') THEN 'xəbərdarlıq' ELSE 'BLOKEDİCİ' END AS tesir
  FROM v_2026_09_01_parsed_docs
 GROUP BY cedvel
HAVING COUNT(*) FILTER (WHERE NOT standart) > 0
    OR COUNT(*) FILTER (WHERE standart AND sayğac_prefiksi IS NULL) > 0
    OR COUNT(*) FILTER (WHERE standart AND sira > 2147483647) > 0;

-- A4b. Qeyri-standart nömrələrin ÖZLƏRİ (əl ilə həll üçün siyahı).
SELECT cedvel, sahibkar_id, nomre,
       CASE WHEN NOT standart THEN 'format parse olunmur'
            WHEN sayğac_prefiksi IS NULL THEN 'prefiks «' || gorunen_prefiks || '» tanınmır'
            WHEN sira > 2147483647 THEN 'sıra integer həddini aşır' END AS sebeb
  FROM v_2026_09_01_parsed_docs
 WHERE NOT standart OR sayğac_prefiksi IS NULL OR sira > 2147483647
 ORDER BY cedvel, nomre
 LIMIT 200;

-- A5. Format inventarı — hansı prefiks harada işlədilir (məlumat üçün).
SELECT cedvel, COALESCE(gorunen_prefiks,'(PARSE OLUNMUR)') AS prefiks,
       COALESCE(sayğac_prefiksi,'—') AS sayğac, COUNT(*) AS say,
       MIN(nomre) AS ilk, MAX(sira) AS max_sira
  FROM v_2026_09_01_parsed_docs
 GROUP BY 1,2,3 ORDER BY cedvel, say DESC;

-- A6. Silinəcək _nomre_key-lərə FOREIGN KEY asılılığı. Gözlənilən: 0 sətir.
SELECT con.conname AS fk, src.relname AS menbe, tgt.relname AS hedef, i.relname AS istinad
  FROM pg_constraint con
  JOIN pg_class src ON src.oid = con.conrelid
  JOIN pg_class tgt ON tgt.oid = con.confrelid
  LEFT JOIN pg_class i ON i.oid = con.conindid
 WHERE con.contype = 'f' AND i.relname LIKE '%\_nomre\_key';

-- A7. Hazırkı constraint/index vəziyyəti (baseline).
SELECT t.relname AS cedvel, i.relname AS indeks, ix.indisvalid AS valid,
       (SELECT string_agg(a.attname::text, ',' ORDER BY k.ord)
          FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum) AS sutunlar
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
 WHERE ix.indisunique AND NOT ix.indisprimary
   AND t.relname IN ('alis_sifarisleri','anbar_transferleri','catdirmalar',
                     'inventarizasiyalar','qaytarma_sifarisleri','rezervler',
                     'satis_sifarisleri','servis_qeydleri')
 ORDER BY t.relname, i.relname;

-- A8. Sayğacın hazırkı vəziyyəti (sonra müqayisə üçün).
SELECT sahibkar_id, prefix, il, son_nomre FROM sened_nomre_counter ORDER BY prefix, sahibkar_id, il;

-- A9. ORPHAN / problemli qeydlər: mövcud olmayan tenant-a aid sənədlər.
--     Gözlənilən: 0 sətir.
SELECT d.cedvel, d.sahibkar_id, COUNT(*) AS orphan_say
  FROM v_2026_09_01_parsed_docs d
  LEFT JOIN sahibkarlar s ON s.id = d.sahibkar_id
 WHERE s.id IS NULL
 GROUP BY 1,2;

-- A10. Açıq uzun tranzaksiya — ACCESS EXCLUSIVE növbəsi yaratmamaq üçün
--      migration-dan DƏRHAL əvvəl yoxlayın. Gözlənilən: 0 sətir.
SELECT pid, state, now() - xact_start AS muddet, left(query, 80) AS sorgu
  FROM pg_stat_activity
 WHERE datname = current_database() AND state <> 'idle'
   AND xact_start < now() - interval '5 seconds'
 ORDER BY xact_start;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  B. MIGRATION-DAN SONRA                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- B1. Hər 8 cədvəldə YALNIZ composite unique qalmalıdır və VALID olmalıdır.
SELECT t.relname AS cedvel, i.relname AS indeks, ix.indisvalid AS valid,
       (SELECT string_agg(a.attname::text, ',' ORDER BY k.ord)
          FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum) AS sutunlar
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
 WHERE ix.indisunique AND NOT ix.indisprimary
   AND t.relname IN ('alis_sifarisleri','anbar_transferleri','catdirmalar',
                     'inventarizasiyalar','qaytarma_sifarisleri','rezervler',
                     'satis_sifarisleri','servis_qeydleri')
 ORDER BY t.relname;

-- B2. Köhnə qlobal constraint tam silinib. Gözlənilən: 0 sətir.
SELECT conname FROM pg_constraint
 WHERE conname LIKE '%\_nomre\_key'
   AND conrelid IN ('alis_sifarisleri'::regclass,'anbar_transferleri'::regclass,
                    'catdirmalar'::regclass,'inventarizasiyalar'::regclass,
                    'qaytarma_sifarisleri'::regclass,'rezervler'::regclass,
                    'satis_sifarisleri'::regclass,'servis_qeydleri'::regclass);

-- B3. INVALID indeks qalmayıb (online yoldan sonra vacibdir). Gözlənilən: 0.
SELECT i.relname FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = i.relnamespace AND n.nspname = 'public'
 WHERE NOT ix.indisvalid AND i.relname LIKE '%\_sah\_nomre\_uniq';

-- B4. Sətir sayları DƏYİŞMƏYİB (A1 ilə müqayisə edin).
SELECT cedvel, COUNT(*) AS sətir FROM v_2026_09_01_parsed_docs GROUP BY 1 ORDER BY 1;

-- B5. ⚠️ ƏN VACİB — SAYĞAC UYĞUNLUĞU.
--     Hər (tenant, prefiks, il) üçün sayğac mövcud MAKSİMUMDAN aşağı OLMAMALIDIR.
--     Aşağıdırsa növbəti sənəd P2002 ilə sınacaq. Gözlənilən: 0 sətir.
SELECT d.sahibkar_id, d.sayğac_prefiksi AS prefiks, d.il,
       MAX(d.sira) AS mövcud_max, COALESCE(c.son_nomre, 0) AS sayğac,
       'SAYĞAC AŞAĞIDIR — növbəti sənəd toqquşacaq' AS xeberdarliq
  FROM v_2026_09_01_parsed_docs d
  LEFT JOIN sened_nomre_counter c
         ON c.sahibkar_id = d.sahibkar_id
        AND c.prefix = d.sayğac_prefiksi
        AND c.il = d.il
 WHERE d.standart AND d.sayğac_prefiksi IS NOT NULL
 GROUP BY d.sahibkar_id, d.sayğac_prefiksi, d.il, c.son_nomre
HAVING COALESCE(c.son_nomre, 0) < MAX(d.sira);

-- B6. Sayğacın son vəziyyəti (A8 ilə müqayisə — yalnız irəli getməlidir).
SELECT sahibkar_id, prefix, il, son_nomre, yenilendi
  FROM sened_nomre_counter ORDER BY prefix, sahibkar_id, il;

-- B7. TENANT TOQQUŞMASI artıq mümkündür (bu, MƏQSƏDDİR):
--     eyni nömrə fərqli tenantlarda mövcud ola bilər.
--     Migration-dan sonra bu sorğu sətir qaytara BİLƏR — bu, normaldır.
SELECT nomre, COUNT(DISTINCT sahibkar_id) AS tenant_sayi, array_agg(DISTINCT cedvel) AS cedveller
  FROM v_2026_09_01_parsed_docs
 GROUP BY nomre HAVING COUNT(DISTINCT sahibkar_id) > 1;

-- B8. FUNKSİONAL DUMAN TESTİ — tranzaksiyada, HƏMİŞƏ ROLLBACK.
--     Gözlənilən: birinci INSERT 2 sətir əlavə edir (iki tenant, eyni nömrə),
--     ikinci INSERT unique violation verir (tenant daxilində təkrar).
-- BEGIN;
--   INSERT INTO satis_sifarisleri (sahibkar_id, nomre, tarix)
--   SELECT id, 'MIGRATION-SMOKE-0001', CURRENT_DATE FROM sahibkarlar LIMIT 2;
--   INSERT INTO satis_sifarisleri (sahibkar_id, nomre, tarix)
--   SELECT id, 'MIGRATION-SMOKE-0001', CURRENT_DATE FROM sahibkarlar LIMIT 1;
-- ROLLBACK;

-- TEMP view sessiya bitəndə özü yox olur — əl ilə təmizlik lazım deyil.
