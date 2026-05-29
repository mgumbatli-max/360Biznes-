/**
 * Kanal qiymət siyasəti üçün ortaq tip və yardımcı funksiyalar.
 *
 * Formula:
 *  - "baza"            — kanal qiyməti = mehsul.satis_qiymeti (DB-də row yoxdur)
 *  - "auto_komissiya"  — qiymet = baza × (1 + komissiya/100). Sadə markup.
 *  - "auto_net"        — qiymet = baza ÷ (1 − komissiya/100). Net qazanc baza qədər qalır.
 *  - "manual"          — qiymet = istifadəçi əl ilə daxil edib (cədvəldə saxlanılır).
 *
 * "auto_*" cache strategiyası: hər dəfə resolver çağırılanda təzə hesablanır;
 * cədvəldəki `qiymet` audit/preview üçün saxlanılır, etibarsızdır.
 */

export type KanalQiymetFormula = "baza" | "auto_komissiya" | "auto_net" | "manual" | "gizli";

export const FORMULA_META: Record<
  KanalQiymetFormula,
  { label: string; desc: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  baza: {
    label: "Baza qiymət",
    desc: "Mağaza qiyməti ilə eyni (kanalda dəyişiklik yox)",
    tone: "neutral",
  },
  auto_komissiya: {
    label: "+ Komissiya (sadə markup)",
    desc: "baza × (1 + komissiya%) — diqqət: komissiya götürüldükdən sonra ziyan ola bilər",
    tone: "warning",
  },
  auto_net: {
    label: "Net qoru (tövsiyə)",
    desc: "baza ÷ (1 − komissiya%) — komissiyadan sonra net qazanc baza qədər qalır",
    tone: "success",
  },
  manual: {
    label: "Manual",
    desc: "Əl ilə təyin edilmiş qiymət",
    tone: "info",
  },
  gizli: {
    label: "Gizli (kanalda göstərmə)",
    desc: "Bu məhsul həmin kanalın məhsul siyahısında görünməyəcək (API endpoint çıxarır)",
    tone: "danger",
  },
};

/**
 * Effektiv kanal qiymətini hesablayır.
 * Yuvarlaqlaşdırma `step` parametri ilə (məs. 0.50 → 132.85 olur 133.00).
 */
export function computeChannelPrice(input: {
  baza: number;
  formula: KanalQiymetFormula;
  manual?: number | null;
  komissiya_faiz?: number | null;
  sabit_komissiya?: number | null; // ₼ flat
  catdirilma?: number | null;
  bank_xerc?: number | null;
  step?: number | null;
  min_qiymet?: number | null; // mehsullar.min_satis_qiymeti — hard floor
}): number {
  if (input.formula === "gizli") return 0;

  const baza = Math.max(0, input.baza);
  const k = Math.max(0, Math.min(99.9, Number(input.komissiya_faiz ?? 0)));
  const sabit = Math.max(0, Number(input.sabit_komissiya ?? 0));
  const cat = Math.max(0, Number(input.catdirilma ?? 0));
  const bank = Math.max(0, Number(input.bank_xerc ?? 0));
  const totalFixed = sabit + cat + bank;

  let v = baza;
  switch (input.formula) {
    case "baza":
      v = baza;
      break;
    case "auto_komissiya":
      v = baza * (1 + k / 100) + totalFixed;
      break;
    case "auto_net":
      // Net qoru: kanal qiymət-dən bütün xərclər çıxılanda baza qalsın.
      // baza = effective × (1 − k/100) − totalFixed
      // effective = (baza + totalFixed) ÷ (1 − k/100)
      v = (baza + totalFixed) / Math.max(0.0001, 1 - k / 100);
      break;
    case "manual":
      v = Math.max(0, Number(input.manual ?? 0));
      break;
  }

  // Min qiymət hard floor — auto-* metodlarda kanal qiyməti satılma minimum-undan aşağı düşməsin.
  // Manual-da istifadəçinin qərarına qarışmırıq (yalnız xəbərdarlıq UI-da).
  const min = Math.max(0, Number(input.min_qiymet ?? 0));
  if (min > 0 && input.formula !== "manual" && v < min) {
    v = min;
  }

  const step = Math.max(0.01, Number(input.step ?? 0.01));
  // Yuxarı yuvarlaqlaşdırma (ceil) — istifadəçinin xeyrinə
  return Math.ceil(v / step) * step;
}

/** Bu effektiv qiymətdən sonra real net qazancı hesablayır (komissiya + xərclər çıxılıb). */
export function computeNetReturn(input: {
  effective: number;
  komissiya_faiz?: number | null;
  sabit_komissiya?: number | null;
  catdirilma?: number | null;
  bank_xerc?: number | null;
}): number {
  const eff = Math.max(0, input.effective);
  const k = Math.max(0, Number(input.komissiya_faiz ?? 0));
  const fixed =
    Math.max(0, Number(input.sabit_komissiya ?? 0)) +
    Math.max(0, Number(input.catdirilma ?? 0)) +
    Math.max(0, Number(input.bank_xerc ?? 0));
  return eff * (1 - k / 100) - fixed;
}
