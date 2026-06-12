const SYM: Record<string, string> = {
  AZN: "₼",
  USD: "$",
  EUR: "€",
  TRY: "₺",
  RUB: "₽",
  GBP: "£",
};

export function formatMoney(
  n: number | null | undefined,
  valyuta = "AZN"
): string {
  const v = Number(n ?? 0);
  const sym = SYM[valyuta] ?? valyuta + " ";
  const s = v.toFixed(2);
  const [int, dec] = s.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped},${dec} ${sym}`.trim();
}

export function formatNumber(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    " "
  );
}
