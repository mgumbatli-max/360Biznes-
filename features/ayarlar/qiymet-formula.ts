/**
 * Compute a price from formula.
 * formula_novu: 'yox' = no auto-calc, 'maya_uzeri' = base * (1 + faiz/100), 'satis_endirim' = base * (1 - faiz/100), 'fix' = faiz as the absolute price
 * formula_baza: which field to use as base: 'maya' | 'satis' | 'topdan'
 */
export type FormulaNov = "yox" | "maya_uzeri" | "satis_endirim" | "fix";
export type FormulaBaza = "maya" | "satis" | "topdan";

export type FormulaInputs = {
  maya?: number | null;
  satis?: number | null;
  topdan?: number | null;
};

export function computeFormulaPrice(
  formula_novu: string | null | undefined,
  formula_baza: string | null | undefined,
  formula_faiz: number | null | undefined,
  yuvarla: number | null | undefined,
  baseValues: FormulaInputs
): { value: number | null; explain: string } {
  if (!formula_novu || formula_novu === "yox") {
    return { value: null, explain: "Avto formula yoxdur — manual qiymət lazım" };
  }
  const faiz = Number(formula_faiz ?? 0);
  const baza = (formula_baza ?? "maya") as FormulaBaza;
  const baseNum = baseValues[baza] ?? null;
  if (baseNum == null || !Number.isFinite(baseNum) || baseNum <= 0) {
    return { value: null, explain: `${baza} qiyməti yoxdur` };
  }

  let raw: number;
  let explain: string;
  switch (formula_novu) {
    case "maya_uzeri":
      raw = baseNum * (1 + faiz / 100);
      explain = `${baza} (${baseNum}) + ${faiz}% = ${raw.toFixed(2)}`;
      break;
    case "satis_endirim":
      raw = baseNum * (1 - faiz / 100);
      explain = `${baza} (${baseNum}) − ${faiz}% = ${raw.toFixed(2)}`;
      break;
    case "fix":
      raw = faiz;
      explain = `fix: ${raw}`;
      break;
    default:
      return { value: null, explain: "Bilinməyən formula" };
  }

  let final = raw;
  if (yuvarla && yuvarla > 0) {
    final = Math.round(raw / Number(yuvarla)) * Number(yuvarla);
    explain += ` → ${final.toFixed(2)} (yuvarlamadan sonra)`;
  }

  return { value: final, explain };
}

export const FORMULA_NOV_OPTIONS: Array<{ value: FormulaNov; label: string; desc: string }> = [
  { value: "yox", label: "Avto formula yoxdur", desc: "Hər məhsul üçün qiymət ayrıca daxil edilir" },
  { value: "maya_uzeri", label: "Maya üzərinə % əlavə", desc: "Misal: maya 100₼, faiz 30% → 130₼" },
  { value: "satis_endirim", label: "Satışdan % endirim", desc: "Misal: pərakəndə 130₼, faiz 10% → 117₼" },
  { value: "fix", label: "Sabit qiymət", desc: "Bütün məhsullar üçün eyni qiymət (bonus/promo üçün)" },
];

export const FORMULA_BAZA_OPTIONS: Array<{ value: FormulaBaza; label: string }> = [
  { value: "maya", label: "Maya qiyməti (alış)" },
  { value: "satis", label: "Pərakəndə qiymət" },
  { value: "topdan", label: "Topdan qiymət" },
];

export const YUVARLAMA_OPTIONS = [
  { value: 0, label: "Yuvarlama yoxdur" },
  { value: 0.01, label: "0.01 qədər (sent)" },
  { value: 0.1, label: "0.10 qədər" },
  { value: 0.5, label: "0.50 qədər" },
  { value: 1, label: "1.00 qədər" },
  { value: 5, label: "5.00 qədər" },
  { value: 10, label: "10.00 qədər" },
];
