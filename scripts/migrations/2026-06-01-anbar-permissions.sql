-- ============================================================================
-- M: Anbar modulu icazələri — məhsul, stok, satınalma, sayım, qiymət
-- ============================================================================
-- Anbar modulunun 16 alt-bölməsi var. Hər biri üçün ayrı icazə.
-- Anbardar adi əməliyyatlar edə bilir, menecer + alış / sayım, sahibkar hər şey.
-- ============================================================================

BEGIN;

INSERT INTO icazeler (kod, ad, qrup, aciqlamaq) VALUES
  ('anbar.oxu',           'Anbar səhifəsi',           'Anbar', 'Master icazə — /anbar səhifəsinə giriş'),
  ('mehsul.oxu',          'Məhsul siyahısı',          'Anbar', 'Məhsul kataloqu görmək'),
  ('mehsul.yarat',        'Məhsul yarat',             'Anbar', 'Yeni məhsul əlavə (ProductWizard)'),
  ('mehsul.duzelt',       'Məhsul redaktə',           'Anbar', 'Mövcud məhsulu dəyişmək'),
  ('mehsul.sil',          'Məhsul sil/arxivlə',       'Anbar', 'Məhsulu silmək və ya arxivləmək'),
  ('mehsul.yukle',        'Excel ilə yüklə',          'Anbar', '/anbar/mehsul-yukle — toplu import'),
  ('stok.oxu',            'Stok cədvəli',             'Anbar', '/anbar/stok — hansı anbarda nə qədər var'),
  ('stok.duzelis',        'Stok düzəliş',             'Anbar', 'Manual stok artırmaq/azaltmaq'),
  ('stok.transfer',       'Anbarlar arası transfer',  'Anbar', '/anbar/transfer — mal hərəkəti'),
  ('stok.bron',           'Stok bron',                'Anbar', '/anbar/bron — müştəri rezervi'),
  ('satinalma.oxu',       'Satınalma',                'Anbar', '/anbar/satinalma — alış sənədləri'),
  ('satinalma.yarat',     'Alış sənədi yarat',        'Anbar', 'Təchizatçıdan yeni alış'),
  ('sayim.oxu',           'Sayım',                    'Anbar', '/anbar/inventar — sayım sənədləri'),
  ('sayim.yarat',         'Yeni sayım',               'Anbar', 'Sayım başlatmaq'),
  ('qiymet.oxu',          'Qiymət siyahısı',          'Anbar', '/anbar/qiymet — qiymət siyahıları'),
  ('qiymet.duzelt',       'Qiymət dəyiş',             'Anbar', 'Bulk qiymət yeniləməsi'),
  ('kateqoriya.idare',    'Kateqoriya/marka',         'Anbar', '/anbar/kateqoriyalar + /anbar/markalar redaktə'),
  ('konsiqnasiya.oxu',    'Konsiqnasiya',             'Anbar', '/anbar/konsiqnasiya — komissiya satışı'),
  ('anbar.hesabat',       'Hesabatlar',               'Anbar', '/anbar/hesabat + /anbar/hereketler analitika'),
  ('anbar.anomali',       'Anomaliya aşkarı',         'Anbar', '/anbar/anomali — AI əsaslı anomaliya')
ON CONFLICT (kod) DO NOTHING;

-- Sahibkar / admin / direktor → hamısı
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('sahibkar', 'admin', 'direktor')
   AND (i.kod = 'anbar.oxu' OR i.kod LIKE 'mehsul.%' OR i.kod LIKE 'stok.%'
        OR i.kod LIKE 'satinalma.%' OR i.kod LIKE 'sayim.%' OR i.kod LIKE 'qiymet.%'
        OR i.kod IN ('kateqoriya.idare', 'konsiqnasiya.oxu', 'anbar.hesabat', 'anbar.anomali'))
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Menecer → satinalma və qiymət daxil, hesabat
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'menecer'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'mehsul.yarat', 'mehsul.duzelt',
     'stok.oxu', 'stok.duzelis', 'stok.transfer', 'stok.bron',
     'satinalma.oxu', 'satinalma.yarat',
     'sayim.oxu', 'sayim.yarat',
     'qiymet.oxu', 'qiymet.duzelt',
     'kateqoriya.idare', 'konsiqnasiya.oxu', 'anbar.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Anbardar → əsas əməliyyatlar (məhsul, stok, sayım, transfer, bron)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'anbardar'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'mehsul.yarat', 'mehsul.duzelt', 'mehsul.yukle',
     'stok.oxu', 'stok.duzelis', 'stok.transfer', 'stok.bron',
     'satinalma.oxu', 'sayim.oxu', 'sayim.yarat',
     'qiymet.oxu', 'kateqoriya.idare'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Kassir / satıcı → yalnız oxu (məhsul axtarışı POS-da işləsin deyə)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod IN ('kassir', 'satici')
   AND i.kod IN ('anbar.oxu', 'mehsul.oxu', 'stok.oxu', 'qiymet.oxu')
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

-- Mühasib → hesabat + qiymət + satınalma (gör)
INSERT INTO rol_icazeleri (rol_id, icaze_id)
SELECT r.id, i.id
  FROM rollar r
  CROSS JOIN icazeler i
 WHERE r.kod = 'muhasib'
   AND i.kod IN (
     'anbar.oxu', 'mehsul.oxu', 'stok.oxu', 'satinalma.oxu',
     'qiymet.oxu', 'anbar.hesabat'
   )
ON CONFLICT (rol_id, icaze_id) DO NOTHING;

COMMIT;
