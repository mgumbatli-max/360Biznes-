/**
 * Saf utility — pure client-safe (server action deyil).
 * Qiymət qaydasına görə pərakəndə qiymətdən bir alt qiymət hesabla.
 */

export type PriceRuleLite = {
  markup: number;
  round_to: string;
};

/**
 * Pərakəndə qiymətdən bir qaydaya görə qiymət hesabla.
 * markup mənfi olarsa endirim, müsbət olarsa artım.
 * round_to "0.99"/"0.95"/"0.50" — psixoloji yuvarlaqlama
 */
export function applyPriceRule(retail: number, rule: PriceRuleLite): number {
  const raw = retail * (1 + rule.markup / 100);
  const round = parseFloat(rule.round_to);
  if (!Number.isFinite(round) || round === 0) {
    return Math.round(raw * 100) / 100;
  }
  // "0.99" — adi rounding-dən sonra .99 əlavə et
  const base = Math.floor(raw);
  return base + round;
}
