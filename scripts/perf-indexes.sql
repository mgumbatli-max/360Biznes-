-- ============================================================================
-- 360biznes — performance index migration (manual)
-- ============================================================================
-- Bu fayl prisma migrate-dan kənar manual işlədilməlidir, çünki layihə
-- `prisma db push` ilə idarə olunur. Production-da (Neon) icra üsulu:
--
--   1. Neon dashboard → SQL Editor (ya psql)
--   2. Aşağıdakı bütün CREATE INDEX əmrlərini bir-bir yapışdır və işlət
--
-- `IF NOT EXISTS` istifadə olunur — təkrar işlədilsə zərər vermir.
-- `CONCURRENTLY` istifadə olunmur çünki o tranzaksiya daxilində işləmir;
-- istifadəçi yüksək yüklü saatlarda işlətməsin.
--
-- Hər bir indeksin nəyi sürətləndirdiyi şərhdə.
-- ============================================================================

-- bonus profil oxuması — hər render-də getBonusProfil() çağırılır
CREATE INDEX IF NOT EXISTS idx_ayarlar_sah_qrup_acar
  ON ayarlar (sahibkar_id, qrup, acar);

-- topbar bildiriş sayğacı + dropdown siyahısı
CREATE INDEX IF NOT EXISTS idx_bildirisler_istifadeci_oxundu_yaradildi
  ON bildirisler (istifadeci_id, oxundu, yaradildi DESC);

-- CRM filter-ləri: menecer üzrə müştərilər (bonus filter müştəri_filtri=mene_aid)
CREATE INDEX IF NOT EXISTS idx_kontragentler_sah_menecer
  ON kontragentler (sahibkar_id, menecer_id);

-- müştəri/təchizatçı list-də nov + aktiv filter
CREATE INDEX IF NOT EXISTS idx_kontragentler_sah_nov_aktiv
  ON kontragentler (sahibkar_id, nov, aktiv);

-- CRM pipeline
CREATE INDEX IF NOT EXISTS idx_kontragentler_sah_funnel
  ON kontragentler (sahibkar_id, funnel_status);

-- bonus calc + KPI: işçinin satışları tarix üzrə
CREATE INDEX IF NOT EXISTS idx_satis_sah_yaradan_tarix
  ON satis_sifarisleri (sahibkar_id, yaradan_id, tarix DESC);

-- müştəri 360° timeline
CREATE INDEX IF NOT EXISTS idx_satis_sah_musteri_tarix
  ON satis_sifarisleri (sahibkar_id, musteri_id, tarix DESC);

-- satış list filter (status + tarix)
CREATE INDEX IF NOT EXISTS idx_satis_sah_status_tarix
  ON satis_sifarisleri (sahibkar_id, status, tarix DESC);

-- borc/nisye filter (odenis_nov)
CREATE INDEX IF NOT EXISTS idx_satis_sah_odenis_tarix
  ON satis_sifarisleri (sahibkar_id, odenis_nov, tarix DESC);

-- cashflow dashboard widget
CREATE INDEX IF NOT EXISTS idx_finance_sah_yn_tarix
  ON finance_operations (sahibkar_id, y_n, tarix DESC);

-- müştərinin ödənişləri (müştəri kartı timeline)
CREATE INDEX IF NOT EXISTS idx_finance_sah_kontragent_tarix
  ON finance_operations (sahibkar_id, kontragent_id, tarix DESC);

-- tapşırıqlar: işçi panelində mesul üzrə (status, deadline)
CREATE INDEX IF NOT EXISTS idx_tap_sah_mesul_status_deadline
  ON tapshiriqlar (sahibkar_id, mesul_id, status, deadline);

-- bonus calc tapsiriq vaxtında tamamlanma (sehv_yoxlugu meyari)
CREATE INDEX IF NOT EXISTS idx_tap_sah_status_tamam
  ON tapshiriqlar (sahibkar_id, status, tamamlandi_de DESC);

-- many-to-many lookup: bir işçinin tapşırıqları
CREATE INDEX IF NOT EXISTS idx_tap_iscilier_istifadeci
  ON tapshiriq_iscilier (istifadeci_id, tapshiriq_id);

-- audit log dashboard widget: sahibkar üzrə tarix DESC
CREATE INDEX IF NOT EXISTS idx_audit_sah_yaradildi
  ON audit_log (sahibkar_id, yaradildi DESC);

-- finance balance lookup
CREATE INDEX IF NOT EXISTS idx_kassa_emeliyyat_kassa_odenis
  ON kassa_emeliyyatlari (kassa_id, odenis_nov);

-- alış sifarişləri timeline
CREATE INDEX IF NOT EXISTS idx_alis_sah_kontragent_tarix
  ON alis_sifarisleri (sahibkar_id, kontragent_id, tarix DESC);

-- ============================================================================
-- Yoxlama (manual icra üçün):
--   SELECT indexname FROM pg_indexes WHERE schemaname='public'
--     AND indexname LIKE 'idx_%' ORDER BY indexname;
-- ============================================================================
