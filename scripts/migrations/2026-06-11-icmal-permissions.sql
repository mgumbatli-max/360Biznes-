-- ============================================================================
-- Modul icmal (modulun öz dashboardu) icazələri
-- ============================================================================
-- İcmal səhifəsi 2 qatla idarə olunur:
--   1) Ayarlar → Görünüş → "Modulun öz dashboardu" (sahibkar, biznes üzrə)
--   2) Rol icazəsi: icmal.<modul> (sahibkar/admin/direktor bypass)
-- Bu kodlar rol icazələri UI-da görünür və adi rollara verilə bilər.
--
-- İcra (prod): psql "$DATABASE_URL" -f scripts/migrations/2026-06-11-icmal-permissions.sql
-- ============================================================================

BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('icmal.ticaret', 'Ticarət icmalı',  'İcmal', 'Ticarət modulunun KPI/icmal səhifəsini görür'),
  ('icmal.anbar',   'Anbar icmalı',    'İcmal', 'Anbar modulunun KPI/icmal səhifəsini görür'),
  ('icmal.maliyye', 'Maliyyə icmalı',  'İcmal', 'Maliyyə modulunun KPI/icmal səhifəsini görür'),
  ('icmal.elaqe',   'Əlaqə icmalı',    'İcmal', 'Müştərilər modulunun KPI/icmal səhifəsini görür')
ON CONFLICT (kod) DO NOTHING;

COMMIT;
