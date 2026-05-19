import type { LucideIcon } from "lucide-react";
import {
  Sunrise, ClipboardCheck, UserPlus, Package, Truck, Wrench,
  FileText, CalendarCheck, Repeat, ShoppingCart, AlertTriangle, Wallet,
} from "lucide-react";

export type TaskTemplate = {
  id: string;
  ad: string;
  tesvir: string;
  icon: LucideIcon;
  color: string;
  prioritet: "asagi" | "normal" | "yuksek" | "tecili";
  /** Defaults applied when user creates a task from this template */
  defaults: {
    basliq: string;
    tesvir: string;
    deadline_offset_hours?: number; // hours from now
  };
  /** Optional checklist items */
  checklist?: string[];
  category: "daily" | "weekly" | "monthly" | "onboarding" | "ad_hoc";
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "daily-check",
    ad: "Gündəlik səhər yoxlama",
    tesvir: "Stok, kassa, xəbərdarlıqlar və açıq sifarişlərin nəzərdən keçirilməsi",
    icon: Sunrise,
    color: "from-amber-500 to-orange-500",
    prioritet: "normal",
    category: "daily",
    defaults: { basliq: "Səhər yoxlaması", tesvir: "Bütün açıq prosesləri yoxla", deadline_offset_hours: 4 },
    checklist: [
      "Açıq xəbərdarlıqlara bax",
      "Bu gün üçün təsdiq gözləyən əməliyyatları yoxla",
      "Stok-bitik məhsulları sayğacla",
      "Dünənki kassanın bağlanışı",
      "Yeni satış sifarişlərini emal et",
    ],
  },
  {
    id: "weekly-review",
    ad: "Həftəlik review",
    tesvir: "Həftə üzrə satış, marja, KPI nəticələri",
    icon: ClipboardCheck,
    color: "from-violet-500 to-fuchsia-500",
    prioritet: "yuksek",
    category: "weekly",
    defaults: { basliq: "Həftəlik review", tesvir: "Komanda ilə həftə nəticələri", deadline_offset_hours: 24 * 7 },
    checklist: [
      "Bu həftə satış total",
      "Top 5 məhsul",
      "Top 3 müştəri",
      "Marja % keçən həftə ilə",
      "Növbəti həftə planı",
    ],
  },
  {
    id: "month-close",
    ad: "Ay bağlanışı",
    tesvir: "P&L, anbar sayımı, debitor borc analizi",
    icon: CalendarCheck,
    color: "from-emerald-500 to-teal-500",
    prioritet: "yuksek",
    category: "monthly",
    defaults: { basliq: "Ay sonu bağlanış", tesvir: "Maliyyə hesabatları və sayım", deadline_offset_hours: 24 * 30 },
    checklist: [
      "Anbar sayımını tamamla",
      "Debitor borc reyestrini yenilə",
      "Vergi hesabatlarını hazırla",
      "P&L təsdiqi",
      "İşçi maaş hesabı",
    ],
  },
  {
    id: "new-customer",
    ad: "Yeni müştəri onboarding",
    tesvir: "Yeni müştəri qeydiyyatı və ilk təmas planı",
    icon: UserPlus,
    color: "from-sky-500 to-cyan-500",
    prioritet: "normal",
    category: "onboarding",
    defaults: { basliq: "Yeni müştəri onboarding", tesvir: "Tam tanıtma və ilk sifariş", deadline_offset_hours: 48 },
    checklist: [
      "Müştəri profilini doldur (VOEN, telefon, ünvan)",
      "Kredit limiti təyin et",
      "Welcome mesaj göndər",
      "Kataloq paylaş",
      "İlk təklif hazırla",
    ],
  },
  {
    id: "new-employee",
    ad: "Yeni işçi onboarding",
    tesvir: "Yeni işçinin sistemə daxil olması və treninq",
    icon: UserPlus,
    color: "from-emerald-500 to-teal-500",
    prioritet: "yuksek",
    category: "onboarding",
    defaults: { basliq: "Yeni işçi onboarding", tesvir: "İlk həftə üçün checklist", deadline_offset_hours: 24 * 7 },
    checklist: [
      "İşçi profili yarat (rol, filial)",
      "Sənədləri topla",
      "ERP girişi və PIN ver",
      "İlk gün treninq",
      "Mentor təyin et",
      "1-ci həftə qiymətləndir",
    ],
  },
  {
    id: "stock-receive",
    ad: "Yeni mal qəbulu",
    tesvir: "Tədarükçüdən gələn malın qəbulu və yerləşdirilməsi",
    icon: Package,
    color: "from-cyan-500 to-blue-500",
    prioritet: "yuksek",
    category: "ad_hoc",
    defaults: { basliq: "Mal qəbulu", tesvir: "Qaiməyə uyğun yoxlama", deadline_offset_hours: 24 },
    checklist: [
      "Qaiməni yoxla (mal miqdarı + qiymət)",
      "Defektləri qeydə al",
      "Stoka əlavə et",
      "Barkod yapışdır",
      "Anbarda yerini təyin et",
    ],
  },
  {
    id: "stock-count",
    ad: "Stok sayımı (inventar)",
    tesvir: "Anbar üzrə fiziki sayım",
    icon: Package,
    color: "from-violet-500 to-purple-500",
    prioritet: "yuksek",
    category: "monthly",
    defaults: { basliq: "Anbar sayımı", tesvir: "Fiziki sayım", deadline_offset_hours: 24 * 3 },
    checklist: [
      "Sayım siyahısı hazırla",
      "Anbarları paylaş",
      "Sayımı keçir",
      "Fərqləri qeydə al",
      "Hesabatı yaz",
    ],
  },
  {
    id: "service-followup",
    ad: "Servis müştəri follow-up",
    tesvir: "Tamamlanmış servis üzrə müştəri rəyi",
    icon: Wrench,
    color: "from-rose-500 to-pink-500",
    prioritet: "normal",
    category: "ad_hoc",
    defaults: { basliq: "Servis follow-up", tesvir: "Müştəri məmnuniyyət sorğusu", deadline_offset_hours: 48 },
    checklist: [
      "Müştəriyə zəng et",
      "Servis nəticəsindən razılığını öyrən",
      "NPS qiymət al",
      "Zəruri olduqda yenidən servis planla",
    ],
  },
  {
    id: "supplier-payment",
    ad: "Təchizatçı ödənişi",
    tesvir: "Tədarükçüyə ödəniş hazırlığı",
    icon: Truck,
    color: "from-amber-500 to-yellow-500",
    prioritet: "yuksek",
    category: "ad_hoc",
    defaults: { basliq: "Təchizatçı ödənişi", tesvir: "Ödəniş planını yoxla", deadline_offset_hours: 48 },
    checklist: [
      "Açıq qaimələri yığ",
      "Cəm məbləği hesabla",
      "Bank köçürmə hazırla",
      "Sahibkar təsdiqini al",
      "Ödənişi icra et",
    ],
  },
  {
    id: "debt-collection",
    ad: "Borc yığımı",
    tesvir: "Gecikmiş müştəri borcunu yığma planı",
    icon: AlertTriangle,
    color: "from-rose-500 to-red-600",
    prioritet: "tecili",
    category: "ad_hoc",
    defaults: { basliq: "Borc yığımı", tesvir: "Gecikmiş borcu yığ", deadline_offset_hours: 72 },
    checklist: [
      "Müştəri ilə əlaqə qur",
      "Borcun cədvəlini razılaşdır",
      "Yazılı razılaşma əldə et",
      "İlk ödənişi qəbul et",
      "İrəliləyişi izlə",
    ],
  },
  {
    id: "marketing-campaign",
    ad: "Marketing kampaniyası",
    tesvir: "Yeni kampaniyanın planlanması",
    icon: Repeat,
    color: "from-pink-500 to-rose-500",
    prioritet: "normal",
    category: "ad_hoc",
    defaults: { basliq: "Marketing kampaniyası", tesvir: "Kampaniyanın hazırlanması", deadline_offset_hours: 24 * 7 },
    checklist: [
      "Mövzu və mesaj",
      "Hədəf seqment",
      "Reklam dizaynı",
      "Büdcə planı",
      "Kanalların seçimi (WA, IG, email)",
      "Nəticə KPI",
    ],
  },
  {
    id: "report-prepare",
    ad: "Hesabat hazırla",
    tesvir: "Sahibkar üçün xüsusi hesabat",
    icon: FileText,
    color: "from-slate-500 to-zinc-500",
    prioritet: "normal",
    category: "ad_hoc",
    defaults: { basliq: "Hesabat hazırla", tesvir: "Detallı analiz", deadline_offset_hours: 48 },
    checklist: [
      "Mövzunu dəqiqləşdir",
      "Data topla",
      "Vizuallar hazırla",
      "Tövsiyələr yaz",
      "PDF formatla",
    ],
  },
  {
    id: "promo-launch",
    ad: "Promosyon başlat",
    tesvir: "Endirim/promo kampaniyasının aktivləşdirilməsi",
    icon: ShoppingCart,
    color: "from-orange-500 to-red-500",
    prioritet: "normal",
    category: "ad_hoc",
    defaults: { basliq: "Promosyon başlat", tesvir: "Endirim kampaniyası", deadline_offset_hours: 24 },
    checklist: [
      "Promo məhsullarını seç",
      "Endirim faizini təyin et",
      "Tarix aralığı",
      "POS-da konfiqurə et",
      "Müştərilərə bildiriş",
    ],
  },
  {
    id: "cashbox-close",
    ad: "Gün sonu kassa bağlanışı",
    tesvir: "Günü bağlamaq və hesab",
    icon: Wallet,
    color: "from-emerald-500 to-teal-500",
    prioritet: "tecili",
    category: "daily",
    defaults: { basliq: "Kassa bağlanışı", tesvir: "Günsonu", deadline_offset_hours: 1 },
    checklist: [
      "Açılış məbləğini yoxla",
      "Bütün satışları topla",
      "Nağd və kart ayrı say",
      "Real qalıqla müqayisə",
      "Fərqi qeydə al",
    ],
  },
];

export function getTemplate(id: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find((t) => t.id === id);
}
