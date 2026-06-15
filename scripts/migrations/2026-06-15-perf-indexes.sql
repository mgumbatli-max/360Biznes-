-- ============================================================================
-- 2026-06-15: Tenant-scoped composite performance index-lər
-- ============================================================================
-- Məqsəd: tez-tez (sahibkar_id + status/tarix/...) ilə filtrlənən sorğuları
-- seq-scan-dan B-tree index lookup-a keçirmək. Yalnız SÜRƏT dəyişir — nəticələr
-- eyni qalır. Bu fayl deploy-un `prisma db push`-undan ƏVVƏL prod Neon-da əl ilə
-- işlədilir ki, table LOCK olmasın.
--
-- ⚠️ VACİB: CREATE INDEX CONCURRENTLY transaction blokunda (BEGIN/COMMIT) İŞLƏMİR.
--    Ona görə bu faylda BEGIN/COMMIT YOXDUR. Hər statement-i ayrıca (autocommit)
--    işlət. CONCURRENTLY oxu/yazını bloklamadan index qurur.
--    Əgər bir statement uğursuz olarsa "INVALID" index qala bilər — onu
--    `DROP INDEX CONCURRENTLY IF EXISTS <ad>;` ilə sil və yenidən işlət.
--
-- Index adları Prisma `@@index(..., map: "...")` adları ilə eynidir ki, sonrakı
-- `prisma db push` onları artıq mövcud sayıb yenidən qurmasın (no-op = lock yox).
-- ============================================================================

-- 1. contact_followups: tenant + status + vaxt (CRM follow-up siyahıları)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cfu_sah_status_vaxt
  ON contact_followups (sahibkar_id, status, vaxt DESC);

-- 2. servis_qeydleri: tenant + status (açıq/qapalı servis filtri)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_servis_sah_status
  ON servis_qeydleri (sahibkar_id, status);

-- 3. servis_qeydleri: tenant + qapanma_tarixi (qapanma hesabatları)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_servis_sah_qapanma
  ON servis_qeydleri (sahibkar_id, qapanma_tarixi DESC);

-- 4. marketplace_hesablari: tenant + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS mp_hes_sah_status_idx
  ON marketplace_hesablari (sahibkar_id, status);

-- 5. satis_sifarisleri: tenant + status + qaralama + tarix
--    (qaralama olmayan, statusa görə filtr + tarixə görə sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_satis_sah_status_qaralama_tarix
  ON satis_sifarisleri (sahibkar_id, status, qaralama, tarix DESC);

-- 6. inbox_mesajlari: tenant + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inmsg_sah_status
  ON inbox_mesajlari (sahibkar_id, status);

-- 7. stok: tenant + anbar (anbar üzrə tenant stok sorğuları)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stok_sah_anbar
  ON stok (sahibkar_id, anbar_id);

-- 8. kontragentler: tenant + son_temas (son təmasa görə CRM sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kontragentler_sah_son_temas
  ON kontragentler (sahibkar_id, son_temas DESC);

-- ============================================================================
-- Tətbiq sonrası yoxlama (istəyə görə):
--   SELECT indexrelid::regclass AS index, indrelid::regclass AS table, indisvalid
--   FROM pg_index
--   WHERE indexrelid::regclass::text IN (
--     'idx_cfu_sah_status_vaxt','idx_servis_sah_status','idx_servis_sah_qapanma',
--     'mp_hes_sah_status_idx','idx_satis_sah_status_qaralama_tarix',
--     'idx_inmsg_sah_status','idx_stok_sah_anbar','idx_kontragentler_sah_son_temas'
--   );
--   -- indisvalid = true olmalıdır.
-- ============================================================================
