/**
 * İcazə kodundan kontekstli izahat çıxarır:
 *   - "Söndürüləndə" hansı funksiya bağlanır
 *   - Tövsiyə (kimə veriləndir)
 *
 * DB-dəki `aciqlamaq` əvvəlcə istifadə olunur; yoxdursa kod patternindən derive olunur.
 * Belə kodlar üçün: `<resource>.<action>` (məs. `satis.view`, `product.create`).
 */

const ACTION_OFF_TEXT: Record<string, string> = {
  // CRUD
  view: "siyahını / detalı görə bilməyəcək",
  oxu: "siyahını / detalı görə bilməyəcək",
  gor: "siyahını / detalı görə bilməyəcək",
  create: "yeni qeyd əlavə edə bilməyəcək",
  add: "yeni qeyd əlavə edə bilməyəcək",
  edit: "mövcud qeydi redaktə edə bilməyəcək",
  update: "mövcud qeydi redaktə edə bilməyəcək",
  delete: "qeydi silə bilməyəcək",
  deactivate: "qeydi deaktivləşdirə bilməyəcək",
  legv: "qeydi ləğv edə bilməyəcək",
  cancel: "qeydi ləğv edə bilməyəcək",
  // Workflow
  approve: "təsdiq verə bilməyəcək",
  tesdiq: "təsdiq verə bilməyəcək",
  reject: "rədd edə bilməyəcək",
  send: "göndərə bilməyəcək",
  gonder: "göndərə bilməyəcək",
  export: "Excel/CSV ixrac edə bilməyəcək",
  import: "Excel/CSV idxal edə bilməyəcək",
  print: "çap edə bilməyəcək",
  // Management umbrella
  idare: "bütün altəməliyyatları edə bilməyəcək",
  manage: "tam idarəetmə hüququ olmayacaq",
  // Money sensitive
  change_price: "qiyməti dəyişdirə bilməyəcək",
  change_cost: "maya qiymətini dəyişdirə bilməyəcək",
  view_cost: "maya qiymətini görə bilməyəcək",
  view_profit: "mənfəəti görə bilməyəcək",
  endirim: "endirim tətbiq edə bilməyəcək",
  refund: "geri qaytarma edə bilməyəcək",
  qaytarma: "geri qaytarma edə bilməyəcək",
  // Audit
  audit: "audit log-u görə bilməyəcək",
  view_audit: "audit log-u görə bilməyəcək",
  // Roles
  reset_password: "parol sıfırlaya bilməyəcək",
  bonus_idare: "bonus qaydalarını dəyişdirə bilməyəcək",
};

const RESOURCE_LABEL: Record<string, string> = {
  satis: "satış",
  alis: "alış",
  product: "məhsul",
  mehsul: "məhsul",
  stok: "stok",
  anbar: "anbar",
  transfer: "anbarlar arası transfer",
  inventar: "inventarizasiya",
  serial: "seriya nömrəsi",
  kassa: "kassa",
  cek: "çek",
  odenis: "ödəniş",
  vergi: "vergi kassası",
  qaime: "qaimə",
  borc: "borc / ödəniş tarixçəsi",
  maliyye: "maliyyə",
  xerc: "xərc",
  bank: "bank əməliyyatları",
  hesab: "hesablar",
  hesabat: "hesabatlar",
  kpi: "KPI",
  musteri: "müştəri",
  kontragent: "kontragent",
  catdirma: "çatdırma",
  xerite: "xəritə",
  servis: "servis",
  tapshiriqlar: "tapşırıqlar",
  tapshiriq: "tapşırıqlar",
  istifadeci: "istifadəçi",
  rol: "rol",
  icaze: "icazə",
  ayar: "tənzimləmə",
  audit: "audit log",
  backup: "backup",
  abune: "abunə",
  ip: "IP",
  sablon: "şablon",
  ai: "AI mərkəz",
  ai_advisor: "AI məsləhətçi",
  alish_plan: "satınalma planı",
  dashboard: "dashboard",
  marketplace: "marketplace",
  webhook: "webhook",
  inteqrasiya: "inteqrasiya",
  qiymet: "qiymət siyahısı",
  qiymet_tipi: "qiymət tipi",
  qiymet_kanal: "qiymət kanalı",
  gizli: "gizli məlumat",
  filial: "filial",
  team: "team / söhbət",
  crm: "CRM mərkəz",
  bonus: "bonus",
  inbox: "inbox",
  lab: "360 LAB",
};

/**
 * Konkret icazə kodları üçün xüsusi mətnlər (override).
 * Burda olmayan kodlar üçün resource+action patternindən avtomatik derive olunur.
 */
const SPECIAL_OVERRIDES: Record<string, { whenOn?: string; whenOff: string }> = {
  // Dashboard
  "dashboard.oxu": {
    whenOn: "Master icazə — /dashboard səhifəsinə girişə imkan verir. Bu icazə yoxdursa, digər dashboard.* alt-icazələr işləmir.",
    whenOff: "Əməkdaş /dashboard səhifəsini aça bilməyəcək — sidebar-da Dashboard görünməyəcək, URL-ə daxil olsa /tapshiriqlar-a yönləndiriləcək.",
  },
  "dashboard.kpi": { whenOff: "Aylıq gəlir/xərc/mənfəət big-card və 3 KPI sətri dashboard-da görünməyəcək." },
  "dashboard.cashflow": { whenOff: "Dashboard-da bu gün pul axını kartı (mədaxil/məxaric/net + barlar) görünməyəcək." },
  "dashboard.tapshiriq": { whenOff: "Dashboard-da «Mənim işim» kartı (effektivlik ringi + 3 stat + növbəti tapşırıqlar) görünməyəcək." },
  "dashboard.aktivlik": { whenOff: "Dashboard-da «Son 5 satış» və «Canlı hadisələr» kartları görünməyəcək." },
  "dashboard.stok": { whenOff: "Dashboard-da aşağı stok paneli (kritik məhsullar siyahısı) görünməyəcək." },
  "dashboard.top5": { whenOff: "Dashboard-da «Top 5» reytinqləri (məhsul/satıcı/alıcı/platforma) görünməyəcək." },
  "dashboard.alerts": { whenOff: "Dashboard-da «Diqqət lazımdır» kritik xəbərdarlıqlar banneri görünməyəcək." },
  "dashboard.sync": { whenOff: "Dashboard-da marketplace sync sağlamlıq paneli görünməyəcək." },
  "dashboard.charts": { whenOff: "Dashboard-da 30 günlük satış qrafiki və satış vs xərc müqayisəsi görünməyəcək." },
  "dashboard.feed": { whenOff: "Dashboard-da geniş biznes fəaliyyət feed-i görünməyəcək." },
  "dashboard.insight": { whenOff: "Dashboard-un ən üstündə günün rəngli analitik mesajı görünməyəcək." },

  // POS / Kassa
  "pos.access": {
    whenOn: "Master icazə — /pos səhifəsinə girişə imkan verir. Bu icazə yoxdursa, kassir POS-u aça bilmir.",
    whenOff: "Əməkdaş /pos səhifəsini aça bilməyəcək — sidebar-da POS görünməyəcək, URL-ə daxil olsa giriş rədd ediləcək.",
  },
  "pos.satis": {
    whenOff: "Əməkdaş POS-da məhsulu səbətə əlavə edə bilər, amma «Satışı təsdiqlə» düyməsi işləməyəcək — server action rədd edəcək.",
  },
  "pos.change_price": {
    whenOn: "Kassir POS-da hər sətrin qiymətini əl ilə dəyişə bilir (məs. fərdi razılaşma).",
    whenOff: "Qiymət sahəsi readonly olur — kassir yalnız sistem qiymətini istifadə edə bilər.",
  },
  "pos.sell_below_min_price": {
    whenOff: "Kassir məhsulu minimum qiymətdən aşağı satmağa cəhd etdikdə server xəta qaytarır.",
  },
  "pos.discount": {
    whenOff: "Səbət / sətir endirim sahələri görünmür və ya readonly olur.",
  },
  "pos.view_cost": {
    whenOff: "POS-da məhsul kartında maya (alış) qiyməti görünmür — yalnız satış qiyməti.",
  },
  "pos.view_margin": {
    whenOff: "POS-da real-time marja % göstərici sətrində 0 görünür — kassir gəliri bilmir.",
  },
  "pos.view_min_price": {
    whenOff: "POS-da məhsul kartında min satış qiyməti gizlənir.",
  },
  "pos.print_receipt": {
    whenOff: "Satışdan sonra çek çapı düyməsi görünməyəcək / işləməyəcək.",
  },
  "pos.print_warranty": {
    whenOff: "Zəmanət sənədi çapı düyməsi görünməyəcək.",
  },
  "pos.credit_sell": {
    whenOff: "Ödəniş növləri arasında «Nisyə» seçimi blok olur — kassir borca sata bilmir.",
  },
  "pos.session_open": {
    whenOff: "Kassir kassa sessiyasını aça bilməz — yalnız menecer / admin aça bilir.",
  },
  "pos.session_close": {
    whenOff: "Kassir kassa sessiyasını bağlaya bilməz — yalnız menecer / admin bağlaya bilir.",
  },

  // Nəzarət Mərkəzi
  "nezaret.oxu": {
    whenOn: "Master icazə — /nezaret-merkezi səhifələrinə girişə imkan verir. Risk dashboard, xəbərdarlıqlar, təsdiqlər, audit log görünür.",
    whenOff: "Əməkdaş /nezaret-merkezi səhifəsini aça bilmir — sidebar-da Nəzarət Mərkəzi gizlədilir.",
  },
  "nezaret.dashboard": {
    whenOff: "Risk dashboard (aktiv xəbərdarlıq, təsdiq, stok riski və s. ümumi vəziyyət) görünmür.",
  },
  "nezaret.loglar": {
    whenOff: "Birləşdirilmiş audit log (xəbərdarlıq + təsdiq tarixçəsi) görünmür.",
  },
  "nezaret.ayarlar": {
    whenOff: "Nəzarət mərkəzi ayarları (avtomat qaydalar, eskalasiya, default davranış) dəyişdirilə bilmir.",
  },

  // Tapşırıqlar
  "tapshiriq.oxu": {
    whenOn: "Master icazə — /tapshiriqlar səhifəsinə girişə imkan verir. Hər kəs öz tapşırıqlarını görür.",
    whenOff: "Əməkdaş /tapshiriqlar səhifəsini aça bilmir — sidebar-da Tapşırıqlar görünmür.",
  },
  "tapshiriq.yarat": {
    whenOff: "«Yeni tapşırıq» düyməsi gizlənir — əməkdaş özünə də tapşırıq yarada bilmir.",
  },
  "tapshiriq.atayir": {
    whenOff: "Tapşırıq yaradanda başqa əməkdaşa təyin edə bilmir — yalnız özünə yarada bilir.",
  },
  "tapshiriq.layihe": {
    whenOff: "/tapshiriqlar/layihe (layihələr görünüşü) açılmır — layihə → tapşırıq qruplama icazəlidir.",
  },
  "tapshiriq.statistika": {
    whenOff: "/tapshiriqlar/statistika (komanda performansı) açılmır — yalnız öz statistikasını görür.",
  },
  "tapshiriq.ai_analiz": {
    whenOff: "/tapshiriqlar/ai-analiz (AI tapşırıq analitikası) açılmır — əməkdaşa AI analiz təklif edilmir.",
  },
  "tapshiriq.sablon": {
    whenOff: "/tapshiriqlar/sablonlar — şablon yaratmaq/dəyişdirmək / silmək olmur.",
  },
  "tapshiriq.silsin": {
    whenOff: "Tapşırığı tam silmək olmur — yalnız «ləğv» statusuna keçirmək olur (sənəd qalır).",
  },

  // Anbar
  "anbar.oxu": {
    whenOn: "Master icazə — /anbar səhifələrinə girişə imkan verir. Məhsul, stok, qiymət, kateqoriya görünür.",
    whenOff: "Əməkdaş /anbar səhifəsini aça bilmir — sidebar-da Anbar gizlədilir.",
  },
  "mehsul.oxu": {
    whenOff: "Məhsul siyahısı görünmür — POS-da məhsul axtarışı belə işləməyə bilər.",
  },
  "mehsul.yarat": {
    whenOff: "«Yeni məhsul» düyməsi gizlənir — ProductWizard açılmır.",
  },
  "mehsul.duzelt": {
    whenOff: "Məhsul kartında redaktə düyməsi gizlənir — qiymət, kateqoriya, şəkil dəyişdirilmir.",
  },
  "mehsul.sil": {
    whenOff: "Məhsulu silmək / arxivləmək olmur — yalnız sahibkar/admin.",
  },
  "mehsul.yukle": {
    whenOff: "/anbar/mehsul-yukle (Excel import) açılmır — toplu məhsul əlavə edilmir.",
  },
  "stok.oxu": {
    whenOff: "/anbar/stok cədvəli görünmür — hansı anbarda nə qədər var bilinmir.",
  },
  "stok.duzelis": {
    whenOff: "Stok manual artırma/azaltma («düzəliş») düyməsi gizlənir — yalnız satış/alış stoku dəyişə bilər.",
  },
  "stok.transfer": {
    whenOff: "/anbar/transfer açılmır — anbarlar arası mal hərəkəti edilmir.",
  },
  "stok.bron": {
    whenOff: "/anbar/bron açılmır — müştəri üçün stok rezervi edilmir.",
  },
  "satinalma.oxu": {
    whenOff: "/anbar/satinalma açılmır — alış sənədləri görünmür.",
  },
  "satinalma.yarat": {
    whenOff: "Yeni alış sənədi yaratmaq olmur — yalnız oxu rejimi.",
  },
  "sayim.oxu": {
    whenOff: "/anbar/inventar açılmır — sayım sənədləri görünmür.",
  },
  "sayim.yarat": {
    whenOff: "Yeni sayım başlatmaq olmur — faktiki stok yoxlanışı edilmir.",
  },
  "qiymet.oxu": {
    whenOff: "/anbar/qiymet açılmır — qiymət siyahıları görünmür.",
  },
  "qiymet.duzelt": {
    whenOff: "Qiymət dəyişdirmək olmur — bulk qiymət yeniləməsi bloklanır.",
  },
  "kateqoriya.idare": {
    whenOff: "/anbar/kateqoriyalar, /anbar/markalar redaktə açılmır — yeni kateqoriya/marka əlavə edilmir.",
  },
  "konsiqnasiya.oxu": {
    whenOff: "/anbar/konsiqnasiya açılmır — komissiya satışı izlənmir.",
  },
  "anbar.hesabat": {
    whenOff: "/anbar/hesabat və /anbar/hereketler açılmır — analitika icazəli rollar üçündür.",
  },
  "anbar.anomali": {
    whenOff: "/anbar/anomali (AI anomaliya aşkarı) açılmır.",
  },

  // Ticarət
  "ticaret.oxu": {
    whenOn: "Master icazə — /ticaret səhifələrinə girişə imkan verir.",
    whenOff: "Əməkdaş /ticaret səhifəsini aça bilmir — sidebar-da Ticarət gizlədilir.",
  },
  "satis.oxu": {
    whenOff: "/ticaret/satislar siyahısı görünmür — satış sənədlərini izləyə bilməz.",
  },
  "satis.yarat": {
    whenOff: "/ticaret/satis-yeni açılmır — formal satış sənədi yaratmaq olmur.",
  },
  "satis.duzelt": {
    whenOff: "Satış sənədini redaktə etmək olmur — qaralama belə dəyişdirilmir.",
  },
  "satis.legv": {
    whenOff: "Satış sənədini ləğv etmək olmur — yalnız sahibkar/admin.",
  },
  "alis.oxu": {
    whenOff: "/ticaret/alislar (alış sənədləri) açılmır.",
  },
  "alis.yarat": {
    whenOff: "Yeni alış sənədi yaratmaq olmur — yalnız oxu.",
  },
  "qaytarma.oxu": {
    whenOff: "/ticaret/qaytarma açılmır — qaytarma sənədlərini görmür.",
  },
  "qaytarma.yarat": {
    whenOff: "Yeni qaytarma sənədi yaratmaq olmur — müştəri pulu geri alınmır.",
  },
  "teklif.oxu": {
    whenOff: "/ticaret/teklif (kommersial təkliflər) açılmır.",
  },
  "teklif.yarat": {
    whenOff: "Yeni kommersial təklif yaratmaq olmur — müştəriyə qiymət təklifi göndərmir.",
  },
  "pipeline.oxu": {
    whenOff: "/ticaret/pipeline (satış pipeline / lead izi) açılmır.",
  },
  "kredit.oxu": {
    whenOff: "/ticaret/kredit (taksit / kredit izi) açılmır.",
  },
  "kredit.yarat": {
    whenOff: "Yeni taksit sənədi açmaq olmur — müştəri kredit ala bilmir.",
  },
  "market.oxu": {
    whenOff: "/ticaret/market-satis (marketplace sifarişləri) açılmır.",
  },

  // Maliyyə
  "maliyye.oxu": {
    whenOn: "Master icazə — /maliyye səhifələrinə girişə imkan verir.",
    whenOff: "Əməkdaş /maliyye səhifəsini aça bilmir — sidebar-da Maliyyə gizlədilir.",
  },
  "kassa.oxu": {
    whenOff: "Kassalar və qalıqlar görünmür — /maliyye/kassalar bağlıdır.",
  },
  "kassa.emeliyyat": {
    whenOff: "Yeni kassa yarat / sil / qalıqları dəyişdirmək olmur.",
  },
  "bank.oxu": {
    whenOff: "/maliyye/bank açılmır — bank hesabları və əməliyyatları görünmür.",
  },
  "bank.emeliyyat": {
    whenOff: "Bank hesabı əlavə et / silsin / sinxronlaşma — sahibkar tələblidir.",
  },
  "xerc.oxu": {
    whenOff: "/maliyye/xercler bağlıdır — xərc tarixçəsi görünmür.",
  },
  "xerc.yarat": {
    whenOff: "Yeni xərc yaratmaq olmur — «Xərc əlavə et» düyməsi gizlənir.",
  },
  "xerc.idare": {
    whenOff: "Xərc redaktə / sil — yalnız oxu rejimi.",
  },
  "odenis.qebul": {
    whenOff: "Müştəri borcuna qarşı ödəniş qəbul etmək olmur (kassir adətən bu icazəyə sahibdir).",
  },
  "odenis.yarat": {
    whenOff: "Manual ödəniş (təchizatçıya / işçiyə) yaratmaq olmur.",
  },
  "debitor.oxu": {
    whenOff: "/maliyye/debitor (alacaq) açılmır — müştəri borc analizi gizlənir.",
  },
  "kreditor.oxu": {
    whenOff: "/maliyye/kreditor (borc) açılmır — təchizatçı borc analizi gizlənir.",
  },
  "maliyye.gun_sonu": {
    whenOff: "/maliyye/gun-sonu açılmır — gün sonu yığma / kassa bağlanış icra edilmir.",
  },
  "maliyye.hesabat": {
    whenOff: "/maliyye/hesabat, /maliyye/pl-balans, /maliyye/pul-axini bağlıdır — maliyyə analitika gizlədilir.",
  },
  "edv.idare": {
    whenOff: "/maliyye/edv açılmır — ƏDV hesabatı və yol vergisi idarəolunmur.",
  },
  "maliyye.recurring": {
    whenOff: "/maliyye/recurring açılmır — təkrarlanan ödənişlər (kirayə, abunə) konfiqurasiya edilmir.",
  },

  // Elaqə (CRM)
  "elaqe.oxu": {
    whenOn: "Master icazə — /elaqe səhifələrinə girişə imkan verir. Müştəri/təchizatçı kataloqu.",
    whenOff: "Əməkdaş /elaqe səhifəsini aça bilmir — sidebar-da Elaqə gizlədilir.",
  },
  "musteri.oxu": {
    whenOff: "/elaqe/musteriler bağlıdır — müştəri kataloqu görünmür.",
  },
  "musteri.yarat": {
    whenOff: "Yeni müştəri yaratmaq olmur — «Yeni müştəri» düyməsi gizlənir.",
  },
  "musteri.duzelt": {
    whenOff: "Müştəri kartını redaktə etmək olmur — telefon, ünvan, borc limiti dəyişdirilmir.",
  },
  "musteri.sil": {
    whenOff: "Müştərini silmək / arxivləmək olmur — yalnız sahibkar.",
  },
  "musteri.gizli": {
    whenOff: "Müştərinin telefon/email/ünvan kimi həssas məlumatları maskalanır (gizli mod).",
  },
  "techizatci.oxu": {
    whenOff: "/elaqe/techizatcilar bağlıdır — təchizatçı kataloqu görünmür.",
  },
  "techizatci.yarat": {
    whenOff: "Yeni təchizatçı yaratmaq olmur.",
  },
  "techizatci.duzelt": {
    whenOff: "Təchizatçı kartını redaktə etmək olmur.",
  },
  "elaqe.borc": {
    whenOff: "/elaqe/borclar (borc analizi + bulk xatırlatma) açılmır.",
  },
  "elaqe.followup": {
    whenOff: "/elaqe/followup (CRM follow-up) açılmır.",
  },
  "elaqe.inaktiv": {
    whenOff: "/elaqe/inaktiv (inaktiv müştəri analizi) açılmır.",
  },
  "elaqe.dublikat": {
    whenOff: "/elaqe/dublikat (dublikat aşkarı) açılmır.",
  },
  "elaqe.hesabat": {
    whenOff: "/elaqe/hesabat (CRM hesabatları) açılmır.",
  },
  "elaqe.bulk_mesaj": {
    whenOff: "Bulk SMS/Telegram göndərmək olmur (müştərilərə kütləvi mesaj).",
  },

  // Pul-həssas icazələr
  "product.view_cost": {
    whenOff: "Əməkdaş məhsulların maya (alış) qiymətini görə bilməyəcək — yalnız satış qiyməti görünəcək.",
  },
  "product.change_cost": {
    whenOff: "Əməkdaş məhsulun maya qiymətini dəyişdirə bilməyəcək — yalnız satış qiyməti redaktə oluna bilər.",
  },
  "product.view_profit": {
    whenOff: "Əməkdaş mənfəət/marja məlumatını (satış - maya) görə bilməyəcək.",
  },
  "product.change_price": {
    whenOff: "Əməkdaş məhsulun satış qiymətini dəyişdirə bilməyəcək — yalnız adı və digər sahələri redaktə oluna bilər.",
  },
  "endirim.idare": {
    whenOff: "Əməkdaş satışda endirim tətbiq edə bilməyəcək.",
  },
  "gizli.maaş": {
    whenOff: "Əməkdaş digər əməkdaşların maaş məlumatını görə bilməyəcək.",
  },

  // İstifadəçi idarəetməsi
  "istifadeci.idare": {
    whenOff: "Əməkdaş başqa istifadəçiləri yarada/redaktə edə/söndürə bilməyəcək.",
  },
  "istifadeci.reset_password": {
    whenOff: "Əməkdaş başqa istifadəçilərin parolunu sıfırlaya bilməyəcək.",
  },
  "rol.idare": {
    whenOff: "Əməkdaş rolların adını, rəngini və icazələrini redaktə edə bilməyəcək.",
  },
  "icaze.idare": {
    whenOff: "Əməkdaş icazələri yenidən paylaşa bilməyəcək (rol matrisinə girə bilməyəcək).",
  },

  // Audit & sistem
  "audit.oxu": {
    whenOff: "Əməkdaş audit log-ları görə bilməyəcək (kim nə dəyişdi tarixçəsi).",
  },
  "backup.create": {
    whenOff: "Əməkdaş manual backup yarada bilməyəcək.",
  },
  "backup.restore": {
    whenOff: "Əməkdaş sistemi backup-dan bərpa edə bilməyəcək.",
  },
  "ayar.idare": {
    whenOff: "Əməkdaş sistem tənzimləmələrini dəyişdirə bilməyəcək (yalnız oxuya bilər).",
  },

  // POS & satış-həssas
  "kassa.legv": {
    whenOff: "Əməkdaş POS-da satışı ləğv edə bilməyəcək — yalnız menecer ləğv edə biləcək.",
  },
  "kassa.gun_sonu": {
    whenOff: "Əməkdaş günün sonu yekununu apara bilməyəcək (Z-hesabat / X-hesabat).",
  },
  "qaytarma.create": {
    whenOff: "Əməkdaş geri qaytarma əməliyyatı yarada bilməyəcək.",
  },
  "tesdiq.tesdiq_eden": {
    whenOff: "Əməkdaş təsdiq sorğularını təsdiq və ya rədd edə bilməyəcək.",
  },
};

export type PermissionInfo = {
  /** Açıb-bağlama haqqında qısa təsvir (mövcud `aciqlamaq` və ya derive olunmuş) */
  whenOn: string;
  /** Söndürüləndə əməkdaş nə edə bilməyəcək (kod patternindən) */
  whenOff: string;
};

export function getPermissionInfo(opts: {
  kod: string;
  ad: string;
  aciqlamaq?: string | null;
}): PermissionInfo {
  const { kod, ad, aciqlamaq } = opts;
  const override = SPECIAL_OVERRIDES[kod];

  // whenOn — override > DB aciqlamaq > ad-dan derive
  const whenOn = override?.whenOn ?? aciqlamaq?.trim() ?? `${ad} əməkdaşa açıq olur.`;

  // whenOff — override > derive
  if (override?.whenOff) {
    return { whenOn, whenOff: override.whenOff };
  }

  // Kod patternindən derive
  const lastDot = kod.lastIndexOf(".");
  const resource = lastDot > 0 ? kod.slice(0, lastDot) : "";
  const action = lastDot > 0 ? kod.slice(lastDot + 1) : kod;

  const actionTxt = ACTION_OFF_TEXT[action];
  const resourceTxt = RESOURCE_LABEL[resource];

  let whenOff: string;
  if (resourceTxt && actionTxt) {
    whenOff = `Əməkdaş ${resourceTxt} bölməsində ${actionTxt}.`;
  } else if (actionTxt) {
    whenOff = `Əməkdaş ${actionTxt}.`;
  } else {
    whenOff = `«${ad}» funksiyası əməkdaşa bağlı olacaq — bu hərəkəti edə bilməyəcək.`;
  }

  return { whenOn, whenOff };
}
