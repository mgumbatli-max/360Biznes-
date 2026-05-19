import { redirect } from "next/navigation";

/**
 * Marketdən satış primary entry-point is now the standalone /market-pos
 * window (mirrors /pos). This dashboard route stays as a redirect so any
 * existing bookmarks / deep links continue to work.
 */
export default function MarketSatisRedirectPage() {
  redirect("/market-pos");
}
