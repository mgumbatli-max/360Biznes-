import { Bell, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import type { AlertStats } from "../queries";

export function AlertStatsBar({ stats }: { stats: AlertStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        icon={Bell}
        label="Aktiv xəbərdarlıq"
        value={String(stats.open_count)}
        subline={`${stats.today_count} bu gün gəldi`}
        tone={stats.open_count > 0 ? "warning" : "neutral"}
      />
      <KpiCard
        icon={AlertTriangle}
        label="Kritik"
        value={String(stats.kritik_count)}
        subline="Təcili reaksiya"
        tone={stats.kritik_count > 0 ? "danger" : "neutral"}
      />
      <KpiCard
        icon={Clock}
        label="Təxirə salınıb"
        value={String(stats.snoozed_count)}
        subline="Sonradan baxılacaq"
      />
      <KpiCard
        icon={CheckCircle2}
        label="Bu gün həll olunub"
        value={String(stats.resolved_today_count)}
        subline="Tamamlandı"
        tone="success"
      />
    </div>
  );
}
