/** Web `features/dashboard/queries.ts` tiplərinin mobil güzgüsü (JSON-safe).
 *  `/api/mobile/v1/dashboard/home` kompozit cavabı. Tarixlər ISO string-dir. */

export type CeoKpis = {
  todaySalesAmount: number;
  todaySalesCount: number;
  monthRevenue: number;
  netProfitPct: number;
  activeCustomers: number;
  openTasks: number;
  lowStockCount: number;
};

export type MonthlySide = { revenue: number; expense: number; profit: number; newCustomers: number };
export type MonthlyComparison = { current: MonthlySide; previous: MonthlySide };

export type TodayCashFlow = { daxil: number; xaric: number; net: number; emeliyyat_say: number };

export type MyTask = {
  id: string;
  basliq: string;
  deadline: string | null; // ISO
  prioritet: string | null;
  status: string | null;
};
export type MyPendingWork = {
  my_open_tasks: number;
  my_today_reminders: number;
  my_overdue: number;
  next_tasks: MyTask[];
};

export type DailyInsight = { emoji: string; text: string; tone: "success" | "warning" | "danger" | "info" };

export type CriticalAlertRow = { id: string; basliq: string; seviyye: string; kateqoriya_ad: string };

export type LowStockRow = {
  mehsul_id: string;
  ad: string;
  kod: string | null;
  anbar_ad: string;
  miqdar: number;
  kritik_stok: number;
};

export type TopProductRow = { ad: string; miqdar: number; mebleg: number };
export type TopSellerRow = { id: string; ad_soyad: string | null; sifaris_say: number; cemi: number };
export type TopCustomerRow = { id: string; ad: string; telefon: string | null; sifaris_say: number; cemi: number };
export type TopPlatformRow = { platform: string; sifaris_say: number; cemi: number };
export type TopDebtorRow = {
  id: string;
  ad: string;
  telefon: string | null;
  borc: number;
  gecikme_gun: number;
  acig_say: number;
};

export type DailySalesPoint = { date: string; amount: number; count: number };
export type SalesVsExpensePoint = { gun: string; satis: number; xerc: number };

export type DashboardHome = {
  ceo: CeoKpis | null;
  monthly: MonthlyComparison | null;
  cashflow: TodayCashFlow | null;
  mywork: MyPendingWork | null;
  insight: DailyInsight | null;
  alerts: CriticalAlertRow[] | null;
  lowStock: LowStockRow[] | null;
  top: {
    products: TopProductRow[] | null;
    sellers: TopSellerRow[] | null;
    customers: TopCustomerRow[] | null;
    platforms: TopPlatformRow[] | null;
  };
  debtors: TopDebtorRow[] | null;
  sales30: DailySalesPoint[] | null;
  salesVsExp30: SalesVsExpensePoint[] | null;
};
