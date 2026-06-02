/**
 * 360biznes ERP üçün help/dokumentasiya mövzuları.
 * Sahibkar və əməkdaşların sistemin hər funksiyasını başa düşməsi üçün.
 */

export type KomekciKateqoriya =
  | "baslangic"
  | "dashboard"
  | "nezaret"
  | "pos"
  | "tapshiriq"
  | "anbar"
  | "ticaret"
  | "maliyye"
  | "elaqe"
  | "satis_alis"
  | "musteri"
  | "isci_kpi"
  | "tesdiq"
  | "gizli_mod"
  | "avtomat"
  | "sahibkar"
  | "sened"
  | "hesabat"
  | "kampaniya";

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
  dashboard:   { label: "Dashboard",       icon: "LayoutDashboard", rang: "text-sky-500" },
  nezaret:     { label: "Nəzarət Mərkəzi", icon: "ShieldAlert",   rang: "text-rose-500" },
  pos:         { label: "POS / Kassa",     icon: "ScanLine",     rang: "text-rose-500" },
  tapshiriq:   { label: "Tapşırıqlar",     icon: "ListTodo",     rang: "text-primary" },
  anbar:       { label: "Anbar",           icon: "Package",      rang: "text-emerald-500" },
  ticaret:     { label: "Ticarət",         icon: "ShoppingCart", rang: "text-emerald-500" },
  maliyye:     { label: "Maliyyə",         icon: "Coins",        rang: "text-amber-500" },
  elaqe:       { label: "Elaqə (CRM)",     icon: "Users",        rang: "text-pink-500" },
  satis_alis:  { label: "Satış & Alış",    icon: "ShoppingCart", rang: "text-emerald-500" },
  musteri:     { label: "Müştəri & CRM",   icon: "Users",        rang: "text-pink-500" },
  isci_kpi:    { label: "İşçi & KPI",      icon: "Briefcase",    rang: "text-sky-500" },
  tesdiq:      { label: "Təsdiq sistemi",  icon: "ShieldCheck",  rang: "text-amber-500" },
  gizli_mod:   { label: "Gizli mod",       icon: "EyeOff",       rang: "text-violet-500" },
  avtomat:     { label: "Avtomatlaşma",    icon: "Zap",          rang: "text-orange-500" },
  sahibkar:    { label: "Sahibkar paneli", icon: "Crown",        rang: "text-rose-500" },
  sened:       { label: "Sənədlər",        icon: "FolderArchive",rang: "text-amber-500" },
  hesabat:     { label: "Hesabat",         icon: "FileText",     rang: "text-indigo-500" },
  kampaniya:   { label: "Kampaniyalar",    icon: "Megaphone",    rang: "text-fuchsia-500" },
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

  // ── KAMPANIYALAR ──
  {
    id: "kampaniya-yarat",
    kateqoriya: "kampaniya",
    basliq: "Yeni kampaniya yaratmaq",
    qisa: "Endirim, BOGO, kupon, flash sale və 13 başqa tip kampaniya",
    nedir:
      "Kampaniyalar mərkəzində istənilən satış kampaniyasını yaratmaq olur — % endirim, sabit endirim, BOGO (al-bir al-bir), pilləli endirim, kupon, flash sale, doğum günü, welcome və s. Hazır şablonlar da var.",
    necə_istifade: [
      "/kampaniyalar açılır",
      "«Şablondan» düyməsi ilə hazır 16 şablondan birini seç (məsələn Novruz 20%, Welcome 10%)",
      "Və ya «Yeni kampaniya» — boş formada tip və şərt seç",
      "Ad ver, prioritet təyin et, başlama/bitmə tarixi qoy",
      "İstifadə limitləri qur (cəm və müştəri başına)",
      "«Yarat (qaralama)» bas — kampaniya draft vəziyyətdə yaranır",
      "Detal səhifəsində «Aktivləşdir» — kampaniya işə düşür",
    ],
    vacib: [
      "Qaralama vəziyyətində kampaniya satışa təsir etmir",
      "«Stack icazəli» — başqa kampaniyalarla birləşə bilər",
      "Limitsiz üçün «Müştəri başına» və «Maks istifadə» sahələrini boş qoy",
      "Vaxtı keçən kampaniyalar avtomatik «Bitdi» statusuna keçir",
    ],
    sehife_url: "/kampaniyalar",
    iconKey: "Megaphone",
    achar_sozler: ["kampaniya", "endirim", "bogo", "kupon", "flash", "discount"],
  },
  {
    id: "loyalty-kart",
    kateqoriya: "kampaniya",
    basliq: "Loyalty (sadiqlik) kartı necə işləyir",
    qisa: "Müştəri yarananda avto-kart, bonus toplama, tier sistemi (Bronze→Platinum)",
    nedir:
      "Hər yeni müştəri qeydiyyatdan keçəndə avtomatik unikal LK+9 rəqəm kartı yaranır. Hər alışdan tier-inə görə bonus toplanır. 4 tier var: Bronze, Silver, Gold, Platinum.",
    necə_istifade: [
      "/elaqe-də yeni müştəri yarat — avto kart yaranır",
      "Müştəri profilində loyalty paneli görünür (kart kodu, balans, tier)",
      "«Çap» düyməsi ilə kartı PDF kimi yadda saxla və ya çap et",
      "POS-da kart oxutmaq üçün: barkod scanner ilə skan və ya telefon nömrəsi/kod yaz",
      "Bonus toplandıqca tier avto-yüksəlir (illik xərclə)",
      "«Bonus ilə öde» düyməsi POS-da görünür — balansdan müəyyən % istifadə",
    ],
    vacib: [
      "Avto-yaratmanı /kampaniyalar/ayarlar səhifəsindən söndürmək olur",
      "Bonus istifadə limiti (səbətdən maks %) ayarlardandır (default 30%)",
      "Tier-ə uyğun: Bronze 1% / Silver 2%+3% endirim / Gold 3%+5% / Platinum 5%+8%",
      "Bonus expire müddəti default 6 ay (ayarlanır)",
    ],
    sehife_url: "/kampaniyalar/loyalty",
    iconKey: "Star",
    achar_sozler: ["loyalty", "sadiqlik", "bonus", "kart", "tier", "barkod"],
  },
  {
    id: "kart-cap",
    kateqoriya: "kampaniya",
    basliq: "Loyalty kartını çap etmək",
    qisa: "Plastik kart üçün PDF / kağızda çap — QR + barkod ilə",
    nedir:
      "Loyalty kartını standart bank kart ölçüsündə (85.6×54 mm) PDF kimi saxlamaq və ya çap etmək olur. Ön tərəfdə şirkət adı + tier rəngi + kart kodu, arxa tərəfdə QR kod + təlimat.",
    necə_istifade: [
      "Müştəri profilinə gir → loyalty paneli",
      "«Çap» düyməsinə bas — yeni tab açılır",
      "Brauzerin print menyusu: «Print» və ya Cmd+P",
      "«Save as PDF» seç — kartı kompüterdə saxla",
      "Ya da plastik kartda çap üçün print et",
      "QR kod-u skan etdikdə kart kodu çıxır (POS scanner üçün)",
    ],
    vacib: [
      "Kart rəngi tier-ə uyğun gəlir (Bronze/Silver/Gold/Platinum)",
      "QR kod api.qrserver.com vasitəsi ilə generasiya olunur (internet lazımdır)",
      "Bir müştəriyə 1 kart — itirdikdə yeni kart açıb köhnəni deaktiv et",
    ],
    sehife_url: "/kampaniyalar/loyalty",
    iconKey: "Printer",
    achar_sozler: ["çap", "print", "pdf", "kart", "barkod", "qr"],
  },
  {
    id: "hediyye-kart",
    kateqoriya: "kampaniya",
    basliq: "Hədiyyə kartı necə işləyir",
    qisa: "Müştəriyə qabaqcadan ödənilmiş kart sat — POS-da istifadə edilir",
    nedir:
      "Hədiyyə kartı (Gift Card) — qabaqcadan müəyyən məbləğ üçün satılan kart. Sahibi POS-da kodu daxil edib o məbləğdən istifadə edir. Hədiyyə üçün ideal.",
    necə_istifade: [
      "/kampaniyalar/giftcards açılır",
      "«Yeni hədiyyə kartı» düyməsinə bas",
      "Nominal məbləğ seç (50/100/200/500 ₼ preset və ya əl ilə)",
      "Opsional: bitmə tarixi qoy",
      "Yarat — unikal GC kod yaranır, kopyala",
      "«Çap» düyməsi ilə kartı PDF kimi saxla, müştəriyə təqdim et",
      "Müştəri POS-da kodu daxil edir — qalıqdan ödəniş çıxır",
    ],
    vacib: [
      "Kart kodunu satdıqdan sonra istənilən vaxt deaktiv etmək olur",
      "Qalıq tam istifadə edildikdə kart avtomatik passiv olur",
      "Sahibsiz (kontragent_id=NULL) kartlar — açıq satış üçün",
    ],
    sehife_url: "/kampaniyalar/giftcards",
    iconKey: "CreditCard",
    achar_sozler: ["hədiyyə", "gift", "kart", "qabaqcadan"],
  },
  {
    id: "kupon-kod",
    kateqoriya: "kampaniya",
    basliq: "Kupon kodu yaratmaq və toplu generasiya",
    qisa: "Tək kod ya 1000+ unikal kod birdən — sosial şəbəkə reklamı üçün",
    nedir:
      "Kupon kampaniyası yaradıb altında istənilən sayda unikal promokod generasiya etmək olur. Müştəri POS-da kodu daxil edir, endirim avtomatik tətbiq olunur.",
    necə_istifade: [
      "/kampaniyalar/yeni — tip «Kupon kodu» seç",
      "Adı və endirim faizini ver",
      "Yarat — kampaniya draft",
      "Detal səhifəsində «Toplu kupon yarat» düyməsi",
      "Prefiks (məs. NOVRUZ), say (10-2000), hər kod neçə dəfə",
      "Yarat — bütün kodlar siyahısı görünür",
      "Müştəri POS-da kodu daxil edir — endirim çıxır",
    ],
    vacib: [
      "Prefiks yalnız böyük hərf və rəqəm",
      "Hər kod default 1 dəfə istifadə olunur",
      "Bitmə tarixi opsional — boş qoysan müddətsizdir",
      "Bir müştəriyə xüsusi kod — kontragent_id ilə bağla",
    ],
    sehife_url: "/kampaniyalar",
    iconKey: "Ticket",
    achar_sozler: ["kupon", "promokod", "kod", "coupon"],
  },

  // ── DASHBOARD ──
  {
    id: "dashboard-ne",
    kateqoriya: "dashboard",
    basliq: "Dashboard nədir, hansı bölmələri var?",
    qisa: "Ana səhifə — biznesin gündəlik mənzərəsi bir ekranda",
    nedir:
      "Dashboard sistemə girişdə görsənən birinci səhifədir. Bütün modullardan ən vacib göstəriciləri toplayır: bu günkü satış, ay üzrə müqayisə, açıq tapşırıqlar, aşağı stok, top məhsullar, son əməliyyatlar. Hər bölmə hardasa real bir səhifəyə bağlanır — kliklə tam detal açılır.",
    necə_istifade: [
      "Yuxarı: salam + Nəzarət, Hesabat düymələri",
      "5 sürətli əməliyyat: POS, Yeni satış, Yeni alış, Servis, Yeni müştəri",
      "Hero: Bu ayın gəliri (böyük rəqəm + 30-günlük sparkline) + Bu gün snapshot",
      "KPI strip: Xərc / Mənfəət / Yeni müştəri — keçən ayla müqayisə + trend",
      "Bu gün pul axını: mədaxil / məxaric / net + bar chart",
      "Mənim işim: effektivlik ringi (gecikmiş tapşırıq faizi)",
      "Charts: 30 günlük satış + satış vs xərc",
      "Aşağı stok, Top 5 məhsul, Son satışlar, İş feed",
    ],
    vacib: [
      "Hər bölmə icazə əsasında görünür — `dashboard.kpi`, `dashboard.charts` və s.",
      "İcazəsiz əməkdaş yalnız öz tapşırığını görür",
      "Auto-refresh 60 saniyə — yuxarıdakı düymə ilə yandırıb söndürmək olur",
      "Bütün rəqəmlər canlı DB-dən gəlir, 60s cache ilə",
    ],
    sehife_url: "/dashboard",
    iconKey: "LayoutDashboard",
    achar_sozler: ["dashboard", "ana", "başlanğıc", "panel", "ümumi"],
  },
  {
    id: "dashboard-kpi",
    kateqoriya: "dashboard",
    basliq: "KPI rəqəmləri necə hesablanır?",
    qisa: "Gəlir, xərc, mənfəət — formulalar və müqayisə bazası",
    nedir:
      "KPI-lər (Key Performance Indicators) biznesin sağlamlığını ölçən rəqəmlərdir. Dashboard 4 əsasını göstərir: Bu ayın gəliri, Bu ayın xərci, Mənfəət, Yeni müştərilər. Hər rəqəmin yanında keçən ayla müqayisə % faizi (yaşıl ▲ ya qırmızı ▼).",
    necə_istifade: [
      "Gəlir = bu ay yaradılan, qaralama olmayan satış sənədlərinin son məbləğinin cəmi",
      "Xərc = bu ayın `maliyye_xercler` sənədlərinin cəmi",
      "Mənfəət = Gəlir − Xərc, marja % = mənfəət/gəlir × 100",
      "Yeni müştəri = bu ayda yaradılmış müştəri sayı",
      "Müqayisə = bu ay (1-cü gündən bu günə) vs keçən ayın eyni intervalına",
      "Sparkline = son 30 günün gündəlik dəyərləri",
    ],
    vacib: [
      "Qaralama satışlar gəlirə daxil deyil — yalnız təsdiqlənmişlər",
      "Trend % keçən aya görə hesablanır, keçən il yox",
      "Marja mənfi olarsa qırmızı rənglə göstərilir",
      "Hesabatlar səhv görünürsə /ayarlar/ilkin-qaliqlar yoxla — başlanğıc dəyərlər lazımdır",
    ],
    sehife_url: "/dashboard",
    iconKey: "TrendingUp",
    achar_sozler: ["kpi", "gəlir", "xərc", "mənfəət", "müqayisə", "rəqəm"],
  },
  {
    id: "dashboard-bugun",
    kateqoriya: "dashboard",
    basliq: "«Bu gün» snapshot — real-time biznes göstəriciləri",
    qisa: "Satış, pul axını, açıq tapşırıq — bu günkü canlı vəziyyət",
    nedir:
      "Hero-nun sağ tərəfindəki kart «Bu gün» — sistemin canlı vəziyyətini göstərir. Hər 60 saniyədən bir avtomatik yenilənir. 4 göstərici: Satış (gün cəmi + sifariş sayı), Net pul axını, Açıq tapşırıq, Aşağı stok.",
    necə_istifade: [
      "Satışın üstünə klik → /ticaret/satislar tam siyahı",
      "Net pul axını = mədaxil − məxaric (bu gün)",
      "Açıq tapşırıq → /tapshiriqlar (kliklə filter ilə açılır)",
      "Aşağı stok → /anbar/mehsullar?stok=az kritik səviyyədəkilər",
      "Müştəri sayı (aktiv) → /elaqe",
    ],
    vacib: [
      "Real-time gözü (yaşıl ping) auto-refresh işlədiyini bildirir",
      "Bu gün = saat 00:00-dan indiyə qədər",
      "Aşağı stok yalnız `kritik_stok` təyin olunan məhsullar üçün hesablanır",
    ],
    sehife_url: "/dashboard",
    iconKey: "Zap",
    achar_sozler: ["bu gün", "real-time", "canlı", "snapshot", "today"],
  },
  {
    id: "dashboard-menim-isim",
    kateqoriya: "dashboard",
    basliq: "«Mənim işim» effektivlik ringi necə oxunur?",
    qisa: "Açıq tapşırıqlarının nə qədəri vaxtındadır",
    nedir:
      "Sahibkar/əməkdaş üçün şəxsi məhsuldarlıq göstəricisi. Dairə (ring) içində % rəqəmi: açıq tapşırıqlarından nə qədəri gecikməyib. Yanında 3 mini-kart: açıq, xatırlatma, gecikmiş — hər biri klik-li, tapşırıqlar səhifəsinə filter ilə yönləndirir.",
    necə_istifade: [
      "Açıq = mənim olan, baxılır/planlaşdırılan statuslu tapşırıqlar",
      "Xatırlatma = bu gün vaxtı çatan xatırlatmalar",
      "Gecikmiş = deadline keçib amma bağlanmayan",
      "Ring %: (açıq − gecikmiş) / açıq × 100",
      "Yaşıl 90%+ möhtəşəm · Sarı 60-90% diqqətli ol · Qırmızı <60% düz toxun",
    ],
    vacib: [
      "Yalnız sənin (myself) tapşırıqlarına baxır, komandanın yox",
      "Gecikmiş tapşırığı bağladıqda dərhal ring rəngi dəyişir",
      "Aşağıdakı «Növbəti 4 tapşırıq» deadline-a görə sıralanır",
    ],
    sehife_url: "/tapshiriqlar",
    iconKey: "ListTodo",
    achar_sozler: ["tapşırıq", "effektivlik", "ring", "məhsuldarlıq", "iş"],
  },
  {
    id: "dashboard-chartlar",
    kateqoriya: "dashboard",
    basliq: "Dashboard chartları necə işləyir?",
    qisa: "30 günlük trend, satış vs xərc müqayisəsi",
    nedir:
      "İki əsas chart: «Son 30 gün satış» (yalnız satış xətti) və «Satış vs Xərc» (iki xətt yan-yana). Hər ikisi gündəlik aggregasiyadır. Hover ilə həmin günün dəyəri görünür.",
    necə_istifade: [
      "Yaşıl xətt = gündəlik satış cəmi",
      "Qırmızı xətt = gündəlik xərc cəmi",
      "Fərq (mənfəət) chart altındakı KPI-da görünür",
      "Daha detallı görmək üçün /hesabatlar səhifəsi",
    ],
    vacib: [
      "Chart 60s cache-li — yenilənməsi üçün auto-refresh düyməsini bas",
      "Boş günlər (satışsız) həmin gündə 0 göstərir",
      "Bütün məbləğlər ana valyutada (₼)",
    ],
    sehife_url: "/hesabatlar",
    iconKey: "BarChart3",
    achar_sozler: ["chart", "qrafik", "trend", "30 gün", "müqayisə"],
  },

  // ── ELAQƏ (CRM) ──
  {
    id: "elaqe-ne",
    kateqoriya: "elaqe",
    basliq: "Elaqə modulu — müştəri, təchizatçı, borc",
    qisa: "CRM mərkəzi: kataloq, RFM, borc analizi, doğum günü, dublikat aşkar",
    nedir:
      "Elaqə modulu kontragentləri idarə edir: müştəri, təchizatçı, ya «hər ikisi». 11 alt-bölmə: kataloq, müştəri, təchizatçı, borclu, follow-up, inaktiv, doğum günü, dublikat, hesabat. Hər kontragent: ad, telefon, email, ünvan, VÖEN, FİN kod, borc limiti, kateqoriya, etiket.",
    necə_istifade: [
      "/elaqe — ümumi kataloq (müştəri + təchizatçı bir yerdə)",
      "/elaqe/musteriler — yalnız müştərilər",
      "/elaqe/techizatcilar — yalnız təchizatçılar",
      "/elaqe/borclar — borc analizi + bulk SMS xatırlatma",
      "/elaqe/followup — CRM follow-up (müştəri ilə əlaqə izi)",
      "/elaqe/inaktiv — uzun müddət alış etməyən",
      "/elaqe/dogum-gunu — bu ay/həftə doğum günü olan müştərilər",
      "/elaqe/dublikat — eyni telefon/ad ilə təkrarlanan kontragent",
      "/elaqe/hesabat — RFM analizi + tier paylanışı",
    ],
    vacib: [
      "Yeni müştəri yaradıldıqda avto loyalty kart açılır (sahibkar ayarı varsa)",
      "Borc limiti aşıldıqda nisyə satış bloklanır (sənədli satış)",
      "Gizli mod: müştəri profili gizlə (telefon/ünvan masklı görünür)",
      "Bulk SMS/Telegram yalnız menecer və sahibkar",
    ],
    sehife_url: "/elaqe",
    iconKey: "Users",
    achar_sozler: ["müştəri", "təchizatçı", "crm", "borc", "kontragent"],
  },
  {
    id: "elaqe-icazeler",
    kateqoriya: "elaqe",
    basliq: "Elaqə icazələri — 15 icazə",
    qisa: "Master + müştəri/təchizatçı CRUD + analiz + bulk mesaj",
    nedir:
      "Elaqə modulu üçün 15 icazə: master elaqe.oxu + musteri.* (5) + techizatci.* (3) + analiz (borc/followup/inaktiv/dublikat/hesabat) + bulk_mesaj. Həssas məlumat (telefon/email) `musteri.gizli` icazəsi ilə açılır.",
    necə_istifade: [
      "/ayarlar/rollar — «Elaqə» modulu aç",
      "musteri.oxu — müştəri kataloqu görmək (default hamı)",
      "musteri.yarat — yeni müştəri",
      "musteri.duzelt — telefon, borc limiti dəyişdir",
      "musteri.sil — müştəri arxivlə",
      "musteri.gizli — gizli mod-da maskalı məlumatları açıq görmək",
      "techizatci.yarat — anbardar üçün",
      "elaqe.borc — borc analizi + bulk xatırlatma",
      "elaqe.bulk_mesaj — kütləvi SMS/Telegram",
    ],
    vacib: [
      "Kassir → müştəri yarat (POS-da müştəri əlavə)",
      "Satıcı → müştəri tam CRUD + followup",
      "Anbardar → təchizatçı oxu/yarat",
      "Mühasib → borc analizi + bütün oxu",
    ],
    sehife_url: "/ayarlar/rollar",
    iconKey: "ShieldCheck",
    achar_sozler: ["icazə", "müştəri", "elaqe", "rol"],
  },
  {
    id: "elaqe-cross-module",
    kateqoriya: "elaqe",
    basliq: "Elaqə digər modullarla necə bağlanır?",
    qisa: "POS, Ticarət, Maliyyə, Loyalty, Tapşırıq, Bildiriş",
    nedir:
      "Kontragent ERP-də 9 modula bağlıdır: hər satış, alış, ödəniş, qaytarma, loyalty bonus, doğum günü, kampaniya — kontragentlə əlaqəlidir.",
    necə_istifade: [
      "Satış → müştəri profilində qaymə tarixçəsi",
      "Alış → təchizatçı profilində alış tarixçəsi",
      "Maliyyə → borc/alacaq analizi /maliyye/debitor + /kreditor",
      "Loyalty → müştəri kartı, tier, bonus tarixçə",
      "Kampaniya → kupon yalnız bir müştəri üçün",
      "Tapşırıq → müştəri profilinə tapşırıq əlavə (zəng, görüş)",
      "Telegram bot → bulk xatırlatma (borc, doğum günü)",
      "Avtomatlaşdırma → inaktiv müştəri aşkarı → re-engagement kampaniyası",
      "Audit log → kontragent dəyişikliklərinin tarixçəsi",
    ],
    vacib: [
      "Kontragent dublikatı qarşısı: ad + telefon + VÖEN unikal yoxlanır",
      "RFM (Recency, Frequency, Monetary) avtomatik hesablanır",
      "Tier (Bronze/Silver/Gold/Platinum) ömürlik xərc əsasında",
    ],
    sehife_url: "/elaqe",
    iconKey: "Link2",
    achar_sozler: ["elaqe", "cross", "müştəri", "borc"],
  },

  // ── MALİYYƏ ──
  {
    id: "maliyye-ne",
    kateqoriya: "maliyye",
    basliq: "Maliyyə modulu — 17 alt-bölmə",
    qisa: "Kassa, bank, xərc, ödəniş, gün sonu, ƏDV, P/L",
    nedir:
      "Maliyyə modulu pul axınını izləyir: kassalar, bank hesabları, gəlir/gider əməliyyatları, müştəri borc/alacaq (debitor/kreditor), gün sonu hesablama, vergi (ƏDV/yol), P/L balans, təkrarlanan ödənişlər. Hər modul bir-birinə bağlıdır: POS satışı → kassa qalığı, alış sənədi → təchizatçı borc.",
    necə_istifade: [
      "/maliyye — ümumi dashboard (KPI, forecast)",
      "/maliyye/kassalar — kassa qalıqları (filial üzrə)",
      "/maliyye/bank — bank hesabları və çıxarış import",
      "/maliyye/xercler — xərc tarixçəsi (kateqoriya, periyod)",
      "/maliyye/gun-sonu — gün bağlanışı, kassa fərqi",
      "/maliyye/debitor — müştəri borcları",
      "/maliyye/kreditor — təchizatçı borcları",
      "/maliyye/pul-axini — gündəlik / həftəlik / aylıq cash flow",
      "/maliyye/pl-balans — P/L hesabatı",
      "/maliyye/edv + /yol-vergisi — vergi hesabatları",
      "/maliyye/recurring — kirayə, abunə kimi təkrarlanan ödəniş qaydaları",
    ],
    vacib: [
      "Sahibkar/admin hər şeyə baxır, mühasib hesabatlar + xərc yaratma",
      "Menecer kassa/bank oxu + xərc/ödəniş yarat",
      "Kassir yalnız öz kassasını və ödəniş qəbulu",
      "Bank əməliyyatı dəyişikliyi (yeni hesab əlavə) yalnız sahibkar",
    ],
    sehife_url: "/maliyye",
    iconKey: "Coins",
    achar_sozler: ["maliyyə", "kassa", "bank", "pul", "ödəniş", "xərc"],
  },
  {
    id: "maliyye-icazeler",
    kateqoriya: "maliyye",
    basliq: "Maliyyə icazələri — 16 icazə",
    qisa: "Master + alt-icazələrlə tam nəzarət",
    nedir:
      "Maliyyə həssas modul, ona görə 16 ayrı icazə var. Master `maliyye.oxu` + alt: kassa.oxu/emeliyyat, bank.oxu/emeliyyat, xerc.oxu/yarat/idare, odenis.qebul/yarat, debitor.oxu, kreditor.oxu, maliyye.gun_sonu, maliyye.hesabat, edv.idare, maliyye.recurring.",
    necə_istifade: [
      "/ayarlar/rollar — «Maliyyə» modulu aç",
      "kassa.oxu — qalıq görmək (kassir öz kassası üçün)",
      "kassa.emeliyyat — yeni kassa, qalıq düzəliş",
      "bank.oxu — bank hesabları görmək",
      "bank.emeliyyat — yeni hesab əlavə (sahibkar)",
      "xerc.yarat / xerc.idare — xərc əməliyyatları",
      "odenis.qebul — müştəri borcuna qarşı qəbul (POS-da işləsin deyə kassirə)",
      "odenis.yarat — manual ödəniş (təchizatçıya/işçiyə)",
      "maliyye.gun_sonu — gün bağla, fərqi hesabla",
      "maliyye.hesabat — P/L, balans, pul axını",
    ],
    vacib: [
      "Server action-da hər biri yoxlanır",
      "Kassir POS-dan satış edir → odenis.qebul avtomatik tələb",
      "Mühasib bank.emeliyyat görmür — yalnız sahibkar",
    ],
    sehife_url: "/ayarlar/rollar",
    iconKey: "ShieldCheck",
    achar_sozler: ["maliyyə", "icazə", "kassir", "mühasib", "permission"],
  },
  {
    id: "maliyye-gun-sonu",
    kateqoriya: "maliyye",
    basliq: "Gün sonu — kassa bağlanış və fərq",
    qisa: "Gün ərzində satış cəmi vs faktiki kassa qalığı",
    nedir:
      "/maliyye/gun-sonu — gün başlanğıcı qalıqdan satış/gider çıxarıb sonu hesablayır. Kassir faktiki nağdı sayır, fərq qeyd olunur (overage/shortage). Bağlanmış sessiyalar daxil edilir.",
    necə_istifade: [
      "/maliyye/gun-sonu — bu gün açılır",
      "Cədvəldə hər kassa: açılış qalığı, satış, qəbul, çıxar, hesablanan, faktiki, fərq",
      "Hər kassir öz sessiyasını bağladıqdan sonra «gün bağla» düyməsi aktiv olur",
      "Fərq varsa səbəb daxil et (kobud xəta / itki / əskik say)",
      "Tarix əvvəlcədən bağlanıbsa yenidən aça bilməz — yalnız sahibkar",
    ],
    vacib: [
      "Gün bağlanmadan növbəti gün açılmır (opsional ayar)",
      "Bağlanmış gün audit log-da saxlanır",
      "Müştəri borc balansları hər gün sonu yenilənir",
      "İcazə: maliyye.gun_sonu",
    ],
    sehife_url: "/maliyye/gun-sonu",
    iconKey: "Sunset",
    achar_sozler: ["gün sonu", "kassa bağla", "fərq", "yığma"],
  },
  {
    id: "maliyye-cross-module",
    kateqoriya: "maliyye",
    basliq: "Maliyyə digər modullarla necə bağlanır?",
    qisa: "POS, Ticarət, Elaqe, Anbar, Sahibkar paneli",
    nedir:
      "Maliyyə bütün biznesin pul nüvəsidir. Hər əməliyyat — satış, alış, qaytarma, xərc — burada əks olunur.",
    necə_istifade: [
      "POS satış → kassa nağd/kart/bank qalığı dəyişir",
      "Satış nisyə → müştəri borcu artır (debitor)",
      "Alış nisyə → təchizatçı borcu artır (kreditor)",
      "Maaş ödənişi → işçi əməkhaqqı çıxar",
      "Kommissiya → satıcı bonus məxarici",
      "Bank import → çıxarışı sistemə yüklə + avto-reconciliation",
      "Marketplace gəlir → /maliyye/marketplace komissiya hesab",
      "Sahibkar panel → CEO KPI burada cəmlənir",
      "Dashboard → bu gün pul axını widget burada hesablanır",
    ],
    vacib: [
      "Cash flow forecast satış sürətinə + təkrarlanan ödənişə baxır",
      "ƏDV xərcdə input-tax / satışda output-tax avtomatik tutulur",
      "Audit log — bütün maliyyə dəyişikliklər izlənir",
    ],
    sehife_url: "/maliyye",
    iconKey: "Link2",
    achar_sozler: ["maliyyə", "cross", "pos-kassa", "satış-borc"],
  },

  // ── TİCARƏT ──
  {
    id: "ticaret-ne",
    kateqoriya: "ticaret",
    basliq: "Ticarət modulu — 11 alt-bölmə",
    qisa: "Satış, alış, qaytarma, təklif, taksit, marketplace — bir yerdə",
    nedir:
      "Ticarət ERP-də sənəd əsaslı satış/alış əməliyyatlarını idarə edir. POS-dan fərq: ticarət sənədli formaldır (qaymə, qaytarma akti, kommersial təklif), POS isə kassir-tələsik. 11 alt-bölmə: satış, alış, qaytarma, kommersial təklif, pipeline, taksit, marketplace satışlar.",
    necə_istifade: [
      "/ticaret — ümumi ticarət dashboard (KPI, top satıcı, top məhsul, AI insights)",
      "/ticaret/satislar — bütün satış sənədləri (filter, status)",
      "/ticaret/satis-yeni — yeni formal satış (qaymə)",
      "/ticaret/alislar — təchizatçıdan alış sənədləri",
      "/ticaret/qaytarma — müştəri qaytarmaları + tez qaytarma scan",
      "/ticaret/teklif — kommersial təklif (müştəriyə qiymət göndər)",
      "/ticaret/kredit — taksit / kredit izi",
      "/ticaret/market-satis — Trendyol, Amazon və s. sifarişlər",
    ],
    vacib: [
      "POS-dan fərq: ticarət formal sənəddir, POS sürətli kassa",
      "Satış təsdiqi aktivdirsə qaymə stoka düşməz təsdiqlənənə qədər",
      "Qaytarma stoku artırır + ödəniş geri qaytarır",
      "Marketplace sifariş webhook ilə avto-yaranır",
    ],
    sehife_url: "/ticaret",
    iconKey: "ShoppingCart",
    achar_sozler: ["ticarət", "satış", "alış", "qaytarma", "qaymə"],
  },
  {
    id: "ticaret-icazeler",
    kateqoriya: "ticaret",
    basliq: "Ticarət icazələri — 15 icazə",
    qisa: "Hər əməliyyat tipi üçün ayrı icazə",
    nedir:
      "Ticarət modulu üçün 15 icazə var: master ticaret.oxu + satis.* (4) + alis.* (2) + qaytarma.* (2) + teklif.* (2) + pipeline + kredit.* (2) + market. Rol əsaslı paylaşma: kassir oxu, satıcı satış+təklif, anbardar alış+qaytarma, mühasib hamısı oxu, menecer hamısı, sahibkar ləğv də.",
    necə_istifade: [
      "/ayarlar/rollar — «Ticarət» modulu aç",
      "satis.yarat / satis.duzelt / satis.legv — formal satışda nə edə bilir",
      "alis.yarat — yalnız anbardar və yuxarı",
      "qaytarma.yarat — kassir + satıcı + anbardar + menecer",
      "teklif.yarat — satıcı + menecer (müştəri əldə etmək)",
      "kredit.yarat — yalnız menecer / sahibkar (risk var)",
      "market.oxu — sifariş axınını yalnız menecer izləsin",
    ],
    vacib: [
      "Sahibkar/admin avtomatik bütün icazələrə malikdir",
      "Server action-larda icazə yoxlanır — UI-də gizlətmək yetmir",
      "İcazə yoxsa response: «X icazəsi lazımdır»",
    ],
    sehife_url: "/ayarlar/rollar",
    iconKey: "ShieldCheck",
    achar_sozler: ["ticarət", "icazə", "satıcı", "kassir"],
  },
  {
    id: "ticaret-pos-fark",
    kateqoriya: "ticaret",
    basliq: "POS vs Ticarət — hansı zaman hansını?",
    qisa: "Sürətli kassa satışı — POS, sənədli satış — Ticarət",
    nedir:
      "İki ayrı iş axını: POS (kassir, sürətli, fokus) və Ticarət (sənəd, formal, plan). Hər ikisi DB-də eyni `satis_sifarisleri` cədvəlinə yazır — fərq UX-də və metadata-da.",
    necə_istifade: [
      "POS — adi pərakəndə müştəri, dərhal ödəniş, qısa çek",
      "Ticarət — toptan, korporativ müştəri, qaymə, ƏDV-li",
      "POS-da qaralama yoxdur — satış birbaşa yarananda təsdiqlənir",
      "Ticarət qaralama saxlaya bilir 48 saat — stok rezerv olunur",
      "Kommersial təklif yalnız ticarətdədir — müştəriyə email/PDF",
      "Marketplace sifariş ticarətdə — POS-da görünmür",
    ],
    vacib: [
      "İcazələr ayrıdır — kassir POS-da işləyir amma satis-yeni-də işləməyə bilər",
      "Hesabatlar (ticarət dashboard) hər iki növ satışı birləşdirir",
    ],
    sehife_url: "/ticaret",
    iconKey: "GitCompare",
    achar_sozler: ["pos", "ticarət", "fərq", "qaymə"],
  },
  {
    id: "ticaret-cross-module",
    kateqoriya: "ticaret",
    basliq: "Ticarət digər modullarla necə bağlanır?",
    qisa: "Anbar, Elaqe, Maliyyə, Avtomat, Təsdiq, Dashboard, Hesabat",
    nedir:
      "Ticarət ERP-də nüvə əməliyyatdır — hər sənəd anbara (stok), maliyyəyə (ödəniş), CRM-ə (müştəri borc/loyalty), bonus sisteminə (satıcı KPI) təsir göstərir.",
    necə_istifade: [
      "Satış → anbar stokunu endirir + maliyyə mədaxili + müştəri loyalty bonus",
      "Alış → anbar stoku artırır + maliyyə məxarici + maya yenilənmə",
      "Qaytarma → anbar geri + maliyyə qaytar + bonus düzəliş",
      "Nisyə satış → müştəri borc artır + təsdiq yoxlama",
      "Kupon satışda → kampaniya istifadəsi qeyd olunur",
      "Marketplace satış → 3-cü tərəf sifariş webhook-dan gəlir",
      "Satıcı KPI → bonus avtomat hesablanır (commission-actions)",
      "Audit log → bütün dəyişikliklər izlənir",
    ],
    vacib: [
      "Stok guard satışda 0-dan aşağı düşmür",
      "Discount approval limiti aşılırsa avto-təsdiq tələbi",
      "Customer credit limit yoxlanır nisyədə",
      "Müştəri tier (RFM) avtomatik yenilənir alışdan sonra",
    ],
    sehife_url: "/ticaret",
    iconKey: "Link2",
    achar_sozler: ["ticarət", "anbar", "maliyyə", "cross-module"],
  },

  // ── ANBAR ──
  {
    id: "anbar-ne",
    kateqoriya: "anbar",
    basliq: "Anbar modulu — 16 alt-bölmə bir yerdə",
    qisa: "Məhsul, stok, qiymət, satınalma, sayım, transfer, bron, anomaliya",
    nedir:
      "Anbar ERP-nin ən geniş modulu. 16 alt-bölmə var: Məhsullar, Stok, Qiymət siyahısı, Satınalma, Sayım (inventar), Transfer (anbarlar arası), Bron, Konsiqnasiya, Hesabatlar, Hərəkətlər, Kateqoriya, Marka, Anomaliya (AI), Etiket çapı, Excel yüklə. Hər biri ayrı icazə altında.",
    necə_istifade: [
      "/anbar — anbarın ümumi vəziyyəti (canlı dəyər, stok, problemlər)",
      "/anbar/mehsullar — məhsul kataloqu (axtarış, filter, yeni)",
      "/anbar/stok — anbar-anbar stok cədvəli",
      "/anbar/satinalma — alış planlaması və sənədləri",
      "/anbar/inventar — sayım sənədləri (fiziki yoxlama)",
      "/anbar/transfer — anbarlar arası mal hərəkəti",
      "/anbar/qiymet — qiymət siyahıları (toplu yeniləmə)",
      "/anbar/anomali — AI-əsaslı qeyri-adi hadisələr",
    ],
    vacib: [
      "Hər alt-bölmə öz icazəsi tələb edir (anbar.oxu master + spesifik)",
      "Stok endirmə yalnız satış/alış vasitəsilə (manual yalnız «stok.duzelis» icazəli)",
      "Anbar dəyəri 60s cache-li — RefreshButton ilə yenilə",
      "Aşağı stok aşkarı «kritik_stok» sahəsinə bağlıdır",
    ],
    sehife_url: "/anbar",
    iconKey: "Package",
    achar_sozler: ["anbar", "stok", "məhsul", "warehouse"],
  },
  {
    id: "anbar-mehsul",
    kateqoriya: "anbar",
    basliq: "Məhsul yaratma və idarəetmə",
    qisa: "ProductWizard ilə yeni məhsul, Excel toplu import",
    nedir:
      "Hər məhsulun: ad, kod, barkod, kateqoriya, marka, ölçü, şəkil, təsvir, qiymət (maya/min/satış), tax, partiya/seriya seçimləri. ProductWizard 3-addımlıq sehrbazdır. Toplu import üçün /anbar/mehsul-yukle (Excel şablon).",
    necə_istifade: [
      "/anbar → «Yeni məhsul» — ProductWizard",
      "1-ci addım: əsas (ad, kateqoriya, marka, barkod)",
      "2-ci addım: qiymət (maya, satış, min, tax)",
      "3-cü addım: opsiyalar (şəkil, təsvir, partiya, seriya)",
      "Yadda saxla — məhsul aktiv olub kataloqa düşür",
      "Toplu üçün /anbar/mehsul-yukle — Excel şablon yüklə",
    ],
    vacib: [
      "Barkod təkrarsız olmalıdır — sistem yoxlayır",
      "Maya qiyməti təyin edilmədikdə marja hesablanmır",
      "Şəkilsiz məhsul POS-da axtarışda zəif görünür",
      "İcazələr: mehsul.yarat / mehsul.duzelt / mehsul.sil / mehsul.yukle",
    ],
    sehife_url: "/anbar/mehsullar",
    iconKey: "Package",
    achar_sozler: ["məhsul", "wizard", "barkod", "excel", "import"],
  },
  {
    id: "anbar-satinalma",
    kateqoriya: "anbar",
    basliq: "Satınalma planlaşdırma və alış sənədi",
    qisa: "AI-əsaslı tövsiyə + təchizatçı sifarişi + qəbul",
    nedir:
      "/anbar/satinalma 3 tab: Planlaşdırma (hansı məhsul, nə qədər), Tövsiyə (AI-əsaslı alış siyahısı), Sənədlər (mövcud alış sənədləri). Aşağı stok / sürətli satılan məhsullar üçün avto-tövsiyə.",
    necə_istifade: [
      "/anbar/satinalma — Planlama tab açıq",
      "Cədvəldə hər məhsul üçün: cari stok, satış sürəti, tövsiyə miqdar",
      "Çoxlu seçim — «Sifariş yarat»",
      "Təchizatçı seç, gəlmə tarixi, qiymət",
      "Alış sənədi yaranır → təsdiqlənincə stoka düşmür",
      "Mal gələn kimi «Qəbul et» — stoka yazılır",
    ],
    vacib: [
      "Satınalma təsdiqi aktivdirsə sənəd təsdiqlənənə qədər stokda görünmür",
      "Alış qiyməti maya qiymətini avtomatik yeniləyir (varsa)",
      "İcazə: satinalma.oxu (görmə) + satinalma.yarat (yeni)",
      "AI tövsiyəsi /komekci?tab=biznes-də də mövcuddur",
    ],
    sehife_url: "/anbar/satinalma",
    iconKey: "ShoppingBag",
    achar_sozler: ["satınalma", "alış", "təchizatçı", "sifariş"],
  },
  {
    id: "anbar-inventar",
    kateqoriya: "anbar",
    basliq: "Sayım — fiziki stok yoxlanışı",
    qisa: "Anbar mövcud vəziyyət vs sistemə görə fərq",
    nedir:
      "/anbar/inventar — sayım sənədi yaradılır, kassir/anbardar barkod skan edib faktiki sayır. Sistem ilə fərq tapdıqda «düzəliş» avtomatik yaradılır. Tam sayım və ya seçilmiş kateqoriya/anbar üçün.",
    necə_istifade: [
      "/anbar/inventar — yeni sayım başlat",
      "Anbar seç, sayım növü (tam / qismən)",
      "Sayım səhifəsi açılır — hər məhsul üçün faktiki say",
      "Barkod skan ilə sürətli daxil et",
      "Tamamlandıqda fərqlər təsdiq olunur — sistem stoku yeniləyir",
      "Sayım tarixçəsi və auditə düşür",
    ],
    vacib: [
      "Sayım açıq olduqda həmin anbara satış/alış müvəqqəti dayanır (opsional)",
      "Fərq menecer təsdiqi tələb edə bilər",
      "İcazə: sayim.oxu + sayim.yarat",
      "Hesabat: /anbar/hereketler — bütün stok dəyişiklikləri",
    ],
    sehife_url: "/anbar/inventar",
    iconKey: "ClipboardCheck",
    achar_sozler: ["sayım", "inventar", "yoxlanış", "fərq"],
  },
  {
    id: "anbar-cross-module",
    kateqoriya: "anbar",
    basliq: "Anbar digər modullarla necə bağlanır?",
    qisa: "POS, Satış, Servis, Tapşırıq, Avtomat, Təsdiq, Dashboard",
    nedir:
      "Anbar ERP-nin nüvəsidir. Hər mal hərəkəti — alış, satış, qaytarma, transfer, sayım — stoka təsir edir. Hər modul birləşmiş şəkildə işləyir.",
    necə_istifade: [
      "POS satışı → anbar stokunu endirir (safeStockDecrement guard)",
      "Satınalma sənədi qəbul → stoku artırır",
      "Servis → ehtiyat hissələr stokdan götürülür",
      "Tapşırıq → məhsul tapşırığı (məs. «sayım başlat»)",
      "Avtomatlaşdırma → aşağı stok aşkarlandıqda alış tövsiyəsi",
      "Təsdiq → endirim/silinmə üçün sahibkar icazəsi",
      "Dashboard → aşağı stok, ölü stok kartları",
      "Hesabat → maya, satış dəyəri, marja, anomaliya",
    ],
    vacib: [
      "Negative stock guard — satış zamanı stoku 0-dan aşağı düşürmür",
      "Bron mexanizmi 48 saatlıq müvəqqəti rezerv yaradır",
      "Marketplace sync → stok dəyişikliyi 3-cü tərəf platforma da push olur",
    ],
    sehife_url: "/anbar",
    iconKey: "Link2",
    achar_sozler: ["anbar", "bağlılıq", "stok-pos", "stok-satis", "cross"],
  },

  // ── TAPŞIRIQLAR ──
  {
    id: "tapshiriq-ne",
    kateqoriya: "tapshiriq",
    basliq: "Tapşırıqlar modulu — necə işləyir?",
    qisa: "Şəxsi və komanda tapşırıqları — bütün modullarla bağlı",
    nedir:
      "Tapşırıqlar — ERP-də iş axınını idarə etmək üçün universal modul. Müştəri ilə zəng et, sənəd təsdiqlə, anbarı yoxla — hər bir iş tapşırıq kimi izlənə bilər. Hər tapşırığa: mesul, icraçılar, prioritet, deadline, xatırlatma, yarımtapşırıqlar (checklist), şərhlər, fayllar, eskalasiya. Layihə ilə qruplaşdırmaq olur.",
    necə_istifade: [
      "/tapshiriqlar — bütün tapşırıqlar (filter ilə)",
      "3 görünüş: Siyahı / Kanban (drag-drop) / Təqvim",
      "Yuxarı KPI strip: açıq / gecikmiş / bu gün / bu həftə",
      "«Yeni tapşırıq» — başlıq, mesul, deadline, prioritet, checklist",
      "Sürətli əlavə bar — bir sətirdə yarad (default mesul: özü)",
      "Şablonlar — təkrarlanan tapşırıqlar üçün",
      "Pomodoro timer — fokus üçün yan-yana",
    ],
    vacib: [
      "Hər kəs öz tapşırığını görür (tapshiriq.oxu)",
      "Yaratmaq üçün `tapshiriq.yarat`, başqasına atamaq üçün `tapshiriq.atayir`",
      "Tapşırıq başqa modullara bağlana bilər (obyekt_nov + obyekt_id)",
      "Xatırlatma vaxtı gəldikdə Telegram bildirişi gedir (konfiqurasiya varsa)",
      "Eskalasiya: gecikmiş tapşırıq → menecerin diqqətinə",
    ],
    sehife_url: "/tapshiriqlar",
    iconKey: "ListTodo",
    achar_sozler: ["tapşırıq", "iş", "todo", "task", "kanban", "deadline"],
  },
  {
    id: "tapshiriq-icazeler",
    kateqoriya: "tapshiriq",
    basliq: "Tapşırıq icazələri — kim nə edə bilir?",
    qisa: "8 icazə — oxu, yarat, atayar, statistika, AI, şablon, sil",
    nedir:
      "Tapşırıqlar üçün 8 ayrı icazə: oxu (master), yarat, başqasına atamak, layihə görünüşü, komanda statistikası, AI analiz, şablon idarəsi, tam silmə. Server-side enforced — UI-də gizlətmək yetmir.",
    necə_istifade: [
      "/ayarlar/rollar — rolu seç, «Tapşırıqlar» modulu aç",
      "tapshiriq.oxu — master (default hamı)",
      "tapshiriq.yarat — yeni tapşırıq",
      "tapshiriq.atayir — başqa əməkdaşa təyin",
      "tapshiriq.layihe — /tapshiriqlar/layihe",
      "tapshiriq.statistika — komanda performansı",
      "tapshiriq.ai_analiz — /tapshiriqlar/ai-analiz",
      "tapshiriq.sablon — şablon dəyişdir/sil",
      "tapshiriq.silsin — DB-dən tam silmək (ləğv etmək deyil)",
    ],
    vacib: [
      "Adi əməkdaş: oxu + yarat (özünə)",
      "Menecer: + atayar + layihə + statistika",
      "Sahibkar/admin: hamısı",
      "İcazəsizsə server action xəta qaytarır: «Bu əməliyyat üçün ... icazəsi lazımdır»",
    ],
    sehife_url: "/ayarlar/rollar",
    iconKey: "ShieldCheck",
    achar_sozler: ["icazə", "tapşırıq", "rol", "permission"],
  },
  {
    id: "tapshiriq-cross-module",
    kateqoriya: "tapshiriq",
    basliq: "Tapşırıqlar digər modullarla necə bağlanır?",
    qisa: "Müştəri profilinə, sənədə, satışa tapşırıq əlavə et",
    nedir:
      "Hər tapşırıq başqa modulun obyektinə bağlana bilər — müştəri kartı, satış sənədi, sənəd, məhsul, servis. Açdığın profil/sənəddə həmin obyekt üçün açıq tapşırıqlar widget kimi görünür. Bu cross-module bağlılıqdır.",
    necə_istifade: [
      "Müştəri profilində «Yeni tapşırıq» — zəng, görüş, borc yığ",
      "Satış detalında «Tapşırıq əlavə et» — qaytarma, yoxlama",
      "Servis kartında «Təmir yoxla», «Müştərini xəbərdar et»",
      "Anbarda «Mal sayımı», «Yenidən qiymətlə»",
      "Sənəddə «Təsdiq et», «İmza al»",
      "Tapşırıq detalına klik etdikdə → həmin obyektin profilinə qaytaran link",
    ],
    vacib: [
      "obyekt_nov + obyekt_id sahələri DB-də saxlanır",
      "Obyekt silinsə tapşırıq qalır amma link sınır",
      "LinkedTasksWidget hər səhifədə eyni kompinent",
      "Filter: obyekt_nov=musteri → yalnız müştəri ilə bağlı tapşırıqlar",
    ],
    sehife_url: "/tapshiriqlar",
    iconKey: "Link2",
    achar_sozler: ["bağlantı", "cross-module", "obyekt", "müştəri tapşırığı"],
  },
  {
    id: "tapshiriq-sablon",
    kateqoriya: "tapshiriq",
    basliq: "Şablonlar — təkrarlanan tapşırıqlar avtomatik yaransın",
    qisa: "Hər gün/həftə/ay təkrarlanan işləri 1 dəfə qur",
    nedir:
      "Şablon — qabaqcadan hazırlanmış tapşırıq qaydası. Məsələn «Hər gün saat 09:00-da kassa yoxla» və ya «Hər həftə cümə təchizatçıya zəng». Sistem həmin vaxt gələndə avtomatik tapşırıq yaradır və müvafiq əməkdaşa atayır. Sistemdə default 25+ hazır şablon var.",
    necə_istifade: [
      "/tapshiriqlar/sablonlar — kateqoriya üzrə: günlük, həftəlik, aylıq, onboarding, ad-hoc",
      "Şablon kartına klik — preview + «İndi yarat»",
      "Şablondan tapşırıq yaradıldıqda standart sahələr (başlıq, prioritet, deadline) öncədən dolur",
      "Şablon ad-hoc — eyni növ tapşırıqları sürətli yaratmaq",
      "Sahibkar/admin yeni şablon əlavə edə bilər (tapshiriq.sablon)",
    ],
    vacib: [
      "Hazır şablonlar `templates.ts`-də sabitdir",
      "Şablon dəyişikliyi mövcud tapşırıqlara təsir etmir",
      "Onboarding şablonları yeni əməkdaş üçün avtomatik tətbiq olunur (gələcək feature)",
    ],
    sehife_url: "/tapshiriqlar/sablonlar",
    iconKey: "FileText",
    achar_sozler: ["şablon", "template", "təkrarlanan", "günlük", "onboarding"],
  },

  // ── NƏZARƏT MƏRKƏZİ ──
  {
    id: "nezaret-ne",
    kateqoriya: "nezaret",
    basliq: "Nəzarət Mərkəzi nədir?",
    qisa: "Risk, xəbərdarlıq və təsdiqlərin bir-yerdə komanda mərkəzi",
    nedir:
      "Nəzarət Mərkəzi — sahibkar üçün biznesin sağlamlıq mərkəzidir. Bütün modullardan gələn risk siqnallarını (stok bitir, müştəri borcu artır, işçi gecikir, sənəd təsdiq gözləyir, avtomat qayda xəta verdi) bir səhifədə toplayır. 3 əsas hissə: Xəbərdarlıqlar (məlumat), Təsdiqlər (icazə gözləyən), Qaydalar (avtomat).",
    necə_istifade: [
      "/nezaret-merkezi — risk dashboard açılır",
      "Yuxarı: 3 izah kart — Qaydalar, Xəbərdarlıqlar, Təsdiqlər",
      "Ortada: 4 böyük rəqəm (aktiv xəbərdarlıq, təsdiq gözləyən, aktiv qayda, bu gün həll)",
      "Sonra: 8 detallı tile (tapşırıq, stok, borc, davamiyyət, servis, marketplace, 24 saat, bu gün)",
      "Aşağıda: ən riskli kateqoriyalar + təkrarlanan problemlər",
      "Loglar tab → bütün avtomat / təsdiq / xəbərdarlıq tarixçəsi",
      "Ayarlar tab → 12-yə yaxın avtomat qaydanın həddləri",
    ],
    vacib: [
      "Səhifə icazə tələb edir — `nezaret.oxu` master, alt: `dashboard / loglar / ayarlar`",
      "Default sahibkar / admin / direktor görür, mühasib / menecer yalnız oxu",
      "Rəqəmlər canlı — hər səhifə açılışında yenilənir",
      "Tile-ə klik etdikdə birbaşa müvafiq səhifəyə yönləndirir (filter ilə)",
    ],
    sehife_url: "/nezaret-merkezi",
    iconKey: "ShieldAlert",
    achar_sozler: ["nəzarət", "risk", "dashboard", "control", "audit"],
  },
  {
    id: "nezaret-loglar",
    kateqoriya: "nezaret",
    basliq: "Audit loglar — kim, nə vaxt, nə etdi?",
    qisa: "Bütün avtomat / təsdiq / xəbərdarlıq tarixçəsi birləşmiş şəkildə",
    nedir:
      "Nəzarət Mərkəzi → Loglar tab — sistemdə baş vermiş bütün hadisələrin (avtomat qayda işlədi, təsdiq verildi, xəbərdarlıq yarandı/həll oldu) zaman ardıcıllığı ilə siyahısı. Hər hadisə üçün: nə vaxt, kim, hansı qayda, nəticə (uğurlu/xəta), parametrlər.",
    necə_istifade: [
      "/nezaret-merkezi/loglar — birləşdirilmiş tarixçə",
      "Source filter: Avtomatlaşdırma / Təsdiq / Xəbərdarlıq",
      "Status filter: ok / xəta",
      "Axtarış — istifadəçi adı, qayda kodu",
      "Tarix sıralanmış (yenidən köhnəyə)",
    ],
    vacib: [
      "Loglar oxunan olduğu üçün heç vaxt silinmir — audit izi qalır",
      "Eyni dəqiqədə baş verən hadisələr saniyə dəqiqliyi ilə ardıcıllaşır",
      "`nezaret.loglar` icazəsi tələb olunur",
    ],
    sehife_url: "/nezaret-merkezi/loglar",
    iconKey: "History",
    achar_sozler: ["log", "audit", "tarixçə", "izləmə", "kim etdi"],
  },
  {
    id: "nezaret-ayarlar",
    kateqoriya: "nezaret",
    basliq: "Avtomat qaydaların həddləri — nə zaman təsdiq tələb etsin?",
    qisa: "Endirim, qaytarma, silmə, borc — limitlərin tənzimlənməsi",
    nedir:
      "Ayarlar tab — 10-dan çox avtomat qaydanın hadisə həddini buradan tənzimləyirsən. Məsələn: endirim 20%-dən çox olduqda təsdiq tələb et, qaytarma 100 ₼-dan yuxarı menecer baxsın, sənəd silinməsi sahibkar icazəsi olmadan icra edilməsin və s.",
    necə_istifade: [
      "/nezaret-merkezi/ayarlar — qayda siyahısı",
      "Hər qayda üçün: Aktiv/Passiv toggle + threshold rəqəmi",
      "Kritik dəyər (qaydadan artıq) — daha sərt davranış",
      "Dəyişiklik dərhal qüvvədədir — yeniləmə tələb olunmur",
      "«Defaultlara qaytar» — bütün ayarları başlanğıc dəyərə qaytarır",
    ],
    vacib: [
      "Yalnız sahibkar / admin dəyişə bilir (`nezaret.ayarlar` icazəsi)",
      "Aktiv olmayan qayda heç vaxt işləmir",
      "Threshold 0 olarsa hər hadisə təsdiq tələb edir",
      "Dəyişikliklər audit log-a düşür",
    ],
    sehife_url: "/nezaret-merkezi/ayarlar",
    iconKey: "Settings",
    achar_sozler: ["həd", "limit", "threshold", "qayda", "ayar"],
  },

  // ── POS / KASSA ──
  {
    id: "pos-ne",
    kateqoriya: "pos",
    basliq: "POS nədir? Sürətli kassa satışı necə işləyir?",
    qisa: "İsti satış ekranı — barkod skan, sürətli ödəniş, çek çapı",
    nedir:
      "POS (Point of Sale) — kassir-yönlü, sürətli satış üçün xüsusi ekrandır. Sənəd dolduran formul yerinə: barkod skan et → məhsul səbətə düşür → ödəniş seç → təsdiqlə. Hər satış stoku endirir, kassanı artırır, hesabatlara düşür.",
    necə_istifade: [
      "/pos — yeni tab-da açılır (POS layout sidebar olmadan tam ekran)",
      "Əvvəlcə kassa sessiyası açılır (filial seç, açılış qalığı)",
      "Sol panel: məhsul axtar / barkod skan / sürətli məhsullar",
      "Sağ panel: səbət, müştəri, endirim, ödəniş",
      "Ödəniş növü: Nağd / Kart / Köçürmə / Nisyə",
      "Loyalty kart skan et — bonusla ödə",
      "Endirim kodu yaz — kupon endirimi tətbiq",
      "«Təsdiqlə» — satış tamamlanır, çek çıxır",
    ],
    vacib: [
      "Sessiya açmadan satış mümkün deyil",
      "Stokda olmayan məhsul satıla bilməz (negative stock guard)",
      "Nisyə satış borc limitini yoxlayır — keçilirsə menecer override",
      "Çek çapı kassir avtomatik (default printer)",
      "Park edilmiş satış localStorage-da saxlanılır — restart-dan sonra dəvam etdirə bilərsən",
    ],
    sehife_url: "/pos",
    iconKey: "ScanLine",
    achar_sozler: ["pos", "kassa", "satış", "barkod", "çek", "isti satış"],
  },
  {
    id: "pos-icazeler",
    kateqoriya: "pos",
    basliq: "POS icazələri — kim nəyi edə bilir?",
    qisa: "13 icazə — kassirə nəyi göstər/gizlət, nəyə icazə ver",
    nedir:
      "POS-da rol əsaslı icazələr var. Hər kassirə fərqli səlahiyyət vermək olur: qiymət dəyişdirə bilərmi, maya görə bilərmi, nisyə sata bilərmi və s. Bütün icazələr `pos.X` kodlu və «POS / Kassa» qrupundadır.",
    necə_istifade: [
      "/ayarlar/rollar səhifəsindən rolu aç",
      "«POS / Kassa» modulunu genişləndir",
      "pos.access — POS-u aça bilmək (master)",
      "pos.satis — satışı təsdiq edə bilmək",
      "pos.session_open / pos.session_close — sessiya idarə",
      "pos.change_price — qiymət dəyişdir",
      "pos.discount — endirim et",
      "pos.view_cost / pos.view_margin / pos.view_min_price — qiymət görüntüləmə",
      "pos.credit_sell — nisyə satış",
      "pos.print_receipt / pos.print_warranty — çap",
    ],
    vacib: [
      "Sahibkar / admin rollarına bütün POS icazələri avtomatik verilir",
      "İcazə server-side də yoxlanır — UI-də gizlətmək yetmir",
      "Yeni icazələri DB-yə əlavə etmək üçün `scripts/migrations/2026-06-01-pos-permissions.sql` migration-u tətbiq edin",
    ],
    sehife_url: "/ayarlar/rollar",
    iconKey: "ShieldCheck",
    achar_sozler: ["pos", "icazə", "rol", "kassir", "permission"],
  },
  {
    id: "pos-sessiya",
    kateqoriya: "pos",
    basliq: "Kassa sessiyası — açılış, bağlanış, gün sonu",
    qisa: "Hər kassir günə açılışla başlayır, gün sonu fərq hesablanır",
    nedir:
      "Kassa sessiyası — kassiri hesabatlandırmaq üçün istifadə olunan vaxt blokudur. Açılışda: kassada nə qədər pul var (açılış qalığı). Bağlanışda: kassada faktiki nə qədər var, satışdan nə qədər gəldi, fərq varmı.",
    necə_istifade: [
      "POS açılışı zamanı «Sessiya aç» — filial seç, açılış qalığı daxil et",
      "Sessiya boyu hər satış cari nağd/kart/bank/borc qalığına əlavə olunur",
      "Gün sonu: «Sessiyanı bağla» — faktiki nağd say, sistemə daxil et",
      "Sistem fərqi hesablayır — overage / shortage qeyd olunur",
      "Gün sonu hesabatı çap oluna bilər",
    ],
    vacib: [
      "Sessiya bağlanmasa növbəti gün açıla bilməz",
      "Açılış qalığı yanlış olduqda gün sonu fərqi səhv görünür",
      "Birdən çox kassir eyni filialda işləyirsə hər biri öz sessiyasını açır",
      "Bağlanmış sessiyanı «yenidən aç» yalnız sahibkar edə bilər",
    ],
    sehife_url: "/pos",
    iconKey: "DoorOpen",
    achar_sozler: ["sessiya", "kassa açılışı", "gün sonu", "açılış qalığı"],
  },
  {
    id: "pos-park",
    kateqoriya: "pos",
    basliq: "Park edilmiş satış — yarımçıq səbəti saxla",
    qisa: "Müştəri «bir az fikirləşim» dedikdə səbəti park et, sonra qayıt",
    nedir:
      "Bəzən müştəri bir məhsul üçün dayanır, başqa kassiri açıq saxlamaq lazımdır. «Park et» düyməsi cari səbəti localStorage-da saxlayır, kassir digər müştərini götürə bilər. Sonra parkdan səbəti qaytarmaq olur.",
    necə_istifade: [
      "Səbətin yuxarısında «Park et» düyməsi (saxlanılan səbət sayı)",
      "Park edilmiş səbət — qısa təsvirlə (məbləğ, sətr sayı) görünür",
      "Klik et — səbət bərpa olunur, müştəri də qaytarılır",
      "İstifadəçilər arası paylaşılmır — yalnız brauzer/cihazda saxlanılır",
    ],
    vacib: [
      "localStorage-da saxlanılır — brauzeri təmizləyəndə itir",
      "Park edilmiş səbət stokda hələ rezerv etmir",
      "Bir cihazda max 10 səbət saxlana bilər",
    ],
    sehife_url: "/pos",
    iconKey: "Parking",
    achar_sozler: ["park", "saxla", "səbət", "yarımçıq"],
  },
  {
    id: "pos-loyalty-kupon",
    kateqoriya: "pos",
    basliq: "POS-da Loyalty kart və kupon kod istifadəsi",
    qisa: "Müştəri kartı oxudub bonusla ödə + endirim kodu yaz",
    nedir:
      "POS-da satışı 3 cür endirə bilərsən: (1) sətir/səbət endirim faizi, (2) müştərinin loyalty bonusunu sərf et, (3) müştəri kuponu/promokod yaz. Üçü də eyni satışda eyni vaxtda işləyir — endirim ardıcıllığı: səbət-endirim → kupon → bonus.",
    necə_istifade: [
      "Müştəri seç (axtarış və ya yeni)",
      "Müştərinin loyalty kartı varsa «Bonus ilə öde» panelində balans görünür",
      "İstədiyin məbləği bonus kimi sərf et",
      "«Endirim kodu (opsional)» sahəsinə müştərinin promokodu yaz",
      "Səbət cəmindən kupon endirimi avtomatik çıxılır",
      "Final hesab: ümumi − səbət endirimi − kupon − bonus",
    ],
    vacib: [
      "Bonus sərfi max səbət cəminin 30%-i (sahibkar ayarında dəyişir)",
      "Min bonus istifadə məbləği 5 ₼ (default)",
      "Kupon və bonus eyni satışda işləyə bilər",
      "Loyalty kart avtomatik olaraq yeni müştəri yaradılanda açılır",
    ],
    sehife_url: "/kampaniyalar",
    iconKey: "Sparkles",
    achar_sozler: ["loyalty", "bonus", "kupon", "kod", "endirim", "promokod"],
  },
];
