-- 2026-07-06 — PROD-da ƏSKİK qalan 9 hot-path performans indeksi.
-- Yoxlama nəticəsi: bu indekslər əvvəlki perf faylllarında yazılmışdı, lakin prod DB-də TƏTBİQ OLUNMAYIB.
-- Hamısı CONCURRENTLY IF NOT EXISTS — qeyri-bloklayıcı, idempotent, qeyri-destruktiv (təkrar işlətmək təhlükəsiz).
--
-- TƏTBİQ (istifadəçi işlədir — psql və ya Prisma direct URL ilə):
--   psql "$DATABASE_URL_UNPOOLED"  -f scripts/migrations/2026-07-06-missing-perf-indexes.sql
-- QEYD: CONCURRENTLY tranzaksiya blokunda işləməz — hər ifadə ayrı işlədilməlidir (psql -f bunu edir).
-- Cədvəllər kiçikdir → hər indeks demək olar ani yaranır.

-- Satış siyahısı (ən hot: status + qaralama filtri + tarix sıralaması)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_satis_sah_status_qaralama_tarix
  ON satis_sifarisleri (sahibkar_id, status, qaralama, tarix DESC);

-- Maliyyə əməliyyatları (gəlir/xərc + tarix aqreqatları)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finance_sah_yn_tarix
  ON finance_operations (sahibkar_id, y_n, tarix DESC);

-- Stok axtarışı (anbar üzrə — hər POS/satış/anbar səhifəsində)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stok_sah_anbar
  ON stok (sahibkar_id, anbar_id);

-- Servis siyahısı + qapanma
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_servis_sah_status
  ON servis_qeydleri (sahibkar_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_servis_sah_qapanma
  ON servis_qeydleri (sahibkar_id, qapanma_tarixi DESC);

-- CRM: kontragent son təması (izləmə/aging)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kontragentler_sah_son_temas
  ON kontragentler (sahibkar_id, son_temas DESC);

-- Contact followups (CRM izləmə paneli)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cfu_sah_status_vaxt
  ON contact_followups (sahibkar_id, status, vaxt DESC);

-- Inbox mesajları (status üzrə)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inmsg_sah_status
  ON inbox_mesajlari (sahibkar_id, status);

-- Marketplace hesabları (aktiv/status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS mp_hes_sah_status_idx
  ON marketplace_hesablari (sahibkar_id, status);
