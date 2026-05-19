import { redirect } from "next/navigation";

/**
 * Pipeline ayrı səhifə olmayıb — Satışlar səhifəsinin Kanban görünüşüdür.
 *
 * Səbəb: Satış pipeline = sales orders status board (qaralama → çatdırılır
 * → ödənildi). Bu data Satışlar səhifəsinin elə özüdür, sadəcə fərqli görünüş.
 * 2 yerdə eyni məlumat saxlamaq qarışıqlıq yaradır.
 */
export default function PipelinePage() {
  redirect("/ticaret/satislar?view=kanban");
}
