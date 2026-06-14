import {
  ScanLine, Plus, UserPlus, PackagePlus, ListPlus, ShoppingCart, Users,
  Package, Wallet, ListTodo, Sparkles, MessageSquare,
} from "lucide-react-native";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type QAItem = {
  key: string;
  title: string;
  desc: string;
  Icon: LucideIcon;
  colors: [string, string];
  route: string;
};

// Bütün mümkün sürətli əməliyyatlar — istifadəçi seçib home-a əlavə edir.
export const QA_CATALOG: QAItem[] = [
  { key: "pos", title: "POS aç", desc: "Sürətli kassa satışı", Icon: ScanLine, colors: ["#10b981", "#0d9488"], route: "/pos" },
  { key: "yeni_satis", title: "Yeni satış", desc: "Formal sifariş / qaimə", Icon: Plus, colors: ["#3b82f6", "#2563eb"], route: "/pos" },
  { key: "yeni_musteri", title: "Yeni müştəri", desc: "Kontragent əlavə et", Icon: UserPlus, colors: ["#ec4899", "#db2777"], route: "/musteri/form" },
  { key: "yeni_mehsul", title: "Yeni məhsul", desc: "Məhsul əlavə et", Icon: PackagePlus, colors: ["#f59e0b", "#d97706"], route: "/mehsul/form" },
  { key: "yeni_tapshiriq", title: "Yeni tapşırıq", desc: "Təyinat + xatırlatma", Icon: ListPlus, colors: ["#8b5cf6", "#7c3aed"], route: "/tapshiriq/form" },
  { key: "satislar", title: "Satışlar", desc: "Sifariş tarixçəsi", Icon: ShoppingCart, colors: ["#3b82f6", "#2563eb"], route: "/(tabs)/satis" },
  { key: "musteriler", title: "Müştərilər", desc: "CRM + borclar", Icon: Users, colors: ["#a855f7", "#7c3aed"], route: "/musteri" },
  { key: "anbar", title: "Anbar", desc: "Məhsullar + stok", Icon: Package, colors: ["#f59e0b", "#d97706"], route: "/mehsullar" },
  { key: "maliyye", title: "Maliyyə", desc: "Kassa + hesabat", Icon: Wallet, colors: ["#06b6d4", "#0891b2"], route: "/maliyye" },
  { key: "tapshiriqlar", title: "Tapşırıqlar", desc: "Açıq işlər", Icon: ListTodo, colors: ["#ec4899", "#db2777"], route: "/tapshiriq" },
  { key: "ai", title: "AI köməkçi", desc: "Soruş, hesabat al", Icon: Sparkles, colors: ["#8b5cf6", "#a855f7"], route: "/ai" },
  { key: "sohbetler", title: "Söhbətlər", desc: "Komanda yazışması", Icon: MessageSquare, colors: ["#6366f1", "#4f46e5"], route: "/team" },
];

export const QA_MAP: Record<string, QAItem> = Object.fromEntries(QA_CATALOG.map((q) => [q.key, q]));

// Default home — webdəki kimi (POS hero + əsas əməliyyatlar)
export const QA_DEFAULT: string[] = ["pos", "yeni_satis", "yeni_musteri", "yeni_mehsul", "satislar", "musteriler"];
