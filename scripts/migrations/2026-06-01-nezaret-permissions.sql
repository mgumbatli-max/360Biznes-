-- ============================================================================
-- M: Nəzarət Mərkəzi icazələri — risk dashboard, log, ayarlar nəzarəti
-- ============================================================================
-- Nəzarət Mərkəzi həssas modul — bütün biznesin risk/audit məlumatını göstərir.
-- Default-da yalnız sahibkar/admin/direktor görür.
-- ============================================================================

BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('nezaret.oxu',       'Nəzarət mərkəzini aç',  'Nəzarət Mərkəzi', 'Master icazə — /nezaret-merkezi səhifəsinə girişə icazə'),
  ('nezaret.dashboard', 'Risk dashboard',        'Nəzarət Mərkəzi', 'Aktiv xəbərdarlıq, təsdiq, stok riski, borc, davamiyyət göstəriciləri'),
  ('nezaret.loglar',    'Audit log',             'Nəzarət Mərkəzi', 'Xəbərdarlıq + təsdiq + system event birləşdirilmiş tarixçə'),
  ('nezaret.ayarlar',   'Ayarları dəyiş',        'Nəzarət Mərkəzi', 'Avtomat qaydalar, eskalasiya, default davranış konfiqurasiyası')
ON CONFLICT (kod) DO NOTHING;

-- Default: sahibkar / admin / direktor rollarına bütün nezaret icazələri
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND i.kod LIKE 'nezaret.%'
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib və menecer rollarına yalnız oxu (dashboard + log)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('muhasib', 'menecer')
   AND i.kod IN ('nezaret.oxu', 'nezaret.dashboard', 'nezaret.loglar')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
