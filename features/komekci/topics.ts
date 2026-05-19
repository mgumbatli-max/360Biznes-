/**
 * 360biznes ERP üçün help/dokumentasiya mövzuları.
 * Sahibkar və əməkdaşların sistemin hər funksiyasını başa düşməsi üçün.
 */

export type KomekciKateqoriya =
  | "baslangic"
  | "satis_alis"
  | "musteri"
  | "isci_kpi"
  | "tesdiq"
  | "gizli_mod"
  | "avtomat"
  | "sahibkar"
  | "sened"
  | "hesabat";

export type KomekciMovzu = {
  id: string;
  kateqoriya: KomekciKateqoriya;
  basliq: string;
  qisa: string;            // 1 sətr xülasə
  nedir: string;           // bu funksiya nədir
  necə_istifade: string[]; // addım-addım təlimat
  vacib: string[];         // diqqət edilməli olanlar
  sehife_url: string;      // birbaşa açılan səhifə
  iconKey: string;         // lucide ikon adı
  achar_sozler: string[];  // axtarış üçün sinonimlər
};

export const KATEQORIYA_LABEL: Record<KomekciKateqoriya, { label: string; icon: string; rang: string }> = {
  baslangic:   { label: "Başlanğıc",       icon: "Sparkles",     rang: "text-violet-500" },
  satis_alis:  { label: "Satış & Alış",    icon: "ShoppingCart", rang: "text-emerald-500" },
  musteri:     { label: "Müştəri & CRM",   icon: "Users",        rang: "text-pink-500" },
  isci_kpi:    { label: "İşçi & KPI",      icon: "Briefcase",    rang: "text-sky-500" },
  tesdiq:      { label: "Təsdiq sistemi",  icon: "ShieldCheck",  rang: "text-amber-500" },
  gizli_mod:   { label: "Gizli mod",       icon: "EyeOff",       rang: "text-violet-500" },
  avtomat:     { label: "Avtomatlaşma",    icon: "Zap",          rang: "text-orange-500" },
  sahibkar:    { label: "Sahibkar paneli", icon: "Crown",        rang: "text-rose-500" },
  sened:       { label: "Sənədlər",        icon: "FolderArchive",rang: "text-amber-500" },
  hesabat:     { label: "Hesabat",         icon: "FileText",     rang: "text-indigo-500" },
};

export const MOVZULAR: KomekciMovzu[] = [
  // ── BAŞLANĞIC ──
  {
    id: "ilk-addim",
    kateqoriya: "baslangic",
    basliq: "İlk addım — sistemə girişdən sonra nə etməli?",
    qisa: "Yeni sahibkarın ilk gün etməli olduğu vacib qurğular",
    nedir:
      "360biznes ERP sistemi 50+ moduldan ibarətdir. İlk girişdə dərhal bütün funksiyaları açmaq əvəzinə, ən vacib bazanı qurmaq lazımdır.",
    necə_istifade: [
      "/ayarlar/kompaniya — şirkət profilini doldur (ad, VÖEN, logo, ünvan)",
      "/ayarlar/filiallar — filiallarını əlavə et",
      "/ayarlar/istifadeci — əməkdaşlar üçün loginləri yarat",
      "/ayarlar/rollar — hansı əməkdaş hansı funksiyanı görsün",
      "/anbar — məhsulları əlavə et və ya Excel-dən idxal et",
      "/elaqe — müştəri və təchizatçıları daxil et",
      "/ayarlar/ilkin-qaliqlar — başlanğıc maliyyə qalıqlarını yaz",
    ],
    vacib: [
      "Sahibkar PIN-ni güclü təyin et — /sahibkar/setup",
      "Ən azı 1 admin əməkdaşı yarat ki, sən səfərdə də işlər dayanmasın",
      "İlkin qalıqlar olmasa hesabatlar səhv görünə bilər",
    ],
    sehife_url: "/ayarlar",
    iconKey: "Sparkles",
    achar_sozler: ["başlangic", "ilk", "qurmaq", "kompaniya", "setup"],
  },

  // ── SATIŞ & ALIŞ ──
  {
    id: "satis-qaime",
    kateqoriya: "satis_alis",
    basliq: "Satış qaiməsi yaratma",
    qisa: "Yeni satış sənədi necə yaranır və hara düşür",
    nedir:
      "Müştəriyə məhsul satdıqda yaradılan rəsmi sənəd. Stok endirir, borc/ödəniş izləyir, hesabatlara düşür.",
    necə_istifade: [
      "/ticaret/satis-yeni səhifəsi açılır",
      "Müştəri seçilir (yoxsa yeni yaranır)",
      "Anbar və məhsullar əlavə edilir",
      "Endirim, ƏDV, çatdırma xərci təyin olunur",
      "Ödəniş növü seçilir (nağd, kart, nisyə, köçürmə)",
      "'Qaralama' qoyularsa stok rezerv edilir 48 saat",
      "'Yadda saxla' basılır — qaimə nömrəsi alınır",
    ],
    vacib: [
      "Satış qaiməsi təsdiqi aktivdirsə, qaimə təsdiqlənənə qədər stoka düşmür",
      "Nisyə satışda müştəri borcu artır — borc limiti aşılırsa təsdiq tələb olunur",
      "Endirim 20%-dən artıq olarsa avto-təsdiq istəyə bilər (ayarlardan asılı)",
    ],
    sehife_url: "/ticaret/satis-yeni",
    iconKey: "ShoppingCart",
    achar_sozler: ["satis", "qaime", "musteri", "sifaris"],
  },
  {
    id: "alis-qaime",
    kateqoriya: "satis_alis",
    basliq: "Alış qaiməsi yaratma",
    qisa: "Təchizatçıdan məhsul alarkən qaimə yaratma",
    nedir:
      "Mal-materialın anbara daxil olmasını rəsmiləşdirir. Stok artır, təchizatçıya borc yaranır.",
    necə_istifade: [
      "/ticaret/alis-yeni açılır",
      "Təchizatçı seçilir",
      "Anbar seçilir (hara gəlir)",
      "Məhsullar və miqdarlar daxil edilir",
      "'Dərhal qəbul et' işarələnsə stok dərhal artır, yoxsa 'gözləmədə' qalır",
    ],
    vacib: [
      "Alış qaiməsi təsdiqi aktivdirsə, təsdiqlənənə qədər stoka düşmür",
      "Təchizatçıya borc yalnız təsdiqdən sonra artır",
    ],
    sehife_url: "/ticaret/alis-yeni",
    iconKey: "ShoppingCart",
    achar_sozler: ["alis", "tedaruk", "qaime"],
  },
  {
    id: "qaytarma",
    kateqoriya: "satis_alis",
    basliq: "Qaytarma əməliyyatı",
    qisa: "Müştəridən və ya təchizatçıya qaytarma",
    nedir:
      "Müştəri məhsul qaytarsa stok geri qayıdır, müştəri borcu azalır. Təchizatçıya qaytarsan əksinə.",
    necə_istifade: [
      "/ticaret/qaytarma açılır",
      "Növ seçilir: müştəri qaytarma / təchizatçı qaytarma",
      "Sənədlər və məbləğ daxil edilir",
      "'Qəbul et' düyməsi ilə stok hərəkəti yaranır",
    ],
    vacib: [
      "500 ₼-dan böyük qaytarma təsdiq tələb edə bilər",
      "Qaytarma stoka düşməzdən əvvəl yoxlanmalıdır (zədəli məhsul ola bilər)",
    ],
    sehife_url: "/ticaret/qaytarma",
    iconKey: "RotateCcw",
    achar_sozler: ["qaytarma", "refund", "geri"],
  },

  // ── MÜŞTƏRİ & CRM ──
  {
    id: "borc-xatirlatma",
    kateqoriya: "musteri",
    basliq: "Borc xatırlatma — WhatsApp, SMS, tapşırıq",
    qisa: "Borc mərkəzində müştərilərə avto-mesaj göndərmək",
    nedir:
      "Borc mərkəzində hər müştərinin yanında zəng (🔔) düyməsi var. 3 üsul ilə xatırlatma göndərə bilərsən.",
    necə_istifade: [
      "/elaqe/borclar açılır",
      "Sıra üzərindəki 🔔 ikonuna klik et",
      "3 düymə görünür: 💬 WhatsApp / 📨 SMS / 📋 Tapşırıq",
      "WhatsApp: hazır mətn ilə wa.me linki açılır, sən bir kliklə göndərirsən",
      "Tapşırıq: 'Həftəlik təkrarla' işarələ → həftədə bir dəfə avto-yaranır",
    ],
    vacib: [
      "Müştərinin telefon nömrəsi olmalıdır",
      "Tapşırıq mənzilini sən seçirsən (kassir / satıcı / özün)",
      "Borc avto-tapşırıq (ayarlardan) bu prosesi tam avtomatlaşdırır",
    ],
    sehife_url: "/elaqe/borclar",
    iconKey: "Bell",
    achar_sozler: ["borc", "xatirlatma", "whatsapp", "sms"],
  },
  {
    id: "dogum-gunu",
    kateqoriya: "musteri",
    basliq: "Doğum günü kampaniya",
    qisa: "Müştəri və əməkdaş doğum günlərinə avto-təbrik",
    nedir:
      "Müştəri/əməkdaş profilində 'doğum tarixi' doldurulduqda burada avtomatik görünür. WhatsApp ilə hazır təbrik göndərmək olur.",
    necə_istifade: [
      "/elaqe/dogum-gunu — yaxın 30 günün doğum günləri",
      "Müştəri/əməkdaş profilində dogum_tarixi sahəsi doldurulur",
      "Bu gün doğum günü olanlar dashboard widget-də görünür",
      "💬 Təbrik düyməsi ilə wa.me linki açılır",
    ],
    vacib: [
      "Müştəri üçün ayrı şablon (15% endirim), əməkdaş üçün ayrı",
      "{{ad}} avtomatik əvəzlənir",
      "Səhər brifinq bildirişdə bu gün doğum günü olanlar bildirilir",
    ],
    sehife_url: "/elaqe/dogum-gunu",
    iconKey: "Cake",
    achar_sozler: ["dogum", "tebrik", "kampaniya"],
  },
  {
    id: "inaktiv-musteri",
    kateqoriya: "musteri",
    basliq: "İnaktiv müştəri detektoru (RFM)",
    qisa: "Çoxdandır almayanlara avto-segmentasiya və qaytarma kampaniyası",
    nedir:
      "Hər müştəri RFM (Recency-Frequency-Monetary) analizinə görə avto-səviyyəyə bölünür. Müvafiq səviyyəyə WhatsApp şablonu göndərilir.",
    necə_istifade: [
      "/elaqe/inaktiv açılır",
      "Min gün filterini seç (30/60/90/180/365)",
      "VIP / Sadiq / İtirilməkdə / Passiv səviyyələrə bölünmüş siyahı",
      "Hər birinə uyğun 'Qaytar' WhatsApp düyməsi",
    ],
    vacib: [
      "VIP: 5000+ ₼ alıcı + 60 günə qədər almayıb — təcili",
      "Sadiq: 5+ alış + 90 günə qədər",
      "Hər səviyyəyə fərqli endirim faizi (VIP 15%, Sadiq 10%, İtirilməkdə 10%, Passiv 5%)",
    ],
    sehife_url: "/elaqe/inaktiv",
    iconKey: "UserX",
    achar_sozler: ["inaktiv", "rfm", "qaytarma", "segment"],
  },

  // ── İŞÇİ & KPI ──
  {
    id: "kpi-dashboard",
    kateqoriya: "isci_kpi",
    basliq: "KPI Dashboard — bütün əməkdaşların performansı",
    qisa: "Tək cədvəldə hamısı: maaş, bonus, davamiyyət, tapşırıq, səhv",
    nedir:
      "Sahibkar üçün master idarəetmə cədvəli. Hər əməkdaş üçün 10 sütun: maaş, bonus, cərimə, net, davamiyyət %, tapşırıq %, səhv %, satış, performans skoru.",
    necə_istifade: [
      "/iscilier/kpi açılır",
      "Ay filterini seç",
      "Axtarış zolağı və vəzifə filteri",
      "Sütun başlığına klik — sıralanır",
      "🥇🥈🥉 medallarla top 3 performer",
      "<50 skor olanlar 'Diqqət' bayrağı alır",
      "'Excel-ə yüklə' düyməsi ilə eksport",
    ],
    vacib: [
      "Hər sütun başlığında ? ikonu — izah var",
      "Səhv sütunu tərs — 0% yaşıl, çoxalan qırmızı",
      "Performans skoru: bonus 30% + davamiyyət 25% + tapşırıq 25% + səhvsizlik 20%",
    ],
    sehife_url: "/iscilier/kpi",
    iconKey: "BarChart3",
    achar_sozler: ["kpi", "performans", "isci", "reytinq"],
  },
  {
    id: "bonus-profil",
    kateqoriya: "isci_kpi",
    basliq: "Fərdi bonus profili",
    qisa: "Hər əməkdaşa fərdi bonus qaydaları",
    nedir:
      "Hər əməkdaşa ayrıca bonus pool təyin olunur (sabit ₼ və ya satışdan %), sonra 5 kateqoriyaya bölünür: davamiyyət, tapşırıq, səhvsizlik, borc yığım, satış hədəfi.",
    necə_istifade: [
      "/iscilier/[id]?tab=bonus açılır",
      "'Qaydaları düzəlt' düyməsi",
      "Pool metodu seç: sabit ₼ / satışdan % / mənfəətdən %",
      "Pool məbləği daxil et (məs. 500 ₼)",
      "+ Kateqoriya əlavə et",
      "Hər kateqoriyaya pay (₼ və ya %) və hədəf təyin et",
      "'Yadda saxla'",
    ],
    vacib: [
      "Yalnız sahibkar/admin və ya isci.bonus_idare icazəsi olanlar dəyişdirə bilir",
      "Hədəfə nail olunmazsa pay proporsional azalır",
      "Live hesablama real göstəricilərlə işləyir",
    ],
    sehife_url: "/iscilier",
    iconKey: "Coins",
    achar_sozler: ["bonus", "kpi", "maas", "profil"],
  },

  // ── TƏSDİQ ──
  {
    id: "tesdiq-merkezi",
    kateqoriya: "tesdiq",
    basliq: "Təsdiq Mərkəzi — 4-eyes prinsipi",
    qisa: "Əməkdaşın etdiyi işi 2-ci şəxs təsdiqləməlidir",
    nedir:
      "Kassir alış edəndə, müdir təsdiq edənə qədər stoka düşmür. Hər kateqoriyaya fərqli təsdiq edən təyin etmək olur.",
    necə_istifade: [
      "/tesdiq/ayarlar açılır",
      "12 əməliyyat növü görsənir (alış, satış, məhsul, endirim, qaytarma, xərc, silmə və s.)",
      "Hər birində toggle ON/OFF",
      "Hər birinin altında '👥 Təsdiq edənlər' panel — kim təsdiqləyə bilir",
      "Boş olsa, ümumi fallback siyahıya düşür",
    ],
    vacib: [
      "Yaradan öz işini özü təsdiqləyə bilmir (4-eyes)",
      "Hər təsdiq sorğusu bildirişlə təyin olunmuşlara gedir",
      "Düzəliş + təsdiq tək hərəkətdə — vaxt itməsin",
      "Hər düzəlişin qeydi tarixçəyə yazılır (KPI üçün)",
    ],
    sehife_url: "/tesdiq",
    iconKey: "ShieldCheck",
    achar_sozler: ["tesdiq", "4-eyes", "icaze", "nezaret"],
  },

  // ── GİZLİ MOD ──
  {
    id: "gizli-mod",
    kateqoriya: "gizli_mod",
    basliq: "Gizli mod — rəqəmləri rəqibdən gizlət",
    qisa: "Sistem-geneli vizual scale — real data toxunulmaz",
    nedir:
      "Dost, rəqib və ya təsadüfi şəxs ekranına baxsa real rəqəmləri görmür. Aktivləşdirdikdə bütün sistemdə (dashboard, satış, borc, KPI, hesabat) rəqəmlər kiçildilir.",
    necə_istifade: [
      "/sahibkar/gizli-mod açılır",
      "Scale seç: 10% / 20% / 50% / 70%",
      "Sahibkar PIN yığılır",
      "'Aktivləşdir' düyməsi",
      "Hər səhifədə bənövşəyi banner görünür",
      "Söndürmək üçün eyni səhifə + PIN",
    ],
    vacib: [
      "Real data DB-də toxunulmaz qalır — yalnız ekran maskalanır",
      "12 saatdan sonra avtomatik söndürülür",
      "Excel eksport, bank uzlaşma, vergi hesabatı HƏMIŞƏ real rəqəm verir",
      "Yalnız sahibkar (rol 9) idarə edə bilir",
    ],
    sehife_url: "/sahibkar/gizli-mod",
    iconKey: "EyeOff",
    achar_sozler: ["gizli", "stealth", "maskala", "rəqib"],
  },

  // ── AVTOMATLAŞMA ──
  {
    id: "borc-avto",
    kateqoriya: "avtomat",
    basliq: "Borc avto-tapşırıq",
    qisa: "Borcu olan müştərilərə avto-tapşırıq yaranır",
    nedir:
      "Hər gün sistem borcu N gündən artıq olan müştəriləri tapır və əməkdaşa tapşırıq yaradır.",
    necə_istifade: [
      "/ayarlar/borc-avto açılır",
      "Aktivləşdir toggle",
      "Borc gün eşiyi (məs. 30)",
      "Təkrar müddəti (məs. 7 gün — dublikat qoru)",
      "Default məsul əməkdaş seç (və ya 'Avto = satışın yaradanı')",
      "Yadda saxla",
    ],
    vacib: [
      "Yüksək borc (1000+ ₼) → prioritet yüksək",
      "Deadline: 3 gün sonra",
      "Tapşırıq müştəriyə bağlanır — müştəri kartında görünür",
      "KPI-yə təsir edir (vaxtında bitirilməsə)",
    ],
    sehife_url: "/ayarlar/borc-avto",
    iconKey: "Coins",
    achar_sozler: ["borc", "avto", "tapsiriq", "cron"],
  },
  {
    id: "seher-brifinq",
    kateqoriya: "avtomat",
    basliq: "Səhər brifinqi — gündəlik avto-bildiriş",
    qisa: "Hər səhər vacib məsələlər avto-bildiriş kimi gəlir",
    nedir:
      "Dashboard ilk dəfə açılanda sistem bütün vacib məsələləri yığıb sahibkar/admin-ə bildiriş kimi göndərir.",
    necə_istifade: [
      "Heç bir əl müdaxiləsi lazım deyil — avtomatik işləyir",
      "Hər səhər ilk girişdə tetiklenir",
      "Topbar zəng ikonunda görünür",
      "Hər bildirişin linki var — birbaşa məsələyə gedir",
    ],
    vacib: [
      "5 növ bildiriş yaranır: doğum günü, VIP itirilməkdə, yüksək borc, kritik stok, təsdiq",
      "Gündə 1 dəfə (idempotent — dublikat yox)",
      "Borc avto-tapşırıq da burada işə düşür",
    ],
    sehife_url: "/dashboard",
    iconKey: "Bell",
    achar_sozler: ["brifinq", "morning", "avto", "bildiris"],
  },
  {
    id: "anomaliya",
    kateqoriya: "avtomat",
    basliq: "Aktivlik anomaliya detektoru",
    qisa: "Şübhəli əməkdaş davranışını avto-tapır",
    nedir:
      "Sahibkar üçün — hər əməkdaşın aktivliyi izlənir. Gecə işləmə, həftəsonu aktivliyi, çox silmə kimi anomaliyalar avto-flag-lanır.",
    necə_istifade: [
      "/sahibkar/aktivlik açılır",
      "Müddət seç (1-90 gün)",
      "Hər əməkdaşda risk skoru görünür (0-100)",
      "50+ skor olanlar qırmızı bayraq alır",
      "Ada klik — həmin əməkdaşın audit-log tarixçəsi",
    ],
    vacib: [
      "Gecə (22:00-08:00) əməliyyatı +3 risk",
      "Həftəsonu əməliyyatı +2 risk",
      "Son 24s-də 50+ əməliyyat +25 risk",
      "Çox silmə (5+) +25 risk",
      "Bu sırf monitor — heç kim avtomatik cəzalandırılmır",
    ],
    sehife_url: "/sahibkar/aktivlik",
    iconKey: "Activity",
    achar_sozler: ["anomaliya", "aktivlik", "audit", "nezaret"],
  },

  // ── SAHİBKAR ──
  {
    id: "sahibkar-pin",
    kateqoriya: "sahibkar",
    basliq: "Sahibkar PIN sistemi",
    qisa: "Sahibkar bölməsi və həssas funksiyalar üçün ikinci təhlükəsizlik qatı",
    nedir:
      "Sahibkar bölməsinə (sahibkar/*) və ya bəzi həssas əməliyyatlara (gizli mod, backup) keçmək üçün PIN tələb olunur — adi login + PIN.",
    necə_istifade: [
      "/sahibkar/setup açılır (ilk dəfə)",
      "PIN təyin et (4-6 rəqəm)",
      "Hər dəfə sahibkar səhifəsinə girdikdə PIN istəyir",
      "Sessiya 15 dəqiqə (ayarlardan dəyişdirilə bilər)",
    ],
    vacib: [
      "Yalnız rol_id=9 (sahibkar) olanlar PIN qura bilir",
      "PIN unutsan, DB-dən mütəxəssis köməyilə sıfırlanır",
      "PIN ümumi paroldan FƏRQLİ olmalıdır",
    ],
    sehife_url: "/sahibkar",
    iconKey: "Lock",
    achar_sozler: ["pin", "sifre", "tehlukesizlik"],
  },
  {
    id: "backup",
    kateqoriya: "sahibkar",
    basliq: "Backup — bütün datanı JSON-a yüklə",
    qisa: "16 cədvəlin tam eksportu — sahibkar üçün təhlükəsizlik",
    nedir:
      "Bütün biznes data tək JSON faylına yüklənir. Şirkəti satdığında, mütəxəssis ilə müzakirə etdikdə və ya yerli backup üçün lazımdır.",
    necə_istifade: [
      "/sahibkar/backup açılır",
      "PIN sessiyası aktiv olmalıdır",
      "'Tam backup yüklə (JSON)' düyməsi",
      "Avto tarixli fayl yüklənir: 360biznes-backup-YYYY-MM-DD.json",
    ],
    vacib: [
      "Şifrə hash-ları daxil edilmir (təhlükəsizlik)",
      "Audit log son 5000 sətr (ölçü idarə)",
      "Backup faylı bütün biznes datanı ehtiva edir — şifrəli yerdə saxla",
      "Email ilə göndərdikdə 7-Zip ilə parolla qoy",
    ],
    sehife_url: "/sahibkar/backup",
    iconKey: "Database",
    achar_sozler: ["backup", "eksport", "json"],
  },

  // ── SƏNƏD ──
  {
    id: "senedler-qovluq",
    kateqoriya: "sened",
    basliq: "Sənədlər qovluq sistemi",
    qisa: "Google Drive üslubu fayl saxlama — yalnız sahibkar",
    nedir:
      "Vacib sənədləri (vergi sənədləri, müqavilələr, qaimələr, hesabatlar) sistemə yüklə. Qovluqlara böl, etiketlərlə tap.",
    necə_istifade: [
      "/sahibkar/senedler açılır",
      "'Yeni qovluq' düyməsi (alt-qovluq olarsa qovluqun içində bas)",
      "'Fayl yüklə' — kompüterdən PDF/Word/Excel/şəkil (max 20 MB)",
      "'Link əlavə et' — Google Drive / Dropbox URL",
      "Etiketlər + qeyd əlavə et — sonradan tap",
    ],
    vacib: [
      "Yalnız sahibkar PIN ilə baxa bilir",
      "Fayl UUID adı ilə saxlanır — URL təxmin edilməz",
      "Axtarış: ad, qeyd, etiketdə işləyir",
    ],
    sehife_url: "/sahibkar/senedler",
    iconKey: "FolderArchive",
    achar_sozler: ["sened", "qovluq", "fayl", "drive"],
  },

  // ── HESABAT ──
  {
    id: "hesabat-merkezi",
    kateqoriya: "hesabat",
    basliq: "Hesabat mərkəzi",
    qisa: "Bütün hesabatlar tək yerdə — satış, marja, anbar, müştəri, maliyyə",
    nedir:
      "20+ ayrı hesabat səhifəsi. Hər birinin filterli görünüşü, qrafiki və Excel eksportu var.",
    necə_istifade: [
      "/hesabatlar açılır",
      "Kateqoriya seç: Satış / Marja / Anbar / Müştəri / Maliyyə / Marketplace və s.",
      "Tarix aralığı və filter seç",
      "Qrafiklər və cədvəllər görünür",
      "'Excel' düyməsi ilə eksport",
    ],
    vacib: [
      "Gizli mod aktivdirsə rəqəmlər scale olunur",
      "Excel eksport HƏMIŞƏ real data verir",
      "Filiala görə ayırma mümkündür",
    ],
    sehife_url: "/hesabatlar",
    iconKey: "FileText",
    achar_sozler: ["hesabat", "hesab", "report", "analiz"],
  },
];
