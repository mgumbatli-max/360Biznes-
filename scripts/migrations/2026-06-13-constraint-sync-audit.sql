-- ============================================================================
-- CONSTRAINT SİNXRONİZASİYASI — audit (2026-06-13) tapıntıları
-- ============================================================================
-- Problem (sistemik): bir sıra DB CHECK constraint-lər kodun LEGİTİM istifadə
-- etdiyi dəyərlərdən GERİ qalıb. Kod həmin dəyərləri yazanda Postgres 23514
-- (check_violation) atır → əməliyyat tamamilə çökür. Bu, "Verilənlər bazası
-- qaydası pozuldu" / "xəta verir / heç silinmir" simptomlarının kök səbəbidir.
--
-- Prisma `db push` CHECK constraint-ləri İDARƏ ETMİR — ona görə bu migration
-- LOKAL + PROD bazaya AYRICA, ƏL İLƏ tətbiq olunmalıdır.
--
-- TƏTBİQ (prod):
--   psql "$PROD_DATABASE_URL" -f scripts/migrations/2026-06-13-constraint-sync-audit.sql
-- və ya Prisma ilə: hər ifadəni $executeRawUnsafe ilə.
--
-- Hamısı additivdir (yalnız icazəli dəyər əlavə olunur) — mövcud sətirlər
-- təsirlənmir. İdempotent (DROP IF EXISTS).
-- ============================================================================

BEGIN;

-- 1) satis_sifarisleri.status — 4-eyes təsdiq qaiməsi 'tesdiq_gozleyir' yazır (#15/#17).
--    DİQQƏT: iki eyni constraint var (satis_sifarisleri_status_check + satis_status_dogru).
ALTER TABLE satis_sifarisleri DROP CONSTRAINT IF EXISTS satis_sifarisleri_status_check;
ALTER TABLE satis_sifarisleri DROP CONSTRAINT IF EXISTS satis_status_dogru;
ALTER TABLE satis_sifarisleri ADD CONSTRAINT satis_sifarisleri_status_check
  CHECK (status::text = ANY (ARRAY[
    'yeni','tesdiq','tesdiq_gozleyir','gonderildi','tamamlandi','legv','qaralama','qaytarilib'
  ]::text[]));

-- 2) alis_sifarisleri.status — 4-eyes təsdiq alışı 'tesdiq_gozleyir' yazır (#15/#17).
ALTER TABLE alis_sifarisleri DROP CONSTRAINT IF EXISTS alis_status_dogru;
ALTER TABLE alis_sifarisleri DROP CONSTRAINT IF EXISTS alis_sifarisleri_status_check;
ALTER TABLE alis_sifarisleri ADD CONSTRAINT alis_status_dogru
  CHECK (status::text = ANY (ARRAY['gozlemede','qebul_edildi','tesdiq_gozleyir','legv']::text[]));

-- 3) qaytarma_sifarisleri.status — tez/tam qaytarma 'tamamlandi' yazır (#3); kod+UI bunu gözləyir.
ALTER TABLE qaytarma_sifarisleri DROP CONSTRAINT IF EXISTS qaytarma_sifarisleri_status_check;
ALTER TABLE qaytarma_sifarisleri ADD CONSTRAINT qaytarma_sifarisleri_status_check
  CHECK (status::text = ANY (ARRAY['tesdiqlenmemis','qebul_edildi','tamamlandi','legv']::text[]));

-- 4) anbar_hereketleri.nov — inventar/konsiqnasiya/servis/defekt/transfer hərəkətləri (#6/#7/#8).
--    lib/balance/product-stock.ts ledger reader bu işarəli (signed) dəyərlərə əsaslanır → genişləndir (silmə yox).
ALTER TABLE anbar_hereketleri DROP CONSTRAINT IF EXISTS hereket_nov_dogru;
ALTER TABLE anbar_hereketleri ADD CONSTRAINT hereket_nov_dogru
  CHECK (nov::text = ANY (ARRAY[
    'medaxil','mexaric',
    'transfer_giris','transfer_cixis','transfer_qismi',
    'inventar','inventar_artim','inventar_azalma',
    'defekt_giris','defekt_cixis',
    'servis_mexaric','servis_mexaric_stoxsuz','servis_iade','servis_freeze',
    'qaytarma_giris','qaytarma_cixis','qaytarma_qebul','qaytarma_sifarisi','qaytarma_tez',
    'konsiqnasiya_mexaric'
  ]::text[]));

-- 5) servis_qeydleri.status — qiymət təklifi axını 'teklif_gozleyir' yazır (#9). Mövcud + teklif_gozleyir.
ALTER TABLE servis_qeydleri DROP CONSTRAINT IF EXISTS servis_qeydleri_status_check;
ALTER TABLE servis_qeydleri ADD CONSTRAINT servis_qeydleri_status_check
  CHECK (status::text = ANY (ARRAY[
    'qebul_edildi','diaqnostikada','teklif_gozleyir','usta_baxir','musteri_tesdiqi','ehtiyat_hisse',
    'temir_olunur','temir_edildi','deyisdirildi','techizatci_gonderildi','musteriye_tehvil',
    'qaytarildi','silindi','redd_edildi','yoxlanilir','istifadeci_sehvi','real_defekt','musteriye_qaytarildi'
  ]::text[]));

-- 6) kontragentler.qiymet_tipi — UI 'perakende' (pərakəndə) tier-i təklif edir (#12).
ALTER TABLE kontragentler DROP CONSTRAINT IF EXISTS kontragentler_qiymet_tipi_check;
ALTER TABLE kontragentler ADD CONSTRAINT kontragentler_qiymet_tipi_check
  CHECK (qiymet_tipi::text = ANY (ARRAY['adi','perakende','topdan','partnyor','vip']::text[]));

-- 7) leads.status — soft-delete 'silinib' yazır (#13); kod+UI bunu gözləyir.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS chk_lead_status;
ALTER TABLE leads ADD CONSTRAINT chk_lead_status
  CHECK (status::text = ANY (ARRAY['yeni','elaqe','muzakire','teklif','qazandi','itirdi','silinib']::text[]));

-- 8) sosial_hesablar.kanal — TikTok/LinkedIn/X + daxili posts konteyneri (#23).
ALTER TABLE sosial_hesablar DROP CONSTRAINT IF EXISTS sosial_hesablar_kanal_check;
ALTER TABLE sosial_hesablar ADD CONSTRAINT sosial_hesablar_kanal_check
  CHECK (kanal::text = ANY (ARRAY[
    'whatsapp','telegram','instagram','facebook','tap','sayt','sms','manual',
    'tiktok','linkedin','x','__posts__'
  ]::text[]));

COMMIT;
