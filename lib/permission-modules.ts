import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  Wrench,
  Sparkles,
  Globe2,
  Settings as Cog,
  Shield,
  ListTodo,
  type LucideIcon,
} from "lucide-react";

/**
 * Modul = bir neçə icazə qrupunun məntiqi birləşməsi.
 * Hər qrup tam olaraq bir modula aiddir. Modullar əməkdaşın gündəlik təcrübəsinə
 * uyğun qruplaşdırılıb — anbar idarə edən üçün Anbar modulundakı bütün
 * funksionallıq bir yerdədir.
 */
export type PermissionModule = {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** Tailwind gradient — modul başlığı üçün */
  color: string;
  /** Bu modul-a daxil olan icaze qrupları (DB-də `icazeler.qrup` dəyəri) */
  groups: string[];
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "dashboard",
    label: "Dashboard & Naviqasiya",
    desc: "Dashboard səhifəsinin bölmələri — bu icazələrlə əməkdaşın açılışda nə görəcəyi tənzimlənir",
    icon: LayoutDashboard,
    color: "from-violet-500 to-purple-600",
    groups: ["Dashboard"],
  },
  {
    key: "ticaret",
    label: "Ticarət & Satış",
    desc: "Satış, POS, kassa, çek və müştəri ilə bağlı bütün əməliyyatlar",
    icon: ShoppingCart,
    color: "from-emerald-500 to-teal-600",
    groups: ["Ticarət", "POS", "Kassa", "Vergi/Çek"],
  },
  {
    key: "anbar",
    label: "Anbar & Məhsul",
    desc: "Məhsul, stok, qiymət, satınalma və idxal/ixrac əməliyyatları",
    icon: Package,
    color: "from-amber-500 to-orange-600",
    groups: ["Anbar", "satinalma", "Qiymət", "İdxal/İxrac"],
  },
  {
    key: "maliyye",
    label: "Maliyyə & Hesabat",
    desc: "Pul axını, xərclər, mənfəət, KPI və hesabatlar",
    icon: Wallet,
    color: "from-sky-500 to-blue-600",
    groups: ["Maliyyə", "KPI", "Hesabatlar"],
  },
  {
    key: "musteri",
    label: "Müştəri & CRM",
    desc: "Müştərilər, kontragentlər, lead, mesajlaşma və satış kanalları",
    icon: Users,
    color: "from-pink-500 to-rose-600",
    groups: ["Müştərilər", "CRM", "Mesaj/Sosial"],
  },
  {
    key: "servis",
    label: "Servis & İş axını",
    desc: "Servis, tapşırıqlar, təsdiq, avtomatlaşdırma və xəbərdarlıqlar",
    icon: Wrench,
    color: "from-cyan-500 to-blue-500",
    groups: ["Servis", "Tapşırıqlar", "Təsdiq", "Avtomatlaşdırma", "Xəbərdarlıqlar", "Operativ"],
  },
  {
    key: "ai",
    label: "AI Köməkçi",
    desc: "AI analizi, AI advisor və AI tetikləyiciləri",
    icon: Sparkles,
    color: "from-fuchsia-500 to-purple-600",
    groups: ["AI", "AI Mərkəz"],
  },
  {
    key: "inteqrasiya",
    label: "İnteqrasiya & Marketplace",
    desc: "Marketplace, webhook, API və xarici servislərlə inteqrasiya",
    icon: Globe2,
    color: "from-indigo-500 to-blue-700",
    groups: ["Marketplace", "API və Webhook"],
  },
  {
    key: "sistem",
    label: "Sistem & İdarəetmə",
    desc: "İstifadəçi, rol, icazə, audit log, backup, filiallar və sistem tənzimləmələri",
    icon: Cog,
    color: "from-slate-500 to-slate-700",
    groups: ["İdarəetmə", "Sistem", "Backup", "Filiallar", "Sənədlər"],
  },
  {
    key: "tehlukesizlik",
    label: "Təhlükəsizlik",
    desc: "Gizli məlumatlar (maaş, audit) — yalnız xüsusi rollar üçün",
    icon: Shield,
    color: "from-rose-500 to-red-600",
    groups: ["Gizli məlumat"],
  },
  {
    key: "sahibkar",
    label: "Sahibkar bölməsi",
    desc: "Yalnız biznes sahibinin görə bildiyi məlumat və əməliyyatlar",
    icon: ListTodo,
    color: "from-amber-600 to-yellow-700",
    groups: ["Sahibkar", "Owner"],
  },
];

/** Qrup adından modul taparkən istifadə üçün reverse map */
const GROUP_TO_MODULE = new Map<string, PermissionModule>();
for (const m of PERMISSION_MODULES) {
  for (const g of m.groups) GROUP_TO_MODULE.set(g, m);
}

export function findModuleForGroup(qrup: string): PermissionModule | undefined {
  return GROUP_TO_MODULE.get(qrup);
}

/** Fallback modul — sistemdə müəyyən edilməmiş qrupar üçün */
export const OTHER_MODULE: PermissionModule = {
  key: "other",
  label: "Digər",
  desc: "Təsnif edilməmiş icazələr",
  icon: ListTodo,
  color: "from-stone-500 to-stone-700",
  groups: [],
};
