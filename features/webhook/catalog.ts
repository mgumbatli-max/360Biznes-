import type { LucideIcon } from "lucide-react";
import {
  ShoppingCart, RotateCcw, PackageOpen, Truck, UserPlus, LogIn,
  ShieldCheck, AlertTriangle, Wrench, MessageSquare, Globe, Wallet,
  CreditCard, Trash2, Tag,
} from "lucide-react";

export type WebhookEvent = {
  kod: string;
  ad: string;
  modul: string;
  icon: LucideIcon;
  tesvir: string;
  ne_vaxt: string;
  payload_misal: Record<string, unknown>;
};

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    kod: "sale.created",
    ad: "Satış yaradıldı",
    modul: "Ticarət",
    icon: ShoppingCart,
    tesvir: "Yeni satış sifarişi yarananda göndərilir",
    ne_vaxt: "POS-da və ya ticarət bölməsində yeni satış yaradıldıqda dərhal",
    payload_misal: {
      event: "sale.created",
      sale_id: "uuid-here",
      nomre: "SAT-2026-00123",
      musteri_ad: "Müştəri ASC",
      mebleg: 450.50,
      tarix: "2026-05-17T14:32:00Z",
    },
  },
  {
    kod: "sale.returned",
    ad: "Qaytarma yaradıldı",
    modul: "Ticarət",
    icon: RotateCcw,
    tesvir: "Müştəri məhsulu qaytaranda göndərilir",
    ne_vaxt: "Qaytarma əməliyyatı qeyd edildikdə",
    payload_misal: {
      event: "sale.returned",
      qaytarma_id: "uuid",
      original_sale_nomre: "SAT-2026-00080",
      mebleg: 120,
      sebeb: "Defekt",
    },
  },
  {
    kod: "stock.low",
    ad: "Stok kritik",
    modul: "Anbar",
    icon: AlertTriangle,
    tesvir: "Məhsulun stoku təyin olunmuş minimum səviyyəyə düşəndə",
    ne_vaxt: "Hər satışdan sonra avtomatik yoxlama edilir",
    payload_misal: {
      event: "stock.low",
      mehsul_id: "uuid",
      mehsul_ad: "iPhone 15 Pro",
      qaliq: 3,
      min_stok: 5,
    },
  },
  {
    kod: "stock.zero",
    ad: "Stok bitdi",
    modul: "Anbar",
    icon: PackageOpen,
    tesvir: "Məhsulun stoku sıfıra düşdükdə",
    ne_vaxt: "Son satışda qalıq 0-a düşdükdə",
    payload_misal: {
      event: "stock.zero",
      mehsul_id: "uuid",
      mehsul_ad: "AirPods Pro",
      son_satish_id: "uuid",
    },
  },
  {
    kod: "purchase.created",
    ad: "Alış yaradıldı",
    modul: "Alış",
    icon: Truck,
    tesvir: "Yeni alış qaiməsi yaradıldıqda",
    ne_vaxt: "Tədarükçüdən mal qəbulu yaradıldıqda",
    payload_misal: {
      event: "purchase.created",
      purchase_id: "uuid",
      tedarukcu: "Apple AZ MMC",
      mebleg: 15000,
      mal_say: 50,
    },
  },
  {
    kod: "customer.created",
    ad: "Yeni müştəri",
    modul: "CRM",
    icon: UserPlus,
    tesvir: "Yeni kontragent qeyd edildikdə",
    ne_vaxt: "Əlaqələr bölməsində yeni müştəri/təchizatçı yaradıldıqda",
    payload_misal: {
      event: "customer.created",
      musteri_id: "uuid",
      ad: "Yeni Müştəri MMC",
      telefon: "+994501234567",
    },
  },
  {
    kod: "user.login",
    ad: "İşçi giriş",
    modul: "Sistem",
    icon: LogIn,
    tesvir: "İstifadəçi sistemə daxil olduqda",
    ne_vaxt: "Hər uğurlu girişdə (login)",
    payload_misal: {
      event: "user.login",
      user_id: "uuid",
      ad_soyad: "Eli Vəli",
      ip: "10.0.0.1",
    },
  },
  {
    kod: "approval.requested",
    ad: "Təsdiq tələbi",
    modul: "Təsdiq",
    icon: ShieldCheck,
    tesvir: "Yeni təsdiq tələbi yarananda",
    ne_vaxt: "Endirim, maya altı satış kimi hadisələrdə",
    payload_misal: {
      event: "approval.requested",
      telep_id: 123,
      tip: "endirim",
      basliq: "30% endirim — Müştəri X",
    },
  },
  {
    kod: "approval.approved",
    ad: "Təsdiq edildi",
    modul: "Təsdiq",
    icon: ShieldCheck,
    tesvir: "Sahibkar/admin təsdiq tələbini qəbul etdikdə",
    ne_vaxt: "Təsdiq Mərkəzində Approve düyməsinə basılanda",
    payload_misal: {
      event: "approval.approved",
      telep_id: 123,
      baxan: "Sahibkar adı",
    },
  },
  {
    kod: "approval.rejected",
    ad: "Təsdiq rədd edildi",
    modul: "Təsdiq",
    icon: AlertTriangle,
    tesvir: "Sahibkar/admin təsdiq tələbini rədd etdikdə",
    ne_vaxt: "Reject düyməsinə basılanda",
    payload_misal: { event: "approval.rejected", telep_id: 123, sebeb: "Səbəb metni" },
  },
  {
    kod: "service.completed",
    ad: "Servis tamamlandı",
    modul: "Servis",
    icon: Wrench,
    tesvir: "Servis tapşırığı bağlandıqda",
    ne_vaxt: "Servis statusu 'tamamlandi'-yə dəyişdikdə",
    payload_misal: { event: "service.completed", servis_id: "uuid", musteri: "Ad" },
  },
  {
    kod: "payment.received",
    ad: "Ödəniş daxil oldu",
    modul: "Maliyyə",
    icon: Wallet,
    tesvir: "Kassa və ya banka ödəniş düşəndə",
    ne_vaxt: "Yeni maliyyə əməliyyatı qeyd edildikdə",
    payload_misal: { event: "payment.received", mebleg: 500, hesab: "Bank XYZ" },
  },
  {
    kod: "debt.overdue",
    ad: "Borc gecikdi",
    modul: "Maliyyə",
    icon: CreditCard,
    tesvir: "Müştəri borcu təyin olunmuş günlərdən artıq gecikdikdə",
    ne_vaxt: "Avtomatlaşdırma qaydası işə düşəndə (default: 7 gün)",
    payload_misal: { event: "debt.overdue", musteri: "Ad", mebleg: 500, gun: 12 },
  },
  {
    kod: "product.deleted",
    ad: "Məhsul silindi",
    modul: "Anbar",
    icon: Trash2,
    tesvir: "Məhsul silindikdə (sistemdən tam çıxarıldıqda)",
    ne_vaxt: "Sahibkar təsdiqindən sonra məhsul silindikdə",
    payload_misal: { event: "product.deleted", mehsul_id: "uuid", ad: "Məhsul adı" },
  },
  {
    kod: "price.changed",
    ad: "Qiymət dəyişdi",
    modul: "Anbar",
    icon: Tag,
    tesvir: "Məhsulun satış qiyməti dəyişdirildikdə",
    ne_vaxt: "Qiymət redaktə edilib saxlanıldıqda",
    payload_misal: { event: "price.changed", mehsul_id: "uuid", kohne: 100, yeni: 120 },
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * Service presets — pre-configured webhook templates for popular services
 * ────────────────────────────────────────────────────────────────────────── */

export type WebhookPreset = {
  id: string;
  ad: string;
  desc: string;
  url_placeholder: string;
  url_help: string;
  recommended_events: string[];
  setup_url?: string;
  icon: LucideIcon;
  color: string;
};

export const WEBHOOK_PRESETS: WebhookPreset[] = [
  {
    id: "slack",
    ad: "Slack",
    desc: "Komandanıza Slack kanalında bildiriş",
    url_placeholder: "https://hooks.slack.com/services/T00/B00/XXX",
    url_help: "Slack-da Incoming Webhook yarat → URL kopya et",
    recommended_events: ["sale.created", "stock.low", "approval.requested"],
    setup_url: "https://api.slack.com/messaging/webhooks",
    icon: MessageSquare,
    color: "from-violet-500 to-purple-500",
  },
  {
    id: "discord",
    ad: "Discord",
    desc: "Discord serverində bildiriş",
    url_placeholder: "https://discord.com/api/webhooks/.../...",
    url_help: "Discord kanal ayarları → Integrations → New Webhook",
    recommended_events: ["sale.created", "stock.low", "user.login"],
    setup_url: "https://support.discord.com/hc/en-us/articles/228383668",
    icon: MessageSquare,
    color: "from-indigo-500 to-blue-500",
  },
  {
    id: "telegram",
    ad: "Telegram bot",
    desc: "Telegram chat-ə bot vasitəsilə mesaj",
    url_placeholder: "https://yoursite.com/api/telegram-relay",
    url_help: "Telegram bot URL deyil, sizdə bot relay endpoint olmalıdır",
    recommended_events: ["sale.created", "stock.zero", "approval.requested", "debt.overdue"],
    setup_url: "https://core.telegram.org/bots",
    icon: MessageSquare,
    color: "from-sky-500 to-cyan-500",
  },
  {
    id: "zapier",
    ad: "Zapier",
    desc: "5000+ tətbiqlə inteqrasiya (Google Sheets, Notion, Gmail, vəs.)",
    url_placeholder: "https://hooks.zapier.com/hooks/catch/.../...",
    url_help: "Zapier-də 'Webhooks by Zapier' trigger seç → URL kopya et",
    recommended_events: ["sale.created", "customer.created", "purchase.created"],
    setup_url: "https://zapier.com/apps/webhook/integrations",
    icon: Globe,
    color: "from-orange-500 to-amber-500",
  },
  {
    id: "make",
    ad: "Make (Integromat)",
    desc: "Vizual avtomatlaşdırma platforması",
    url_placeholder: "https://hook.make.com/...",
    url_help: "Make scenario-da Custom Webhook modul əlavə et",
    recommended_events: ["sale.created", "stock.low", "payment.received"],
    setup_url: "https://www.make.com/en/help/tools/webhooks",
    icon: Globe,
    color: "from-purple-500 to-pink-500",
  },
  {
    id: "custom",
    ad: "Öz serveriniz",
    desc: "Şəxsi backend, CRM, ERP və ya başqa sistem",
    url_placeholder: "https://api.yourdomain.com/webhooks/360biznes",
    url_help: "POST qəbul edən endpoint URL-ni daxil edin",
    recommended_events: [],
    icon: Globe,
    color: "from-slate-500 to-zinc-500",
  },
];

export function getEvent(kod: string): WebhookEvent | undefined {
  return WEBHOOK_EVENTS.find((e) => e.kod === kod);
}

export function getPreset(id: string): WebhookPreset | undefined {
  return WEBHOOK_PRESETS.find((p) => p.id === id);
}
