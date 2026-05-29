import { RecentActivityWidget } from "@/features/dashboard/components/recent-activity-widget";
import { getDashboardActivityFeed } from "@/features/dashboard/recent-activity-queries";

export async function BusinessFeedSection() {
  const bizFeed = await getDashboardActivityFeed(12).catch(() => []);
  return <RecentActivityWidget items={bizFeed} limit={12} />;
}
