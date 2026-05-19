// Client-safe types for iscilier module.

export type EmployeeRow = {
  id: string;
  ad_soyad: string;
  email: string;
  telefon: string | null;
  rol_id: number;
  rol_ad: string;
  vezife: string | null;
  aylik_maas: number;
  ise_baslama: Date | null;
  aktiv: boolean;
  son_giris: Date | null;
  isden_cixdi: Date | null;
  fin_kod: string | null;
  dogum_tarixi: Date | null;
  unvan: string | null;
  bank_hesab: string | null;
  bank_ad: string | null;
  default_filial_ad: string | null;
  default_filial_id: number | null;
  profil_sekil: string | null;
  /** Derived: aktiv | mezuniyyetde | cixib */
  status: EmployeeStatus;
  /** Optional: current month sales total */
  month_sales?: number;
  /** Optional: attendance pct in current month (0-100) */
  attendance_pct?: number;
  /** Optional: target hit pct in current month (0-200) */
  target_pct?: number | null;
};

export type EmployeeStatus = "aktiv" | "mezuniyyetde" | "cixib" | "passiv";

export type RoleOpt = { id: number; ad: string };
export type FilialOpt = { id: number; ad: string };

export const LEAVE_TYPES = [
  { value: "illik", label: "İllik məzuniyyət", balance: 21 },
  { value: "xestelik", label: "Xəstəlik", balance: 14 },
  { value: "dogum", label: "Doğum", balance: 126 },
  { value: "atalik", label: "Atalıq", balance: 14 },
  { value: "seferberlik", label: "Səfərbərlik", balance: 30 },
  { value: "tehsil", label: "Təhsil", balance: 14 },
  { value: "toy", label: "Toy", balance: 3 },
  { value: "yas", label: "Yas", balance: 3 },
  { value: "icazesiz", label: "İcazəsiz", balance: 0 },
  { value: "sexsi", label: "Şəxsi", balance: 5 },
];

export const LEAVE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  gozleyir: { label: "Gözləyir", cls: "bg-info/15 text-info border-info/30" },
  yaranib: { label: "Sorğu", cls: "bg-info/15 text-info border-info/30" },
  tesdiq: { label: "Təsdiqləndi", cls: "bg-success/15 text-success border-success/30" },
  red: { label: "Rədd edildi", cls: "bg-danger/15 text-danger border-danger/30" },
  legv: { label: "Ləğv", cls: "bg-muted text-muted-foreground border-border" },
};

export type AttendanceStatus = "qaydasinda" | "gecikib" | "qaib" | "istirahet" | "mezuniyyet";

export type BordroRow = {
  id: number | null;
  istifadeci_id: string;
  ad_soyad: string;
  vezife: string | null;
  esas_maas: number;
  ish_gun_norma: number;
  ish_gun_faktiki: number;
  qaib_gun: number;
  mezuniyyet_gun: number;
  prorata_maas: number;
  kpi_bonus: number;
  manual_bonus: number;
  satis_komisyon: number;
  cerime: number;
  avans: number;
  vergi: number;
  sosial_sigorta: number;
  net_meblegh: number;
  status: string;
  odenish_tarixi: Date | null;
};
