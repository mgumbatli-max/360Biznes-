export type CostAnalysis = {
  revenue: number;
  discount_given: number;
  cogs: number;
  opex: number;
  payroll_monthly: number;
  gross_profit: number;
  net_profit: number;
  cogs_pct: number;
  opex_pct: number;
  payroll_pct: number;
};

export type SahibkarResponse = { cost: CostAnalysis };
