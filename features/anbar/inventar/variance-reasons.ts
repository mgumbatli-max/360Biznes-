/**
 * İnventar fərqi səbəbləri.
 *
 * `inventar_satirlari.qeyd` field-i fərq səbəbi və açıqlamasını saxlayır:
 *   `[SEBEB:ogurluq] istifadəçi qeydi mətni`
 *
 * Bu yanaşma migration tələb etmir — mövcud `qeyd` field-i istifadə olunur.
 * Səbəb sayım tamamlandıqda maliyyə hesabatına xərc kateqoriyası kimi keçir
 * (ya da müsbət fərqdə audit qaldı).
 */

export type VarianceReason =
  | "zerer"        // Fiziki zərər (sındı, oksidləşdi, vaxtı keçdi)
  | "ogurluq"      // Anbardan oğurluq
  | "damage"       // Daşıma zamanı damage
  | "manual"       // Manual yazılış səhvi (sistemdə artıq əksik)
  | "sistem_sehv"  // Sistem səhvi (POS satışında stok düşmədi və s.)
  | "qaytarma"     // Müştəri qaytardı amma stoka qaytarılmadı
  | "menfi_xidmet" // Daxili istifadə (test, marketinq, demo)
  | "muveffeqiyyetli_artim" // Müsbət fərq — anbarçı tapdı
  | "diger";       // Digər

export const VARIANCE_REASONS: { value: VarianceReason; label: string; tone: "danger" | "warning" | "info" | "success"; description: string; needsApproval?: boolean }[] = [
  { value: "ogurluq", label: "Oğurluq", tone: "danger", description: "Anbardan oğurluq və ya itki", needsApproval: true },
  { value: "zerer", label: "Zərər", tone: "danger", description: "Sındı, oksidləşdi, vaxtı keçdi" },
  { value: "damage", label: "Daşıma zədəsi", tone: "warning", description: "Daşıma zamanı damage" },
  { value: "manual", label: "Sayım səhvi", tone: "info", description: "Sistemdə yanlış yazılmış, sayımla düzəltdik" },
  { value: "sistem_sehv", label: "Sistem səhvi", tone: "warning", description: "POS satışda stok düşmədi, alış medaxili əksikdir" },
  { value: "qaytarma", label: "Qaytarma yox idi", tone: "warning", description: "Müştəri qaytardı amma sistemdə əks olunmadı" },
  { value: "menfi_xidmet", label: "Daxili istifadə", tone: "info", description: "Test, marketinq, demo üçün istifadə" },
  { value: "muveffeqiyyetli_artim", label: "Tapıldı (müsbət)", tone: "success", description: "Anbarçı əlavə vahid tapdı" },
  { value: "diger", label: "Digər", tone: "info", description: "Səbəbi məlum deyil" },
];

const SEBEB_PREFIX_RE = /^\[SEBEB:([a-z_]+)\]\s*/;

export function parseVarianceQeyd(qeyd: string | null | undefined): { sebeb: VarianceReason | null; aciqlama: string } {
  if (!qeyd) return { sebeb: null, aciqlama: "" };
  const m = qeyd.match(SEBEB_PREFIX_RE);
  if (!m) return { sebeb: null, aciqlama: qeyd };
  const sebeb = m[1] as VarianceReason;
  const valid = VARIANCE_REASONS.some((r) => r.value === sebeb);
  return {
    sebeb: valid ? sebeb : null,
    aciqlama: qeyd.replace(SEBEB_PREFIX_RE, "").trim(),
  };
}

export function buildVarianceQeyd(sebeb: VarianceReason | null, aciqlama: string): string {
  const a = aciqlama.trim();
  if (!sebeb) return a;
  return a ? `[SEBEB:${sebeb}] ${a}` : `[SEBEB:${sebeb}]`;
}

export function reasonMeta(sebeb: VarianceReason | null): { label: string; tone: "danger" | "warning" | "info" | "success" } | null {
  if (!sebeb) return null;
  const m = VARIANCE_REASONS.find((r) => r.value === sebeb);
  return m ? { label: m.label, tone: m.tone } : null;
}

/**
 * Sayım tamamlanan zaman fərq maliyyə təsiri:
 * - Mənfi fərq (sistem > faktiki) → biz itirdik → xərc (`finance_operations.meblegh < 0`)
 * - Müsbət fərq (sistem < faktiki) → biz tapdıq → bir növü gəlir, lakin reallıqda
 *   adətən sistem səhvini düzəltməkdir (real gəlir deyil) → audit-də qeyd, finance-də əlavə yox.
 *
 * Səbəbə görə hesab kateqoriyası:
 */
export function reasonToExpenseCategory(sebeb: VarianceReason | null): string | null {
  switch (sebeb) {
    case "ogurluq":
      return "anbar_ogurluq";
    case "zerer":
    case "damage":
      return "anbar_zerer";
    case "manual":
    case "sistem_sehv":
    case "qaytarma":
      // Bu səbəblər real xərc deyil — sistem düzəlişi. finance-də əks olunmasın.
      return null;
    case "menfi_xidmet":
      return "anbar_daxili_istifade";
    case "muveffeqiyyetli_artim":
      return null;
    default:
      return "anbar_diger";
  }
}
